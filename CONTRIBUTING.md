# Contributing to HookEngine

Thanks for taking the time to contribute. This document covers local setup,
conventions, and how a change gets from your machine into `main`.

## Local setup

Requirements: Node.js 22+, Docker + Docker Compose.

```bash
git clone https://github.com/hookengine/hookengine.git
cd hookengine
cp .env.example .env          # then edit the generated secrets, see below
npm install
docker compose up -d postgres redis
npm run db:migrate -w apps/api
npm run dev -w apps/api       # or: docker compose up --build
```

Generate real values for the two secrets in `.env` before starting anything:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"  # SECRET_ENCRYPTION_KEY
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"  # INGEST_API_KEY
```

## Project layout

This is a monorepo (npm workspaces). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the full picture; the short version:

- `apps/api` — NestJS backend. Two entrypoints (`main.http.ts`, `main.worker.ts`)
  sharing one codebase. Each domain module (`delivery`, `subscriptions`, `events`)
  is split into `domain/` (framework-free), `application/` (use cases + ports),
  and `infrastructure/` (adapters — Drizzle, BullMQ, undici, controllers).
- `apps/web` — the admin dashboard (Vite + React).
- `packages/webhooks` — the public `@hookengine/webhooks` SDK. This is published
  to npm, so changes here need a changeset (see below) and are held to a
  stricter bar: zero runtime dependencies, dual ESM/CJS output, semver taken
  seriously.
- `tools/test-receiver` — a small HTTP server used in integration tests and as
  a live example of verifying a webhook with the SDK.

**The rule that matters most:** nothing in `domain/` imports NestJS, Drizzle, or
BullMQ. If you find yourself importing one there, the code belongs in
`infrastructure/` instead.

## Making a change

1. Open an issue first for anything non-trivial (new feature, behavior change) —
   saves you from building something that gets redirected in review.
2. Branch off `main`.
3. Write the test first if you're fixing a bug; it should fail before your fix
   and pass after.
4. Run the full check locally before opening a PR:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. Open the PR against `main`. Link the issue it closes.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(delivery): add circuit breaker per subscriber
fix(signature): use timing-safe comparison
docs(readme): fix quickstart compose command
```

## Changing `packages/webhooks`

Any change to the published SDK needs a changeset:

```bash
npx changeset
```

Pick `patch` for bug fixes, `minor` for additive API, `major` for breaking
changes to `sign()`/`verify()`'s signature or output format. If you change the
signing algorithm, update `test-vectors.json` and `docs/SIGNATURE_SPEC.md` in
the same PR — the spec and the vectors and the code all move together.

## Tests

- Unit tests live next to the code (`*.spec.ts`).
- Integration tests use Testcontainers (real Postgres + Redis, no mocks) —
  see `apps/api/test/`.
- `tools/test-receiver` has modes (`ok`, `slow`, `500`, `429`, `flaky`) for
  exercising retry/backoff/circuit-breaker behavior end-to-end.

## Code style

ESLint + Prettier, enforced in CI. `npm run format` before committing if you're
not running it on save.

## Reporting bugs / requesting features

Use the issue templates. For security issues, see [SECURITY.md](SECURITY.md) —
please don't file those as public issues.
