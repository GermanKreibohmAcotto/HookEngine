# HookEngine

Un motor de entrega de webhooks que trata el fallo del destino como el caso
normal, no como la excepción. La ingesta nunca se bloquea porque un
suscriptor esté lento, caído o devuelva basura — los eventos se encolan, se
despachan de forma asíncrona, se reintentan con backoff y se aíslan en una
cola de mensajes muertos (DLQ) cuando agotan sus reintentos.

```
POST /api/v1/events  →  202 Accepted (milisegundos, sin importar la salud del suscriptor)
                     ↓
                  Postgres (evento persistido, idempotencia garantizada)
                     ↓
                  Cola Redis / BullMQ
                     ↓
      Worker → POST HTTP al suscriptor, firmado con HMAC, con timeout, con reintentos
                     ↓
        succeeded │ retrying (backoff exponencial + jitter) │ dead (DLQ)
```

## Por qué

Todo equipo que distribuye eventos hacia URLs externas termina
reimplementando las mismas cinco cosas, casi siempre bajo presión y casi
siempre después de un incidente:

- Ingesta que no se cuelga cuando el servidor de un suscriptor es inalcanzable.
- Reintentos que no recrean la caída de la que están intentando recuperarse (thundering herd).
- Un lugar donde aterrizan los eventos fatalmente fallidos, visible y reproducible por una persona.
- Firmado de payloads que los suscriptores puedan verificar de verdad, sin adivinar el algoritmo.
- Visibilidad de qué se envió, a quién y qué respondió — en vivo, no grepeando logs.

HookEngine es esas cinco cosas, ya construidas.

## Funcionalidades

|                                                |                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Ingesta no bloqueante**                      | `POST /api/v1/events` devuelve `202` de inmediato; la entrega ocurre fuera de banda          |
| **Ingesta idempotente**                        | header `Idempotency-Key`, respaldado por una restricción única en la base de datos           |
| **Backoff exponencial + full jitter**          | sin thundering herd cuando un suscriptor vuelve a estar disponible                           |
| **Cola de mensajes muertos (DLQ)**             | los eventos agotados quedan aislados, inspeccionables y reproducibles                        |
| **Firmas HMAC-SHA256**                         | `X-Webhook-Signature` al estilo Stripe/GitHub, verificable con el SDK publicado              |
| **Rate limiting por dominio**                  | token bucket en Redis, indexado por el hostname destino del suscriptor                       |
| **Circuit breaker por suscriptor**             | deja de martillar a un suscriptor que sostiene fallas 5xx                                    |
| **Rotación de secretos con período de gracia** | las entregas cofirman con el secreto viejo y el nuevo hasta que el receptor se pone al día   |
| **Guard SSRF**                                 | las URLs de suscriptor no pueden apuntar a loopback, RFC1918 ni direcciones link-local       |
| **Panel en vivo**                              | estado de entrega, percentiles de latencia, códigos de respuesta, visor de payload — por SSE |

## Inicio rápido

```bash
git clone https://github.com/hookengine/hookengine.git
cd hookengine
cp .env.example .env
docker compose up --build
```

Abrí `http://localhost:5173` para el panel y `http://localhost:3000/health`
para confirmar que la API está arriba. Enviá tu primer evento:

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(node -e 'console.log(crypto.randomUUID())')" \
  -d '{"eventType":"order.created","payload":{"orderId":"ord_123"}}'
```

Primero registrá un suscriptor desde el panel o con `POST /api/v1/subscribers`
para que ese evento tenga adónde ir — ver
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) para el recorrido completo.

## Verificar una firma

Cada entrega lleva:

```
X-Webhook-Id:         <delivery-id>
X-Webhook-Event:      order.created
X-Webhook-Timestamp:  1739812800
X-Webhook-Signature:  v1=<hex hmac-sha256>
```

Verificala con el SDK publicado — el mismo código que usa HookEngine para firmar:

```bash
npm install @hookengine/webhooks
```

```ts
import { verify } from '@hookengine/webhooks';

const ok = verify({
  payload: rawRequestBody, // los bytes crudos exactos recibidos, no un JSON re-serializado
  secret: subscriberSecret,
  signatureHeader: req.headers['x-webhook-signature'],
  timestampHeader: req.headers['x-webhook-timestamp'],
});
```

¿Todavía no hay SDK para tu lenguaje? [`packages/webhooks/test-vectors.json`](packages/webhooks/test-vectors.json)
te da tuplas fijas (secret, timestamp, payload, signature) contra las que validar
tu propia implementación, y [docs/SIGNATURE_SPEC.md](docs/SIGNATURE_SPEC.md)
describe el algoritmo en prosa.

## Documentación

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — organización de módulos, por qué hexagonal, la separación en dos procesos
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) — cómo correr esto en producción
- [docs/SIGNATURE_SPEC.md](docs/SIGNATURE_SPEC.md) — el algoritmo de firmado, independiente del lenguaje
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup local, convenciones de commits, cómo modificar el SDK

## Licencia

[Apache-2.0](LICENSE)
