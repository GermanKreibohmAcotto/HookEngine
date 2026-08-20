# Self-hosting

Esto cubre correr HookEngine en algún lugar que no sea tu laptop. Para
desarrollo local, el inicio rápido del `README.md` (`docker compose up --build`)
es todo lo que necesitás — volvé acá cuando lo estés desplegando de verdad.

## Imágenes

Cada push a `main` publica imágenes multi-arquitectura (`linux/amd64`,
`linux/arm64`) a GHCR:

```
ghcr.io/hookengine/hookengine-api:latest
ghcr.io/hookengine/hookengine-web:latest
```

`hookengine-api` es una sola imagen que sirve dos entrypoints —
`main.http.js` (la API de ingesta + la API de admin/dashboard) y
`main.worker.js` (el worker de entrega) — seleccionados por el `CMD` del
contenedor, igual que como los corre `docker-compose.yml`. Fijá un tag
(`:v0.1.0`) en vez de `:latest` para cualquier cosa de la que dependas de verdad.

## Configuración requerida

Cada variable de abajo se valida al arrancar
(`apps/api/src/shared/config/env.schema.ts`) — si falta una o está mal
formada, el proceso corta la ejecución de inmediato en vez de fallar un
request tres horas después. Copiá `.env.example` y completá los secretos
generados:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"  # SECRET_ENCRYPTION_KEY
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"  # INGEST_API_KEY
```

| Variable                                                            | Propósito                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                      | Cadena de conexión a Postgres                                                                                                                                                                                                                                    |
| `REDIS_URL`                                                         | Cadena de conexión a Redis (BullMQ, rate limiter, circuit breaker y fan-out de SSE la comparten)                                                                                                                                                                 |
| `INGEST_API_KEY`                                                    | Token Bearer requerido en cada request a `/api/v1/*`, incluyendo desde el dashboard                                                                                                                                                                              |
| `SECRET_ENCRYPTION_KEY`                                             | Clave hex de 32 bytes, AES-256-GCM — cifra los secretos de firma de los suscriptores en reposo. **Perder esta clave hace irrecuperable cada secreto guardado y obliga a re-registrar a todos los suscriptores.** Respaldala como respaldarías una base de datos. |
| `CORS_ORIGIN`                                                       | Origen permitido para llamar a la API HTTP — apuntalo a donde sea que se sirva `apps/web`                                                                                                                                                                        |
| `HTTP_PORT`                                                         | Por defecto `3000`                                                                                                                                                                                                                                               |
| `WORKER_CONCURRENCY`                                                | Entregas concurrentes por _proceso_ worker (no por réplica — corré más réplicas de worker para escalar más)                                                                                                                                                      |
| `DELIVERY_DEFAULT_TIMEOUT_MS` / `DELIVERY_DEFAULT_MAX_RETRIES`      | Valores por defecto por suscriptor; sobreescribibles por suscriptor vía la API                                                                                                                                                                                   |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` / `_WINDOW_MS` / `_COOLDOWN_MS` | Ver [ARCHITECTURE.md](ARCHITECTURE.md#la-cadena-de-decoradores-fase-6)                                                                                                                                                                                           |
| `SECRET_ROTATION_GRACE_PERIOD_MS`                                   | Cuánto tiempo un secreto rotado sigue cofirmando entregas (por defecto 24h)                                                                                                                                                                                      |
| `LOG_LEVEL`                                                         | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace`                                                                                                                                                                                                     |

## Corriéndolo

Los dos procesos escalan de forma independiente — esa es la razón por la que
están separados. Un punto de partida aproximado: 2+ réplicas de
`main.http.js` detrás de un balanceador de carga para disponibilidad, y las
réplicas de `main.worker.js` que tu volumen de entregas necesite (cada una
corre `WORKER_CONCURRENCY` entregas en paralelo; sumá réplicas, no sólo
concurrencia, una vez que superes lo que el pool de conexiones de un proceso
maneja cómodamente).

Las migraciones corren como un job de una sola vez
(`node dist/shared/db/migrate.js`) — ver el servicio `migrate` en
`docker-compose.yml` para el patrón. Corrélo antes de arrancar nuevas
réplicas de `api`/`worker` en un deploy, no desde adentro de los propios
procesos de la app.

El stream SSE (`GET /api/v1/stream/deliveries`) funciona correctamente
detrás de un balanceador de carga con varias réplicas de `main.http.js`: cada
réplica mantiene su propia suscripción a Redis y retransmite a los browsers
conectados a _ella_, así que no importa a qué réplica llega el `PUBLISH` de
Redis de un worker ni a qué réplica está conectado un browser dado.

## Salud y disponibilidad

`GET /health` chequea la conectividad a Postgres y Redis y devuelve `503` si
alguno de los dos es inalcanzable — apuntá tu load balancer / orquestador ahí
para el health check. El proceso `worker` no expone HTTP en absoluto;
monitoreálo vía la profundidad/antigüedad de la cola de BullMQ en Redis, o
liveness del proceso.

## Notas de seguridad

- **El guard SSRF es sólo al momento de registro.** `assertSafeTargetUrl`
  rechaza direcciones loopback/privadas/link-local (incluyendo el endpoint
  de metadata de cloud `169.254.169.254`) cuando se crea o actualiza un
  suscriptor, resolviendo DNS y chequeando cada dirección devuelta. No
  vuelve a chequear al momento del despacho, así que un suscriptor cuyo
  hostname se re-apunta vía DNS después del registro (DNS rebinding) no
  queda cubierto sólo por esta capa — las restricciones de egress a nivel de
  red en el worker son la defensa más profunda si eso está en tu modelo de amenazas.
- **Los secretos de los suscriptores están cifrados en reposo**, pero
  `SECRET_ENCRYPTION_KEY` en sí misma sólo es tan segura como dónde la
  guardes. Usá el secrets manager real de tu plataforma, no un archivo
  `.env`, en producción.
- **La API key de admin es una sola credencial compartida** — no hay
  autenticación por operador en v0.1. Tratala como una contraseña root: poné
  el dashboard detrás de una red que controlás (VPN, load balancer interno),
  no expongas `/api/v1/*` a internet abierto salvo que estés cómodo con que
  esa clave sea todo tu perímetro de acceso.
- ¿Encontraste una vulnerabilidad real? Ver [SECURITY.md](../SECURITY.md) —
  no la reportes como issue público.

## Backups

Postgres tiene todo lo que importa: suscriptores, eventos, historial de
entregas. Respaldalo como cualquier base de datos de producción. El estado en
Redis (contenido de la cola, estado del rate limiter/circuit breaker) es
descartable — perderlo pierde la programación de reintentos en vuelo y
resetea los rate limits/circuitos a su estado por defecto "cerrado", no la
correctitud de los datos.
