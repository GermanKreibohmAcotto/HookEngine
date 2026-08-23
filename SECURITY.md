# Política de seguridad

HookEngine maneja secretos de firmado HMAC, credenciales de suscriptor
cifradas en reposo, y hace requests HTTP salientes a URLs provistas por
clientes de la API. Los bugs acá pueden tener consecuencias reales (fuga de
secretos, SSRF, falsificación de requests, bypass de firma). Nos tomamos en
serio los reportes y te pedimos que vos también.

## Reportar una vulnerabilidad

**No abras un issue público de GitHub para reportes de seguridad.**

Reportá en privado por uno de estos canales:

1. [GitHub Security Advisories](https://github.com/germankreibohmacotto/hookengine/security/advisories/new)
   de este repositorio (preferido — mantiene la discusión y cualquier fix
   confidenciales hasta que haya un release listo).
2. Si GitHub Advisories no es accesible para vos, contactá directamente a
   un maintainer a través de la dirección listada en su perfil de GitHub y
   marcá el mensaje `[SECURITY]`.

Por favor incluí:

- Una descripción de la vulnerabilidad y su impacto.
- Pasos para reproducirla (un repro mínimo es ideal — por ejemplo un request
  `curl` o un script chico contra un `docker compose up` local).
- La versión/commit afectados.

## Qué esperar

- **Confirmación de recepción:** dentro de 3 días hábiles.
- **Triage y evaluación de severidad:** dentro de 7 días hábiles desde la confirmación.
- **Fix o mitigación:** el plazo depende de la severidad; te vamos a mantener
  al tanto durante todo el proceso y te vamos a acreditar en el advisory
  (salvo que prefieras anonimato).

## Alcance

Dentro de alcance:

- Los procesos de ingesta HTTP y de worker en `apps/api`.
- El SDK `@hookengine/webhooks` (`packages/webhooks`), especialmente el
  código de firmado/verificación.
- El guard SSRF sobre el registro de `target_url` de suscriptores.
- Las imágenes Docker publicadas bajo este repositorio.

Fuera de alcance:

- Vulnerabilidades en dependencias de terceros — por favor reportalas upstream
  (aunque agradecemos el aviso para poder fijar una versión parcheada).
- Hallazgos que requieran que un atacante ya tenga un `INGEST_API_KEY` válido
  o acceso a la base de datos — en ese punto el deployment ya está comprometido.

## Versiones soportadas

Hasta el primer release `1.0.0`, sólo el último release taggeado en la rama
`main` recibe fixes de seguridad.
