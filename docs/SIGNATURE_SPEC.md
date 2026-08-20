# Especificación de firma de webhooks

Este documento describe el algoritmo que usa HookEngine para firmar las
entregas de webhooks, independiente de cualquier lenguaje de programación.
Si estás integrando en Node.js, usá [`@hookengine/webhooks`](../packages/webhooks)
en vez de implementar esto vos mismo — ese paquete es la implementación de
referencia, y `apps/api` firma cada entrega real con exactamente el mismo
código. Esta spec existe para todos los demás: implementadores en otros
lenguajes, y cualquiera que quiera entender o auditar qué hace el SDK por dentro.

Si tu implementación no produce la misma salida que
[`test-vectors.json`](../packages/webhooks/test-vectors.json) para las mismas
entradas, está mal — tratá los vectores como fuente de verdad por sobre esta
prosa si alguna vez discrepan.

## Headers

Cada request de entrega lleva:

| Header                | Descripción                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `X-Webhook-Id`        | El ID único de la entrega (no el ID del evento — el mismo evento puede producir varias entregas, una por suscriptor) |
| `X-Webhook-Event`     | El string del tipo de evento, ej. `order.created`                                                                    |
| `X-Webhook-Timestamp` | Tiempo Unix en **segundos** (no milisegundos) de cuándo se firmó el request                                          |
| `X-Webhook-Signature` | `v1=<HMAC-SHA256 en hex>` — ver [Rotación de secretos](#rotación-de-secretos) para cuándo lleva más de una firma     |

## Algoritmo de firmado

1. Sea `payload` los bytes crudos exactos del cuerpo del request, codificados
   en UTF-8, tal como se van a transmitir — no una re-serialización de un
   objeto parseado. Serializá una vez, firmá ese string exacto, enviá ese
   string exacto.
2. Sea `timestamp` el tiempo Unix actual en segundos.
3. Construí el contenido firmado uniendo ambos con un `.` literal:

   ```
   signed_content = "{timestamp}.{payload}"
   ```

4. Calculá el digest:

   ```
   digest = HMAC-SHA256(key = subscriber_secret, message = signed_content)
   ```

   `digest` es la salida cruda del HMAC, codificada en hex (minúsculas, 64 caracteres).

5. El valor del header es el digest con un prefijo de versión:

   ```
   X-Webhook-Signature = "v1=" + digest
   ```

   El prefijo `v1=` existe para que el algoritmo pueda cambiar en el futuro
   (`v2=...`) sin romper a los verificadores que chequean un prefijo conocido
   e ignoran las firmas que no reconocen.

## Algoritmo de verificación

1. Leé `X-Webhook-Timestamp` y `X-Webhook-Signature` del request.
2. Parseá el timestamp como entero. Rechazá si no lo es.
3. **Protección contra replay:** rechazá si `|now - timestamp| > tolerance`,
   donde `now` es el tiempo Unix actual del verificador en segundos y
   `tolerance` por defecto es `300` (5 minutos). Una firma de un request de
   hace una hora que se reproduce hoy no debería verificar.
4. Sacá el prefijo `v1=` de `X-Webhook-Signature`. Rechazá si el prefijo no
   está presente — una versión no reconocida significa un algoritmo no
   reconocido, no una firma para chequear igual como fallback.
5. Recalculá `digest` usando el algoritmo exacto de arriba, con el **cuerpo
   crudo del request que recibiste** como `payload` — no un valor que
   obtuviste parseando el cuerpo como JSON y re-serializándolo. Eso no
   garantiza producir los mismos bytes (el orden de claves, el whitespace, el
   formato de números pueden diferir), y un desajuste ahí es la causa más
   común de "firmas válidas que fallan al verificar".
6. Comparé el digest recalculado con el del header **en tiempo constante**
   (ej. `crypto.timingSafeEqual` en Node, `hmac.compare_digest` en Python,
   `subtle.ConstantTimeCompare` en Go). Una comparación de strings estándar
   `==`/`===` corta apenas encuentra el primer byte distinto, lo que filtra
   información de timing que un atacante puede usar para forjar una firma
   válida byte a byte. Este es un ataque real y práctico contra
   implementaciones ingenuas — no es teórico.
7. El request es válido sólo si los pasos 3 y 6 pasan ambos.

## Rotación de secretos

Cuando se rota el secreto de un suscriptor, HookEngine sigue firmando con el
secreto viejo junto al nuevo durante un período de gracia
(`SECRET_ROTATION_GRACE_PERIOD_MS`, 24 horas por defecto). Durante esa
ventana, `X-Webhook-Signature` lleva ambas firmas, separadas por coma:

```
X-Webhook-Signature: v1=<hex firmado con el secreto nuevo>, v1=<hex firmado con el secreto viejo>
```

Verificá chequeando si **cualquiera** de las entradas separadas por coma
coincide con el digest que calculás con tu secreto configurado actualmente —
`verify()` en el SDK ya hace esto. Esto es lo que te permite actualizar tu
secreto configurado en cualquier momento durante el período de gracia sin que
una entrega falle jamás al verificar: cualquiera de los dos secretos que
tengas, una de las dos entradas va a coincidir.

Fuera de una rotación, el header tiene exactamente una entrada y se comporta
exactamente como se describió arriba.

## Errores comunes

- **Re-serializar el cuerpo antes de verificar.** Leé el cuerpo crudo del
  request como string/bytes y pasáselo directamente al verificador. No lo
  hagas pasar por el parser JSON de tu framework y lo vuelvas a
  `JSON.stringify` — la mayoría de los lenguajes no garantiza un orden de
  claves ni un formato de números estable a través de un ida y vuelta de
  parse/stringify, y cualquier diferencia rompe la firma.
- **Comparar digests con un chequeo de igualdad que no es de tiempo constante.** Ver paso 6.
- **Tratar el timestamp como milisegundos.** Son segundos, como el `time()`
  de Unix — no el `Date.now()` de JavaScript.
- **Saltearse el chequeo de timestamp por completo.** Sin él, un request
  capturado se puede reproducir indefinidamente.

## Vectores de prueba

[`packages/webhooks/test-vectors.json`](../packages/webhooks/test-vectors.json)
contiene tuplas fijas `(secret, timestamp, payload)` con su valor esperado de
`X-Webhook-Signature`. Corré tu implementación contra cada vector de ese
archivo antes de confiar en ella contra tráfico real.
