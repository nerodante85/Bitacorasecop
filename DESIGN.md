---
name: Bitácora SECOP
description: Cuaderno de obra digital para decidir a qué licitaciones presentarse. Tema claro «Inntegrate»: lienzo gris azulado, barra y cabeceras en azul noche, un acento lila y color de estado solo para avisos.
colors:
  navy-950: "#0A0E26"
  navy-900: "#0E1330"
  navy-800: "#1A2352"
  ink-900: "#151A33"
  ink-mute: "#555C79"
  ink-faint: "#5F6684"
  paper: "#FFFFFF"
  canvas: "#F1F3F8"
  surface-2: "#F5F6FB"
  line: "#E3E6F0"
  line-strong: "#CBD0E0"
  lilac: "#5B2FC9"
  lilac-hover: "#4A22AD"
  lilac-soft: "#EFE8FF"
  lilac-fill: "#C9B0FF"
  lilac-ink: "#1E0F4D"
  on-navy: "#FFFFFF"
  on-navy-mute: "#B4BCE0"
  success: "#14633A"
  danger: "#A1261B"
  warning: "#7A4E08"
typography:
  ui: "Mulish (400–800)"
  data: "JetBrains Mono (.mono: valores, radicados, fechas)"
  wordmark: "Space Grotesk (solo «Bitácora SECOP»)"
radii: "10 / 14 / 20 px (--radius-sm / md / lg)"
---

# DESIGN.md — Bitácora SECOP

> Reescrito al cerrar el rediseño «Inntegrate» (2026-10, fases 1–4). La fuente de verdad de los valores es el bloque de tokens
> `#bitacora-root { … }` de `index.html`; este documento explica las decisiones. Los nombres de los tokens no cambiaron
> (`--accent`, `--surface`, `--bg`, `--text*`, `--success/--danger/--warning`…): cambiar el aspecto es redefinir valores.

## Principios
- **Evidencia antes que conclusión.** «Requiere verificación» (NO DETERMINABLE) debe verse tan clara como un cumplimiento.
- **Un acento, estados aparte.** El lila es la marca (enlaces, filtro activo, ficha de fecha); verde / ámbar / rojo son estados
  semánticos y **no cambian con la marca**. El ámbar ya no es el acento: queda para avisos y plazos.
- **Sobrio y legible.** Nada bajo 12 px, contraste AA calculado por pruebas, sin radios de píldora, texto oscuro sobre relleno de estado.

## Estructura de pantalla
- **Barra superior** azul noche (`.sidebar`, nombre de clase heredado): marca (abre Inicio) · 4 ítems + «Configuración y ayuda» · cuenta.
  Tablet (≤ 900 px): dos filas. Celular (≤ 560 px): botón desplegable. Ítem activo = relleno lila.
- **Cabecera de cada vista** (`.view-header`): degradado `navy-900 → navy-800`, título blanco 700, subtítulo `on-navy-mute`.
  En *Mis procesos* contiene las cifras (tarjetas blancas). Los `.panel-header` de Empresa no llevan cabecera azul.
- **Contenido**: tarjetas blancas (`--surface`) sobre el lienzo `--bg`, borde `--border`, radio `--radius-lg`, sombra `--shadow-sm`.

## Componentes
- **Tarjeta de proceso** (`.row`): sin franja lateral (solo señal en alta / media / vence pronto), hover con `--shadow-md` solo con puntero fino.
- **Botones**: principal azul noche (`.btn-primary`), secundario blanco con borde; se hunden `scale(.97)` al presionar (160 ms, sin transform
  con «reducir movimiento»). 44 px de alto táctil en celular.
- **Filtros de casilla**: chips (`.toggle`, `.pipeline-filtro label`) que se pintan de `--accent-button` al marcarse (`:has(input:checked)`).
- **Calendario de cierres** (`#bt-pipeline-calendario`): filas con ficha lila de fecha, grupos Hoy / Mañana / 7 días / 30 días.
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
