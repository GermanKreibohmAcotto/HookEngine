---
'@hookengine/webhooks': minor
---

`verify()` ahora acepta un header `X-Webhook-Signature` separado por comas y
tiene éxito si cualquier entrada coincide — esto es lo que le permite a un
receptor seguir verificando exitosamente durante toda una rotación de
secreto de suscriptor, sin importar cuál de los dos secretos activos tenga
configurado en ese momento. Los headers de firma única (el caso común, fuera
de una rotación) se comportan exactamente igual que antes.
