# Security Policy

HookEngine handles HMAC signing secrets, encrypted-at-rest subscriber credentials,
and makes outbound HTTP requests to URLs supplied by API clients. Bugs here can
have real consequences (secret leakage, SSRF, request forgery, signature bypass).
We take reports seriously and ask that you do too.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Report privately through one of these channels:

1. [GitHub Security Advisories](https://github.com/hookengine/hookengine/security/advisories/new)
   for this repository (preferred — keeps the discussion and any fix confidential
   until a release is ready).
2. If GitHub Advisories isn't reachable for you, contact a maintainer directly
   through the address listed on their GitHub profile and mark the message
   `[SECURITY]`.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal repro is ideal — e.g. a `curl` request or a
  small script against a local `docker compose up`).
- The affected version/commit.

## What to expect

- **Acknowledgement:** within 3 business days.
- **Triage & severity assessment:** within 7 business days of acknowledgement.
- **Fix or mitigation:** timeline depends on severity; we'll keep you updated
  throughout and credit you in the advisory (unless you'd prefer anonymity).

## Scope

In scope:

- The `apps/api` HTTP ingestion and worker processes.
- The `@hookengine/webhooks` SDK (`packages/webhooks`), especially the
  signing/verification code.
- The SSRF guard on subscriber `target_url` registration.
- The Docker images published under this repository.

Out of scope:

- Vulnerabilities in third-party dependencies — please report those upstream
  (though we'd appreciate a heads-up so we can pin a patched version).
- Findings that require an attacker to already have valid `INGEST_API_KEY` or
  database access — at that point the deployment is already compromised.

## Supported versions

Until the first `1.0.0` release, only the latest tagged release on the `main`
branch receives security fixes.
