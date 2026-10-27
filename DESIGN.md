---
name: Bitácora SECOP
description: Cuaderno de obra digital para decidir a qué licitaciones presentarse. Dirección «Wise» (2026-10) con la paleta «Obra» (2026-10-24): lienzo gris azulado, barra clara, cabeceras en azul pizarra, amarillo señal como único color de acción, píldoras y titulares gruesos.
colors:
  slate-950: "#0F1822"
  slate-900: "#16212E"    # token --navy-900 (nombre heredado)
  slate-800: "#223246"    # token --navy-800
  ink-900: "#16212E"
  ink-mute: "#465264"
  ink-faint: "#586478"
  paper: "#FFFFFF"
  canvas: "#F3F5F7"
  surface-2: "#EEF1F4"
  line: "#D9DEE5"
  line-strong: "#B3BDC9"
  lime: "#F2B705"          # amarillo señal: relleno de acción (el token conserva el nombre --lime / --accent-button / --btn)
  lime-hover: "#DDA504"
  lime-ink: "#16212E"
  lime-text: "#223246"     # acento como texto (--accent)
  lime-soft: "#FDF1C7"
  on-slate-mute: "#C5D0DD"
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
> Los tokens `--navy-*` conservan el nombre pero ahora son azul pizarra; `--lime-*` conserva el nombre pero ahora es amarillo señal (paleta «Obra», elegida por el usuario sobre la forma Wise, 2026-10-24). La fuente de verdad de los valores es el bloque de tokens
> `#bitacora-root { … }` de `app.html`; este documento explica las decisiones. Los nombres de los tokens no cambiaron
> (`--accent`, `--surface`, `--bg`, `--text*`, `--success/--danger/--warning`…): cambiar el aspecto es redefinir valores.

## Principios
- **Evidencia antes que conclusión.** «Requiere verificación» (NO DETERMINABLE) debe verse tan clara como un cumplimiento.
- **Un acento, estados aparte.** El amarillo señal es la acción (botón principal, ítem de menú activo, filtro marcado); su texto es azul pizarra.
  El amarillo NUNCA marca un resultado: GO / CUMPLE usan `--success` (verde oscuro) y siempre llevan etiqueta de texto, para que el verde de marca
  no se confunda con el verde de estado. Ámbar y rojo siguen siendo solo estados.
- **Sobrio y legible.** Nada bajo 12 px, contraste AA calculado por pruebas, texto pizarra sobre el amarillo.
- **La forma es la marca.** Píldora en todo lo que se pulsa (botones, chips, etiquetas, menú, búsqueda); tarjetas de 24 px; campos de formulario a 12 px.

## Estructura de pantalla
- **Barra superior** clara (`.sidebar`, nombre de clase heredado; blanca con línea inferior por sombra, sin sumar alto): marca en Archivo 900 (abre Inicio) ·
  4 ítems + «Configuración y ayuda» · cuenta. Tablet (≤ 900 px): dos filas. Celular (≤ 560 px): botón desplegable en píldora. Ítem activo = píldora amarilla.
- **Cabecera de cada vista** (`.view-header`): degradado azul pizarra `navy-900 → navy-800`, título blanco en Archivo 900 (30–44 px), subtítulo `on-navy-mute`.
  En *Mis procesos* contiene las cifras (tarjetas blancas). Los `.panel-header` de Empresa no llevan cabecera azul.
- **Contenido**: tarjetas blancas (`--surface`) sobre el lienzo `--bg`, borde `--border`, radio `--radius-lg`, sombra `--shadow-sm`.

## Componentes
- **Tarjeta de proceso** (`.row`): sin franja lateral (solo señal en alta / media / vence pronto), hover con `--shadow-md` solo con puntero fino.
- **Botones**: principal azul noche (`.btn-primary`), secundario blanco con borde; se hunden `scale(.97)` al presionar (160 ms, sin transform
  con «reducir movimiento»). 44 px de alto táctil en celular.
- **Filtros de casilla**: chips en píldora (`.toggle`, `.pipeline-filtro label`) que se pintan de amarillo al marcarse (`:has(input:checked)`).
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

## Landing (`index.html`, 2026-10-24)

Misma identidad que la app: pizarra `#16212E`, amarillo señal `#F2B705` solo en acción, Inter + Archivo 900, píldoras. Portada oscura con la tarjeta de resultado real y el panel de evidencia encima (el diferencial: cada resultado cita su página); bandas alternas (claro, oscuro, claro); los cuatro resultados con nombre y símbolo; teléfonos con capturas reales del celular. Sin degradados decorativos, sin animación (solo transiciones de botón; respeta «reducir movimiento»). Imágenes WebP con `width`/`height` y `alt` descriptivo, diferidas salvo la portada.
