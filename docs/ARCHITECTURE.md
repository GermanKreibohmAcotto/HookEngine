# Architecture

## The shape of the problem

A webhook engine has exactly one job that matters: never let a slow or dead
subscriber become _your_ problem. Everything here follows from that.

```
POST /api/v1/events                              (HTTP process)
        │
        ▼
  validate, hash payload, check Idempotency-Key
        │
        ▼
  Postgres: insert event + one "pending" delivery per matching subscriber
        │  (single transaction — either all of it lands, or none of it does)
        ▼
  BullMQ: enqueue one job per delivery
        │
        ▼
  202 Accepted ── the caller is done. Nothing downstream has happened yet.


  BullMQ job                                      (Worker process, separate)
        │
        ▼
  circuit breaker check (per subscriber) ── open? → reschedule, no attempt spent
        │ closed
        ▼
  token bucket check (per target domain) ── empty? → reschedule, no attempt spent
        │ has tokens
        ▼
  sign with @hookengine/webhooks, POST via undici (timeout, no redirects)
        │
        ├─ 2xx ────────────────────────────────────────► succeeded
        ├─ 4xx (not 408/429) ──────────────────────────► dead (DLQ)
        └─ 408 / 429 / 5xx / network error / timeout ──► retry (full jitter)
                  or, once max_retries is exhausted ───► dead (DLQ)
```

Two things fall out of this diagram directly:

- **Ingestion physically cannot block on a subscriber.** The HTTP process
  never makes an outbound HTTP call. It writes to Postgres and pushes a job
  onto a queue — both fast, both local. The only way ingestion gets slow is
  if _Postgres_ or _Redis_ is slow, not if `subscriber-with-a-dead-server.com`
  is.
- **A failure in one delivery can't touch another.** Each delivery is its own
  row, its own job, its own retry schedule. A subscriber having a bad day
  doesn't slow down or corrupt anyone else's deliveries.

## Module layout

```
apps/api/src/
├─ events/          ingestion: idempotency, fan-out to subscribers
├─ subscriptions/   subscriber CRUD, the SSRF guard, secret encryption + rotation
├─ delivery/         dispatch, retries, DLQ, rate limiting, circuit breaking
├─ monitoring/       health, metrics, the SSE stream
└─ shared/           config, db, redis — cross-cutting, no business logic
```

Each domain module (`events`, `subscriptions`, `delivery`) is split the same
way:

```
delivery/
├─ domain/          entities, value objects, pure functions — zero framework imports
├─ application/      use cases + ports (interfaces the use cases depend on)
└─ infrastructure/   adapters: Drizzle repositories, BullMQ, undici, controllers
```

**The one rule that isn't negotiable:** nothing in `domain/` imports NestJS,
Drizzle, or BullMQ. A use case in `application/` depends on a _port_
(`WebhookDispatcher`, `DeliveryRepository`, `DeliveryQueue` — plain
TypeScript interfaces) and `infrastructure/` provides the concrete
implementation via Nest's DI container. Swap BullMQ for Redis Streams
tomorrow and you're rewriting adapters, not use cases.

You can see this rule pay for itself in `delivery/application/ports/webhook-dispatcher.port.ts`:
the rate limiter and circuit breaker (see below) are implemented as
decorators around that same `WebhookDispatcher` interface, sitting in
`infrastructure/` right next to the real one. `ProcessDeliveryUseCase`
never knows they exist.

## Why two processes, one codebase

`apps/api/src/main.http.ts` and `main.worker.ts` boot two different Nest
module trees (`HttpAppModule`, `WorkerAppModule`) from the same source and
the same Docker image — only the `CMD` differs (see `apps/api/Dockerfile`
and `docker-compose.yml`). This is deliberate, not an accident of deployment
config:

- They scale independently. A traffic spike on ingestion doesn't need more
  delivery workers, and a backlog of retries doesn't need more HTTP capacity.
- `DeliveryWorkerModule` (the consumer side — `ProcessDeliveryUseCase`, the
  BullMQ `Worker`) is physically excluded from `HttpAppModule`'s import
  graph. There's no code path by which starting the HTTP process
  accidentally starts a job consumer — a class of bug that's easy to
  introduce with a careless module import and hard to notice until two
  HTTP replicas are quietly double-processing the same queue.

## The decorator chain (Fase 6)

`WEBHOOK_DISPATCHER` resolves to three layers, wrapped in this order:

```
CircuitBreakingDispatcher
  → RateLimitedDispatcher
    → UndiciWebhookDispatcher   (the actual HTTP call)
```

Checked outermost-first: an open circuit short-circuits before a rate-limit
token is even considered, since there's no point spending a domain's token
budget on a call you're not going to make. Both checks are atomic Redis Lua
scripts (`rate-limiter.lua`, `circuit-breaker-check.lua`,
`circuit-breaker-report.lua`) — necessary because multiple worker
concurrency slots can be checking the same subscriber or domain at the same
instant, and a non-atomic check-then-act would let them all through together.

When either decorator blocks a delivery, it returns a `{ kind: 'deferred' }`
outcome rather than throwing. `ProcessDeliveryUseCase` sees that and calls
`job.moveToDelayed()` + throws BullMQ's `DelayedError` — which BullMQ
special-cases to reschedule the job _without_ touching its retry-attempt
count or emitting a `failed` event. A subscriber being rate limited or
circuit-broken costs it nothing from its own retry budget; only a genuine
attempt (a real HTTP call that came back with a real answer) does.

## Data model

Four tables, roughly one per stage of the pipeline: `subscribers` (who),
`events` (what, with the idempotency constraint), `deliveries` (one row per
`event × subscriber`, tracking status/attempt count/next retry time), and
`delivery_attempts` (append-only audit log — every real HTTP attempt, its
response, its latency). See `apps/api/src/shared/db/schema.ts`.

Ephemeral state — token bucket levels, circuit breaker state — lives in
Redis, not Postgres. It's reconstructible from nothing (an empty bucket
just means "hasn't been used recently") and doesn't deserve a durable write
on every single request.

## The SDK boundary

`packages/webhooks` is the one place signing logic exists. `apps/api` signs
outgoing deliveries by importing `sign()` from it — not by re-implementing
HMAC-SHA256 inline. That's the whole point of publishing it: the code that
signs and the code you'd use to verify are provably the same code, not two
implementations someone has to remember to keep in sync.
