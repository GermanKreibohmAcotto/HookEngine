# HookEngine

A webhook delivery engine that treats destination failure as the normal case,
not the exception. Ingestion never blocks on a subscriber being slow, down, or
returning garbage — events are queued, dispatched asynchronously, retried with
backoff, and isolated into a dead letter queue when they exhaust their retries.

```
POST /api/v1/events  →  202 Accepted (milliseconds, regardless of subscriber health)
                     ↓
                  Postgres (event persisted, idempotency enforced)
                     ↓
                  Redis / BullMQ queue
                     ↓
      Worker → HTTP POST to subscriber, HMAC-signed, timed out, retried
                     ↓
        succeeded │ retrying (exponential backoff + jitter) │ dead (DLQ)
```

## Why

Every team that fans events out to external URLs re-implements the same five
things, usually under pressure, usually after an incident:

- Ingestion that doesn't hang when a subscriber's server is unreachable.
- Retries that don't recreate the outage they're recovering from (thundering herd).
- A place fatally-failed events land where a human can see and replay them.
- Payload signing subscribers can actually verify, without guessing your algorithm.
- Visibility into what was sent, to whom, and what came back — live, not from grep-ing logs.

HookEngine is those five things, already built.

## Features

|                                       |                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| **Non-blocking ingestion**            | `POST /api/v1/events` returns `202` immediately; delivery happens out-of-band   |
| **Idempotent ingestion**              | `Idempotency-Key` header, backed by a unique DB constraint                      |
| **Exponential backoff + full jitter** | no thundering herd when a subscriber comes back up                              |
| **Dead Letter Queue**                 | exhausted events are isolated, inspectable, and replayable                      |
| **HMAC-SHA256 signatures**            | Stripe/GitHub-style `X-Webhook-Signature`, verifiable via the published SDK     |
| **Per-domain rate limiting**          | token bucket in Redis, keyed by subscriber target hostname                      |
| **Circuit breaker per subscriber**    | stops hammering a subscriber that's sustaining 5xx failures                     |
| **Secret rotation with grace period** | deliveries co-sign with the old and new secret until the receiver has caught up |
| **SSRF guard**                        | subscriber URLs can't point at loopback, RFC1918, or link-local addresses       |
| **Live dashboard**                    | delivery status, latency percentiles, response codes, payload viewer — over SSE |

## Quickstart

```bash
git clone https://github.com/hookengine/hookengine.git
cd hookengine
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173` for the dashboard and `http://localhost:3000/health`
to confirm the API is up. Send your first event:

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(node -e 'console.log(crypto.randomUUID())')" \
  -d '{"eventType":"order.created","payload":{"orderId":"ord_123"}}'
```

Register a subscriber first through the dashboard or `POST /api/v1/subscribers`
so there's somewhere for that event to go — see
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the full walkthrough.

## Verifying a signature

Every delivery carries:

```
X-Webhook-Id:         <delivery-id>
X-Webhook-Event:      order.created
X-Webhook-Timestamp:  1739812800
X-Webhook-Signature:  v1=<hex hmac-sha256>
```

Verify it with the published SDK — the same code HookEngine uses to sign:

```bash
npm install @hookengine/webhooks
```

```ts
import { verify } from '@hookengine/webhooks';

const ok = verify({
  payload: rawRequestBody, // the exact raw bytes received, not re-serialized JSON
  secret: subscriberSecret,
  signatureHeader: req.headers['x-webhook-signature'],
  timestampHeader: req.headers['x-webhook-timestamp'],
});
```

No SDK for your language yet? [`packages/webhooks/test-vectors.json`](packages/webhooks/test-vectors.json)
gives you fixed (secret, timestamp, payload, signature) tuples to validate your
own implementation against, and [docs/SIGNATURE_SPEC.md](docs/SIGNATURE_SPEC.md)
describes the algorithm in prose.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module layout, why hexagonal, the two-process split
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) — running this in production
- [docs/SIGNATURE_SPEC.md](docs/SIGNATURE_SPEC.md) — the signing algorithm, language-agnostic
- [CONTRIBUTING.md](CONTRIBUTING.md) — local dev setup, commit conventions, how to change the SDK

## License

[Apache-2.0](LICENSE)
