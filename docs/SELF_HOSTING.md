# Self-hosting

This covers running HookEngine somewhere that isn't your laptop. For local
development, `README.md`'s quickstart (`docker compose up --build`) is all
you need — come back here once you're deploying it for real.

## Images

Every push to `main` publishes multi-arch (`linux/amd64`, `linux/arm64`)
images to GHCR:

```
ghcr.io/hookengine/hookengine-api:latest
ghcr.io/hookengine/hookengine-web:latest
```

`hookengine-api` is one image serving two entrypoints — `main.http.js` (the
ingestion API + admin/dashboard API) and `main.worker.js` (the delivery
worker) — selected by container `CMD`, matching how `docker-compose.yml`
runs them. Pin a tag (`:v0.1.0`) rather than `:latest` for anything you
actually depend on.

## Required configuration

Every variable below is validated at boot (`apps/api/src/shared/config/env.schema.ts`)
— a missing or malformed one and the process exits immediately instead of
failing a request three hours later. Copy `.env.example` and fill in the
generated secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"  # SECRET_ENCRYPTION_KEY
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"  # INGEST_API_KEY
```

| Variable                                                            | Purpose                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                      | Postgres connection string                                                                                                                                                                                               |
| `REDIS_URL`                                                         | Redis connection string (BullMQ, rate limiter, circuit breaker, SSE fan-out all share it)                                                                                                                                |
| `INGEST_API_KEY`                                                    | Bearer token required on every `/api/v1/*` request, including from the dashboard                                                                                                                                         |
| `SECRET_ENCRYPTION_KEY`                                             | 32-byte hex key, AES-256-GCM — encrypts subscriber signing secrets at rest. **Losing this makes every stored secret unrecoverable and every subscriber needs re-registering.** Back it up like you'd back up a database. |
| `CORS_ORIGIN`                                                       | Origin allowed to call the HTTP API — set to wherever `apps/web` is actually served from                                                                                                                                 |
| `HTTP_PORT`                                                         | Default `3000`                                                                                                                                                                                                           |
| `WORKER_CONCURRENCY`                                                | Concurrent deliveries per worker _process_ (not per replica — run more worker replicas to scale further)                                                                                                                 |
| `DELIVERY_DEFAULT_TIMEOUT_MS` / `DELIVERY_DEFAULT_MAX_RETRIES`      | Per-subscriber defaults; overridable per subscriber via the API                                                                                                                                                          |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` / `_WINDOW_MS` / `_COOLDOWN_MS` | See [ARCHITECTURE.md](ARCHITECTURE.md#the-decorator-chain-fase-6)                                                                                                                                                        |
| `SECRET_ROTATION_GRACE_PERIOD_MS`                                   | How long a rotated-out secret keeps co-signing deliveries (default 24h)                                                                                                                                                  |
| `LOG_LEVEL`                                                         | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace`                                                                                                                                                             |

## Running it

The two processes scale independently — that's the reason they're split.
A rough starting point: 2+ replicas of `main.http.js` behind a load
balancer for availability, and however many `main.worker.js` replicas your
delivery volume needs (each one runs `WORKER_CONCURRENCY` deliveries in
parallel; add replicas, not just concurrency, once you're past what one
process's connection pool comfortably handles).

Migrations run as a one-shot job (`node dist/shared/db/migrate.js`) — see
the `migrate` service in `docker-compose.yml` for the pattern. Run it before
starting new `api`/`worker` replicas on a deploy, not from inside the app
processes themselves.

The SSE stream (`GET /api/v1/stream/deliveries`) works correctly behind a
load balancer with multiple `main.http.js` replicas: each replica keeps its
own Redis subscription and re-broadcasts to whichever browsers are connected
to _it_, so it doesn't matter which replica a worker's Redis `PUBLISH`
reaches or which replica a given browser is connected to.

## Health and readiness

`GET /health` checks Postgres and Redis connectivity and returns `503` if
either is unreachable — point your load balancer / orchestrator's health
check at it. The `worker` process doesn't expose HTTP at all; monitor it via
BullMQ queue depth/age in Redis, or process liveness.

## Security notes

- **The SSRF guard is registration-time only.** `assertSafeTargetUrl`
  rejects loopback/private/link-local addresses (including the
  `169.254.169.254` cloud metadata endpoint) when a subscriber is created or
  updated, resolving DNS and checking every returned address. It does not
  re-check at dispatch time, so a subscriber whose hostname is repointed via
  DNS after registration (DNS rebinding) isn't caught by this layer alone —
  network-level egress restrictions on the worker are the deeper defense if
  that's in your threat model.
- **Subscriber secrets are encrypted at rest**, but `SECRET_ENCRYPTION_KEY`
  itself is only as safe as wherever you're storing it. Use your platform's
  actual secrets manager, not a `.env` file, in production.
- **The admin API key is a single shared credential** — there's no
  per-operator auth in v0.1. Treat it like a root password: put the
  dashboard behind a network you control (VPN, internal load balancer),
  don't expose `/api/v1/*` to the open internet unless you're comfortable
  with that key being your entire access boundary.
- Found a real vulnerability? See [SECURITY.md](../SECURITY.md) — don't file
  it as a public issue.

## Backups

Postgres holds everything that matters: subscribers, events, delivery
history. Back it up like any production database. Redis state (queue
contents, rate limiter/circuit breaker state) is disposable — losing it
loses in-flight retry scheduling and resets rate limits/circuits to their
default "closed" state, not correctness.
