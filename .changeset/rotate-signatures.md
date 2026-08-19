---
'@hookengine/webhooks': minor
---

`verify()` now accepts a comma-separated `X-Webhook-Signature` header and
succeeds if any entry matches — this is what lets a receiver keep verifying
successfully throughout a subscriber secret rotation, regardless of which of
the two active secrets it currently has configured. Single-signature headers
(the common case, outside a rotation) behave exactly as before.
