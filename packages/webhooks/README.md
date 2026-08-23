# @hookengine/webhooks

Firmá y verificá payloads de webhooks de [HookEngine](https://github.com/germankreibohmacotto/hookengine).
Cero dependencias en runtime, dual ESM/CJS, tipos de TypeScript completos.

Este es exactamente el mismo código que HookEngine usa para firmar cada
entrega — no una reimplementación que se mantiene sincronizada a mano.

## Instalación

```bash
npm install @hookengine/webhooks
```

## Verificar un webhook entrante

```ts
import { verify } from '@hookengine/webhooks';

const ok = verify({
  payload: rawRequestBody, // los bytes crudos exactos que recibiste — no un objeto re-serializado
  secret: subscriberSecret,
  signatureHeader: req.headers['x-webhook-signature'],
  timestampHeader: req.headers['x-webhook-timestamp'],
});

if (!ok) {
  return res.status(401).send('invalid signature');
}
```

`verify()` nunca lanza excepciones — una entrada malformada simplemente falla
la verificación. Por defecto rechaza timestamps con más de 5 minutos de
antigüedad o en el futuro (protección contra replay); sobreescribí con
`toleranceSeconds` si necesitás una ventana más amplia.

## Firmar un payload

La mayoría de los consumidores sólo necesita `verify`. `sign` se exporta por
completitud y para testear tu propio verificador contra entradas conocidas:

```ts
import { sign } from '@hookengine/webhooks';

const { timestamp, signature } = sign({ payload: rawBody, secret });
```

## ¿No hay SDK para tu lenguaje?

[`test-vectors.json`](./test-vectors.json) tiene tuplas fijas
`(secret, timestamp, payload)` con su firma esperada — corré tu propia
implementación contra ellas antes de confiar en ella contra tráfico real.
[`docs/SIGNATURE_SPEC.md`](https://github.com/germankreibohmacotto/hookengine/blob/main/docs/SIGNATURE_SPEC.md)
describe el algoritmo en prosa, independiente de cualquier lenguaje.

## Licencia

Apache-2.0
