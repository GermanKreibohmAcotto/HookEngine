# Sistema de diseño — Deep Infrastructure Dark

El dashboard (`apps/web`) usa un sistema de diseño llamado **Deep Infrastructure
Dark**, pensado para entornos de infraestructura y paneles administrativos
densos en datos: estética Corporate/Modern, dark-mode-only, acentos de alto
contraste sobre un fondo casi negro para guiar el ojo hacia las métricas y
acciones importantes.

Los nombres de los tokens siguen la convención de **Material Design 3**
(`surface`, `on-surface`, `surface-container-high`, `primary`,
`on-primary`, `outline-variant`, …). Si no te resulta familiar: el prefijo
`on-` siempre significa "el color de texto/ícono que va *encima* de ese
fondo" — `on-primary` es el color de texto correcto sobre un fondo
`primary`, no una variante de `primary`.

Todos los tokens viven en [`apps/web/src/index.css`](../apps/web/src/index.css),
en un bloque `@theme` de Tailwind v4. Si estás agregando UI nueva, usá estas
clases (`bg-surface-container`, `text-on-surface-variant`, `font-label-md`,
…) en vez de la paleta por defecto de Tailwind (`slate-*`, `gray-*`) o
valores hardcodeados.

## De dónde viene esto

El diseño llegó como un export de [Stitch](https://stitch.withgoogle.com/)
con las cuatro pantallas ya maquetadas. Ese export trae dos fuentes que no
siempre coinciden: un `DESIGN.md` en prosa, y el `tailwind.config` de
Tailwind v3 realmente embebido en el HTML que generó las capturas. Donde
discrepan, **el código embebido gana** — es lo que efectivamente se
renderizó. Ejemplos concretos de la divergencia:

- La prosa dice que las tarjetas usan `rounded-lg` a 16px; el config real
  define `lg: 0.5rem` (8px) y las tarjetas en el HTML usan `rounded-xl`
  (0.75rem, 12px).
- La prosa dice que los chips de estado usan 15% de opacidad; el HTML real
  usa `/10` (10%) de forma consistente.
- La prosa no menciona verde ni ámbar en absoluto; el HTML real usa
  `#4ade80` y `#fbbf24` como valores hex sueltos para éxito/reintento — no
  forman parte de la paleta Material 3 importada. Se promovieron a tokens
  con nombre (`--color-success`, `--color-warning`) para no repetir hex
  sueltos por todo el código.

Tailwind v4 no usa `tailwind.config.js` — la configuración se declara en CSS
dentro de `@theme`. La tabla de abajo es la traducción del config v3 del
export a la sintaxis v4 que efectivamente usa este proyecto.

## Color

| Token | Hex | Uso |
|---|---|---|
| `surface` / `background` | `#131313` | Fondo base de la página |
| `surface-container-lowest` | `#0e0e0e` | El nivel más oscuro — bloques de código, inputs |
| `surface-container-low` | `#1c1b1b` | Sidebar, tarjetas de contenido principal |
| `surface-container` | `#201f1f` | Tarjetas secundarias |
| `surface-container-high` | `#2a2a2a` | Modales, elementos interactivos, hover |
| `surface-container-highest` | `#353534` | Chips activos, barras de progreso (track) |
| `on-surface` | `#e5e2e1` | Texto principal |
| `on-surface-variant` | `#c7c4d7` | Texto secundario |
| `outline-variant` | `#464555` | Bordes sutiles, divisores, estado "inactivo" |
| `primary` | `#c1c1ff` | Acento de marca — nav activa, botones primarios, estado "en vivo" |
| `on-primary` | `#1200a9` | Texto sobre `primary` |
| `secondary-container` | `#3d3e87` | Fondo del ítem de navegación activo |
| `error` | `#ffb4ab` | Estados críticos/destructivos (DLQ, eliminar) |
| `success` *(agregado)* | `#4ade80` | Chip de estado "exitosa" — no es parte de la paleta M3 |
| `warning` *(agregado)* | `#fbbf24` | Chip de estado "fallida"/reintentando — no es parte de la paleta M3 |

**Convención de chips de estado:** fondo al 10% de opacidad + texto al 100%,
más un puntito del mismo color (`bg-{color}/10 text-{color}` + `<span
class="bg-{color}">`). Ver [`StatusBadge.tsx`](../apps/web/src/components/ui/StatusBadge.tsx).

**No hay theming claro.** El diseño es dark-only; no hay tokens de modo
claro ni se planea agregarlos.

## Tipografía

Dos familias, cargadas self-hosted vía `@fontsource` (ver más abajo):

- **Plus Jakarta Sans** — headlines y body copy (`font-headline-*`, `font-body-*`).
- **Geist Sans** — labels, datos alfanuméricos, texto denso en tablas (`font-label-*`).

Cada clase `text-{nombre}` empaqueta tamaño, line-height, letter-spacing y
peso en una sola utilidad (característica de Tailwind v4: los tokens
`--text-*` admiten los sufijos `--line-height`, `--letter-spacing` y
`--font-weight`). Se usa junto con la clase `font-{nombre}` para la familia:

```html
<h1 class="font-headline-lg text-headline-lg text-on-surface">Suscriptores</h1>
```

| Clase | Tamaño | Uso |
|---|---|---|
| `headline-xl` | 32px / 700 | Reservado para un hero grande; no usado hoy |
| `headline-lg` | 24px / 600 | Título de página (`<h1>`) |
| `headline-md` | 20px / 600 | Título de tarjeta/sección, título de modal |
| `body-lg` | 16px / 400 | Copy destacado |
| `body-md` | 14px / 400 | Texto de cuerpo por defecto |
| `body-sm` | 12px / 400 | Texto secundario chico |
| `label-md` | 13px / 500 | Botones, celdas de tabla, chips |
| `label-sm` | 11px / 600 | Headers de tabla (uppercase), badges |

## Espaciado y forma

```
--spacing-container-padding: 24px   /* padding horizontal del contenido principal */
--spacing-gutter-lg: 24px           /* gap entre columnas del grid de escritorio */
--spacing-gutter-md: 16px
--spacing-card-gap: 20px            /* gap entre tarjetas en un grid */
--spacing-section-margin: 32px      /* separación vertical entre secciones */
```

Radios (verificados contra el HTML real, no contra la prosa del `DESIGN.md`):

| Clase | Valor | Uso |
|---|---|---|
| `rounded-lg` | 8px | Botones |
| `rounded-xl` | 12px | Tarjetas, tiles de métrica, modales |
| `rounded-full` | — | Chips de estado, avatares, indicador "en vivo" |

## Layout

- **Sidebar fijo** de 256px (`w-64`), sin colapsar — el dashboard no tiene
  suficientes secciones como para justificar un modo compacto.
- **Topbar fijo** de 64px con `backdrop-blur`, breadcrumb a la izquierda,
  indicador de conexión SSE a la derecha.
- **Grid de 12 columnas** en desktop con `gutter-lg` (24px); las tarjetas de
  métrica ocupan 1 de 4 o 1 de 2 columnas según la página.
- **Sin scrollbar visible** en `::-webkit-scrollbar` — es intencional, no un
  bug: reduce el ruido visual en un panel con muchas tablas largas.

## Íconos

El diseño original usa **Material Symbols**, pero ese paquete pesa ~13MB y
no se puede tree-shakear (una fuente de íconos se descarga completa aunque
uses cuatro glifos). Este proyecto usa
[**lucide-react**](https://lucide.dev) en su lugar: mismo lenguaje visual
outlined/geométrico, pero es ESM real — sólo entra al bundle lo que
importás. `lucide-react` trae `Webhook` como ícono, el mismo glifo que usa
la marca en el diseño original.

## Fuentes: por qué self-hosted

Las fuentes se instalan como dependencias npm (`@fontsource/plus-jakarta-sans`,
`@fontsource/geist-sans`) en vez de cargarse desde `fonts.googleapis.com`
como en el export original. HookEngine es software self-hosted que se
despliega típicamente detrás de VPN o en redes sin salida a internet — un
`<link>` a un CDN externo rompe el panel en ese escenario y, en el resto,
filtra la IP de cada usuario que abre el dashboard a un tercero en cada
carga de página. Sólo se importan los pesos que realmente se usan (400/600/700
de Plus Jakarta Sans, 500/600 de Geist Sans) para no inflar el bundle con
variantes sin uso.

## Qué NO se adoptó del diseño original

El export de Stitch incluye UI que no tiene datos reales detrás en HookEngine
hoy: deltas de tendencia (`+12% vs last week`), tasa de recuperación de la
DLQ, tiempo promedio de fallo, un perfil de usuario con plan ("Pro Plan"),
notificaciones, búsqueda global de texto libre, y botones de exportar/purgar
sin endpoint. Se dejaron afuera deliberadamente — mostrar un número o un
botón sin datos o función reales es peor que no mostrarlo. Si en algún
momento se agregan esos endpoints, la UI para mostrarlos ya está diseñada
en el export original en `resumen_hookengine/`, `entregas_hookengine/`,
`suscriptores_hookengine/` y `mensajes_muertos_hookengine/` — no hace falta
rediseñar, sólo conectar datos reales.
