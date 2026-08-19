# @hookengine/webhooks

Sign and verify [HookEngine](https://github.com/hookengine/hookengine) webhook
payloads. Zero runtime dependencies, dual ESM/CJS, full TypeScript types.

This is the exact code HookEngine itself uses to sign every delivery — not a
reimplementation kept in sync by hand.

## Install

```bash
npm install @hookengine/webhooks
```

## Verify an incoming webhook

```ts
import { verify } from '@hookengine/webhooks';

const ok = verify({
  payload: rawRequestBody, // the exact raw bytes you received — not a re-serialized object
  secret: subscriberSecret,
  signatureHeader: req.headers['x-webhook-signature'],
  timestampHeader: req.headers['x-webhook-timestamp'],
});

if (!ok) {
  return res.status(401).send('invalid signature');
}
```

`verify()` never throws — malformed input just fails verification. By
default it rejects timestamps more than 5 minutes old or in the future
(replay protection); override with `toleranceSeconds` if you need a wider
window.

## Sign a payload

Most consumers only need `verify`. `sign` is exported for completeness and
for testing your own verifier against known inputs:

```ts
import { sign } from '@hookengine/webhooks';

const { timestamp, signature } = sign({ payload: rawBody, secret });
```

## No SDK for your language?

[`test-vectors.json`](./test-vectors.json) has fixed
`(secret, timestamp, payload)` tuples with their expected signature — run
your own implementation against them before trusting it against real
traffic. [`docs/SIGNATURE_SPEC.md`](https://github.com/hookengine/hookengine/blob/main/docs/SIGNATURE_SPEC.md)
describes the algorithm in prose, independent of any language.

## License

Apache-2.0
