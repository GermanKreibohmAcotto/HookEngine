# Arquitectura

## La forma del problema

Un motor de webhooks tiene exactamente un trabajo que importa: que un
suscriptor lento o muerto nunca se convierta en _tu_ problema. Todo lo demás
se desprende de ahí.

```
POST /api/v1/events                              (proceso HTTP)
        │
        ▼
  validar, hashear payload, chequear Idempotency-Key
        │
        ▼
  Postgres: insertar evento + una entrega "pending" por suscriptor coincidente
        │  (una sola transacción — o aterriza todo, o no aterriza nada)
        ▼
  BullMQ: encolar un job por entrega
        │
        ▼
  202 Accepted ── el llamador terminó. Todavía no pasó nada río abajo.


  job de BullMQ                                   (proceso Worker, separado)
        │
        ▼
  chequeo de circuit breaker (por suscriptor) ── ¿abierto? → reprogramar, sin gastar intento
        │ cerrado
        ▼
  chequeo de token bucket (por dominio destino) ── ¿vacío? → reprogramar, sin gastar intento
        │ tiene tokens
        ▼
  firmar con @hookengine/webhooks, POST vía undici (con timeout, sin seguir redirects)
        │
        ├─ 2xx ──────────────────────────────────────► succeeded
        ├─ 4xx (salvo 408/429) ─────────────────────► dead (DLQ)
        └─ 408 / 429 / 5xx / error de red / timeout ─► retry (full jitter)
                  o, una vez agotado max_retries ────► dead (DLQ)
```

De este diagrama se desprenden dos cosas directamente:

- **La ingesta físicamente no puede bloquearse esperando a un suscriptor.** El
  proceso HTTP nunca hace un llamado HTTP saliente. Escribe en Postgres y
  empuja un job a una cola — ambas operaciones rápidas y locales. La única
  forma de que la ingesta se ponga lenta es que _Postgres_ o _Redis_ estén
  lentos, no que `suscriptor-con-servidor-muerto.com` lo esté.
- **Un fallo en una entrega no puede tocar otra.** Cada entrega es su propia
  fila, su propio job, su propio calendario de reintentos. Que un suscriptor
  tenga un mal día no ralentiza ni corrompe las entregas de nadie más.

## Organización de módulos

```
apps/api/src/
├─ events/          ingesta: idempotencia, fan-out a suscriptores
├─ subscriptions/   CRUD de suscriptores, el guard SSRF, cifrado + rotación de secretos
├─ delivery/         despacho, reintentos, DLQ, rate limiting, circuit breaking
├─ monitoring/       health, métricas, el stream SSE
└─ shared/           config, db, redis — transversal, sin lógica de negocio
```

Cada módulo de dominio (`events`, `subscriptions`, `delivery`) se divide de la
misma forma:

```
delivery/
├─ domain/          entidades, value objects, funciones puras — cero imports de framework
├─ application/      casos de uso + puertos (interfaces de las que dependen los casos de uso)
└─ infrastructure/   adaptadores: repositorios Drizzle, BullMQ, undici, controllers
```

**La regla que no es negociable:** nada en `domain/` importa NestJS, Drizzle
ni BullMQ. Un caso de uso en `application/` depende de un _puerto_
(`WebhookDispatcher`, `DeliveryRepository`, `DeliveryQueue` — interfaces
puras de TypeScript) e `infrastructure/` provee la implementación concreta
vía el contenedor de DI de Nest. Cambiar BullMQ por Redis Streams mañana es
reescribir adaptadores, no casos de uso.

Podés ver esta regla dando resultado en
`delivery/application/ports/webhook-dispatcher.port.ts`: el rate limiter y el
circuit breaker (ver abajo) están implementados como decoradores alrededor de
esa misma interfaz `WebhookDispatcher`, ubicados en `infrastructure/` justo al
lado del real. `ProcessDeliveryUseCase` nunca sabe que existen.

## Por qué dos procesos, un solo código

`apps/api/src/main.http.ts` y `main.worker.ts` arrancan dos árboles de
módulos de Nest distintos (`HttpAppModule`, `WorkerAppModule`) desde el mismo
código fuente y la misma imagen Docker — sólo el `CMD` difiere (ver
`apps/api/Dockerfile` y `docker-compose.yml`). Esto es deliberado, no un
accidente de la configuración de deployment:

- Escalan de forma independiente. Un pico de tráfico en la ingesta no necesita
  más workers de entrega, y un backlog de reintentos no necesita más
  capacidad HTTP.
- `DeliveryWorkerModule` (el lado consumidor — `ProcessDeliveryUseCase`, el
  `Worker` de BullMQ) está físicamente excluido del grafo de imports de
  `HttpAppModule`. No hay ningún camino de código por el cual arrancar el
  proceso HTTP arranque accidentalmente un consumidor de jobs — una clase de
  bug fácil de introducir con un import de módulo descuidado y difícil de
  notar hasta que dos réplicas HTTP están procesando la misma cola por
  duplicado en silencio.

## La cadena de decoradores (Fase 6)

`WEBHOOK_DISPATCHER` resuelve a tres capas, envueltas en este orden:

```
CircuitBreakingDispatcher
  → RateLimitedDispatcher
    → UndiciWebhookDispatcher   (el llamado HTTP real)
```

Chequeadas de afuera hacia adentro: un circuito abierto corta antes de
siquiera considerar un token de rate limit, ya que no tiene sentido gastar
el presupuesto de tokens de un dominio en un llamado que no vas a hacer.
Ambos chequeos son scripts Lua atómicos de Redis (`rate-limiter.lua`,
`circuit-breaker-check.lua`, `circuit-breaker-report.lua`) — necesarios
porque múltiples slots de concurrencia del worker pueden estar chequeando el
mismo suscriptor o dominio en el mismo instante, y un check-then-act no
atómico dejaría pasar a todos juntos.

Cuando cualquiera de los dos decoradores bloquea una entrega, devuelve un
resultado `{ kind: 'deferred' }` en vez de lanzar una excepción.
`ProcessDeliveryUseCase` ve eso y llama a `job.moveToDelayed()` + lanza el
`DelayedError` de BullMQ — que BullMQ trata como caso especial para
reprogramar el job _sin_ tocar su contador de intentos de reintento ni emitir
un evento `failed`. Que un suscriptor esté rate-limited o con el circuito
abierto no le cuesta nada de su propio presupuesto de reintentos; sólo un
intento real (un llamado HTTP real que volvió con una respuesta real) sí.

## Modelo de datos

Cuatro tablas, aproximadamente una por etapa del pipeline: `subscribers`
(quién), `events` (qué, con la restricción de idempotencia), `deliveries`
(una fila por `evento × suscriptor`, siguiendo estado/cantidad de
intentos/próximo horario de reintento), y `delivery_attempts` (log de
auditoría append-only — cada intento HTTP real, su respuesta, su latencia).
Ver `apps/api/src/shared/db/schema.ts`.

El estado efímero — niveles del token bucket, estado del circuit breaker —
vive en Redis, no en Postgres. Es reconstruible desde cero (un bucket vacío
sólo significa "no se usó hace poco") y no merece una escritura durable en
cada request individual.

## El límite del SDK

`packages/webhooks` es el único lugar donde existe lógica de firmado.
`apps/api` firma las entregas salientes importando `sign()` de ahí — no
reimplementando HMAC-SHA256 inline. Ese es todo el sentido de publicarlo: el
código que firma y el código que usarías para verificar son demostrablemente
el mismo código, no dos implementaciones que alguien tiene que acordarse de
mantener sincronizadas.
