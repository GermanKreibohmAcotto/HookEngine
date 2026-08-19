# Webhook Signature Specification

This document describes the algorithm HookEngine uses to sign webhook
deliveries, independent of any programming language. If you're integrating in
Node.js, use [`@hookengine/webhooks`](../packages/webhooks) instead of
implementing this yourself — that package is the reference implementation,
and `apps/api` signs every real delivery with the exact same code. This spec
exists for everyone else: implementers in other languages, and anyone who
wants to understand or audit what the SDK does under the hood.

If your implementation doesn't produce the same output as
[`test-vectors.json`](../packages/webhooks/test-vectors.json) for the same
inputs, it's wrong — treat the vectors as the source of truth over this prose
if the two ever disagree.

## Headers

Every delivery request carries:

| Header                | Description                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `X-Webhook-Id`        | The delivery's unique ID (not the event ID — the same event can produce multiple deliveries, one per subscriber) |
| `X-Webhook-Event`     | The event type string, e.g. `order.created`                                                                      |
| `X-Webhook-Timestamp` | Unix time in **seconds** (not milliseconds) when the request was signed                                          |
| `X-Webhook-Signature` | `v1=<hex-encoded HMAC-SHA256>` — see [Secret rotation](#secret-rotation) for when this carries more than one     |

## Signing algorithm

1. Let `payload` be the exact raw bytes of the request body, UTF-8 encoded,
   as they will be transmitted — not a re-serialization of a parsed object.
   Serialize once, sign that exact string, send that exact string.
2. Let `timestamp` be the current Unix time in seconds.
3. Build the signed content by joining the two with a literal `.`:

   ```
   signed_content = "{timestamp}.{payload}"
   ```

4. Compute the digest:

   ```
   digest = HMAC-SHA256(key = subscriber_secret, message = signed_content)
   ```

   `digest` is the raw HMAC output, hex-encoded (lowercase, 64 characters).

5. The header value is the digest prefixed with a version tag:

   ```
   X-Webhook-Signature = "v1=" + digest
   ```

   The `v1=` prefix exists so the algorithm can change in the future
   (`v2=...`) without breaking verifiers that check for a known prefix and
   ignore signatures they don't recognize.

## Verifying algorithm

1. Read `X-Webhook-Timestamp` and `X-Webhook-Signature` from the request.
2. Parse the timestamp as an integer. Reject if it isn't one.
3. **Replay protection:** reject if `|now - timestamp| > tolerance`, where
   `now` is the verifier's current Unix time in seconds and `tolerance`
   defaults to `300` (5 minutes). A signature for a request from an hour ago
   being replayed today should not verify.
4. Strip the `v1=` prefix from `X-Webhook-Signature`. Reject if the prefix
   isn't present — an unrecognized version means an unrecognized algorithm,
   not a signature to fall back and check anyway.
5. Recompute `digest` using the exact algorithm above, with the **raw request
   body you received** as `payload` — not a value you got by parsing the body
   as JSON and re-stringifying it. Those are not guaranteed to produce the
   same bytes (key order, whitespace, number formatting can all differ), and
   a mismatch there is the most common cause of "valid signatures fail to
   verify."
6. Compare the recomputed digest to the one from the header **in constant
   time** (e.g. `crypto.timingSafeEqual` in Node, `hmac.compare_digest` in
   Python, `subtle.ConstantTimeCompare` in Go). A standard `==`/`===` string
   comparison short-circuits on the first differing byte, which leaks timing
   information an attacker can use to forge a valid signature one byte at a
   time. This is a real, practical attack against naive implementations —
   not a theoretical one.
7. The request is valid only if steps 3 and 6 both pass.

## Secret rotation

When a subscriber's secret is rotated, HookEngine keeps signing with the old
secret alongside the new one for a grace period (`SECRET_ROTATION_GRACE_PERIOD_MS`,
24 hours by default). During that window, `X-Webhook-Signature` carries both
signatures, comma-separated:

```
X-Webhook-Signature: v1=<hex signed with the new secret>, v1=<hex signed with the old secret>
```

Verify by checking whether **any** comma-separated entry matches the digest
you compute with your currently-configured secret — `verify()` in the SDK
already does this. This is what lets you update your configured secret at any
point during the grace period without a delivery ever failing to verify:
whichever secret you have, one of the two entries will match it.

Outside a rotation, the header has exactly one entry and behaves exactly as
described above.

## Common pitfalls

- **Re-serializing the body before verifying.** Read the raw request body as
  a string/bytes and pass that directly to the verifier. Don't run it through
  your framework's JSON body parser and re-`JSON.stringify` it — most
  languages don't guarantee stable key ordering or number formatting through
  a parse/stringify round trip, and any difference breaks the signature.
- **Comparing digests with a non-constant-time equality check.** See step 6.
- **Treating the timestamp as milliseconds.** It's seconds, matching Unix
  `time()` — not JavaScript's `Date.now()`.
- **Skipping the timestamp check entirely.** Without it, a captured request
  can be replayed indefinitely.

## Test vectors

[`packages/webhooks/test-vectors.json`](../packages/webhooks/test-vectors.json)
contains fixed `(secret, timestamp, payload)` tuples with their expected
`X-Webhook-Signature` value. Run your implementation against every vector in
that file before trusting it against real traffic.
