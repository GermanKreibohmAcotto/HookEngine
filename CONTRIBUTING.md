# Contribuir a HookEngine

Gracias por tomarte el tiempo de contribuir. Este documento cubre el setup
local, las convenciones, y cómo un cambio llega desde tu máquina hasta `main`.

## Setup local

Requisitos: Node.js 22+, Docker + Docker Compose.

```bash
git clone https://github.com/germankreibohmacotto/hookengine.git
cd hookengine
cp .env.example .env          # después editá los secretos generados, ver abajo
npm install
docker compose up -d postgres redis
npm run db:migrate -w apps/api
npm run dev -w apps/api       # o: docker compose up --build
```

Generá valores reales para los dos secretos en `.env` antes de arrancar nada:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"  # SECRET_ENCRYPTION_KEY
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"  # INGEST_API_KEY
```

## Organización del proyecto

Esto es un monorepo (npm workspaces). Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
para el panorama completo; la versión corta:

- `apps/api` — backend NestJS. Dos entrypoints (`main.http.ts`, `main.worker.ts`)
  que comparten un mismo código. Cada módulo de dominio (`delivery`, `subscriptions`, `events`)
  se divide en `domain/` (sin framework), `application/` (casos de uso + puertos)
  e `infrastructure/` (adaptadores — Drizzle, BullMQ, undici, controllers).
- `apps/web` — el panel de administración (Vite + React).
- `packages/webhooks` — el SDK público `@hookengine/webhooks`. Se publica
  en npm, así que los cambios acá necesitan un changeset (ver abajo) y se
  sostienen contra una vara más exigente: cero dependencias en runtime,
  salida dual ESM/CJS, semver tomado en serio.
- `tools/test-receiver` — un servidor HTTP chico usado en tests de integración
  y como ejemplo vivo de verificación de un webhook con el SDK.

**La regla que más importa:** nada en `domain/` importa NestJS, Drizzle ni
BullMQ. Si te encontrás importando alguno ahí, ese código pertenece a
`infrastructure/`.

## Hacer un cambio

1. Abrí un issue primero para cualquier cosa no trivial (feature nueva, cambio
   de comportamiento) — te ahorra construir algo que termine redirigido en la review.
2. Ramificá desde `main`.
3. Escribí el test primero si estás arreglando un bug; tiene que fallar antes
   de tu fix y pasar después.
4. Corré el chequeo completo localmente antes de abrir un PR:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. Abrí el PR contra `main`. Enlazá el issue que cierra.

## Mensajes de commit

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(delivery): add circuit breaker per subscriber
fix(signature): use timing-safe comparison
docs(readme): fix quickstart compose command
```

## Modificar `packages/webhooks`

Cualquier cambio al SDK publicado necesita un changeset:

```bash
npx changeset
```

Elegí `patch` para bug fixes, `minor` para API aditiva, `major` para cambios
que rompan la firma o el formato de salida de `sign()`/`verify()`. Si cambiás
el algoritmo de firmado, actualizá `test-vectors.json` y `docs/SIGNATURE_SPEC.md`
en el mismo PR — la spec, los vectores y el código se mueven juntos.

## Tests

- Los tests unitarios viven al lado del código (`*.spec.ts`).
- Los tests de integración usan Testcontainers (Postgres + Redis reales, sin mocks) —
  ver `apps/api/test/`.
- `tools/test-receiver` tiene modos (`ok`, `slow`, `500`, `429`, `flaky`) para
  ejercitar el comportamiento de reintentos/backoff/circuit-breaker de punta a punta.

## Estilo de código

ESLint + Prettier, aplicado en CI. Corré `npm run format` antes de commitear
si no lo corrés al guardar.

## Reportar bugs / pedir funcionalidades

Usá las plantillas de issue. Para problemas de seguridad, ver [SECURITY.md](SECURITY.md) —
por favor no los reportes como issues públicos.
