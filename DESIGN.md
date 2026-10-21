---
name: Bitácora SECOP
description: Cuaderno de obra digital para decidir a qué licitaciones presentarse. Dirección «Wise» (2026-10): lienzo blanco verdoso, barra clara, cabeceras en verde bosque, lima como único color de acción, píldoras y titulares gruesos.
colors:
  forest-950: "#0B1F00"
  forest-900: "#163300"   # token --navy-900 (nombre heredado)
  forest-800: "#2A5410"   # token --navy-800
  ink-900: "#0E0F0C"
  ink-mute: "#454745"
  ink-faint: "#5A5E56"
  paper: "#FFFFFF"
  canvas: "#F3F6EE"
  surface-2: "#F7F9F3"
  line: "#E2E7D9"
  line-strong: "#C5CDB8"
  lime: "#9FE870"          # relleno de acción (--lime / --accent-button / --btn)
  lime-hover: "#8BD95C"
  lime-ink: "#163300"
  lime-text: "#2A5410"     # acento como texto (--accent)
  lime-soft: "#E7F5D8"
  on-forest-mute: "#C9E3B2"
  success: "#14633A"
  danger: "#A1261B"
  warning: "#7A4E08"
typography:
  ui: "Inter (400–700)"
  display: "Archivo 800–900, tracking −0.03em, interlínea ≈1 (--font-display): títulos de vista, resultado, marca"
  data: "JetBrains Mono (.mono: valores, radicados, fechas)"
radii: "12 / 16 / 24 px (--radius-sm / md / lg) y --radius-pill (999px) para botones, chips, etiquetas y menú"
---

# DESIGN.md — Bitácora SECOP

> Dirección «Wise» (2026-10-21), tomada de wise.com por petición del usuario: sustituye al rediseño «Inntegrate» (lila + azul noche).
> Wise no se pudo consultar desde el sandbox (sin red): se aplicó de memoria (lima + verde bosque, píldoras, titulares pesados).
> Los tokens `--navy-*` conservan el nombre pero ahora son verde bosque; `--lilac-*` pasó a `--lime-*`. La fuente de verdad de los valores es el bloque de tokens
> `#bitacora-root { … }` de `index.html`; este documento explica las decisiones. Los nombres de los tokens no cambiaron
> (`--accent`, `--surface`, `--bg`, `--text*`, `--success/--danger/--warning`…): cambiar el aspecto es redefinir valores.

## Principios
- **Evidencia antes que conclusión.** «Requiere verificación» (NO DETERMINABLE) debe verse tan clara como un cumplimiento.
- **Un acento, estados aparte.** El lima es la acción (botón principal, ítem de menú activo, filtro marcado); su texto es verde bosque.
  El lima NUNCA marca un resultado: GO / CUMPLE usan `--success` (verde oscuro) y siempre llevan etiqueta de texto, para que el verde de marca
  no se confunda con el verde de estado. Ámbar y rojo siguen siendo solo estados.
- **Sobrio y legible.** Nada bajo 12 px, contraste AA calculado por pruebas, texto bosque sobre el lima.
- **La forma es la marca.** Píldora en todo lo que se pulsa (botones, chips, etiquetas, menú, búsqueda); tarjetas de 24 px; campos de formulario a 12 px.

## Estructura de pantalla
- **Barra superior** clara (`.sidebar`, nombre de clase heredado; blanca con línea inferior por sombra, sin sumar alto): marca en Archivo 900 (abre Inicio) ·
  4 ítems + «Configuración y ayuda» · cuenta. Tablet (≤ 900 px): dos filas. Celular (≤ 560 px): botón desplegable en píldora. Ítem activo = píldora lima.
- **Cabecera de cada vista** (`.view-header`): degradado verde bosque `navy-900 → navy-800`, título blanco en Archivo 900 (30–44 px), subtítulo `on-navy-mute`.
  En *Mis procesos* contiene las cifras (tarjetas blancas). Los `.panel-header` de Empresa no llevan cabecera azul.
- **Contenido**: tarjetas blancas (`--surface`) sobre el lienzo `--bg`, borde `--border`, radio `--radius-lg`, sombra `--shadow-sm`.

## Componentes
- **Tarjeta de proceso** (`.row`): sin franja lateral (solo señal en alta / media / vence pronto), hover con `--shadow-md` solo con puntero fino.
- **Botones**: principal azul noche (`.btn-primary`), secundario blanco con borde; se hunden `scale(.97)` al presionar (160 ms, sin transform
  con «reducir movimiento»). 44 px de alto táctil en celular.
- **Filtros de casilla**: chips en píldora (`.toggle`, `.pipeline-filtro label`) que se pintan de lima al marcarse (`:has(input:checked)`).
- **Calendario de cierres** (`#bt-pipeline-calendario`): filas con ficha de fecha en `--accent-soft`, grupos Hoy / Mañana / 7 días / 30 días.
- **Análisis**: tarjeta de resultado (34 px, color de estado), cada sección (`.analisis-seccion`) y cada plegable (`.analysis-fold`)
  es una tarjeta; la flecha del plegable gira; el panel de evidencia entra deslizando (220 ms) y sin animación al reducir movimiento.

## Movimiento
Solo `transform` y `opacity`, ≤ 300 ms, curva `--ease-out: cubic-bezier(.23, 1, .32, 1)`. Hover solo con `(hover:hover) and (pointer:fine)`.
Nada anima acciones de teclado ni listas que se usan decenas de veces al día. `prefers-reduced-motion` apaga animaciones y deja
solo cambios de color, borde, sombra y opacidad.

## Reglas aprendidas (no repetir)
`[hidden]` pierde contra un `display` de autor; un grid sin `minmax(0,1fr)` o un `nowrap` ensanchan la página; `overflow-wrap:anywhere`
en textos de SECOP; sin `text-transform` en clases con texto dinámico; tras un cambio de tema buscar variables CSS huérfanas y fuentes
viejas dentro de los strings de JS. Cada ítem nuevo de navegación obliga a volver a medir el menú en celular.
