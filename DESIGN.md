---
name: Bitácora SECOP
description: Cuaderno de obra digital para decidir a qué licitaciones presentarse: sobrio, trazable y con un solo acento cálido.
colors:
  navy-deep: "#0A0D15"
  navy-ink: "#12182A"
  navy-slate: "#1B2233"
  ink: "#171B26"
  ink-mute: "#535C6E"
  ink-faint: "#5F687B"
  navy-mute: "#8089A3"
  paper: "#FFFFFF"
  canvas: "#EEF1F6"
  line: "#D7DEEA"
  line-strong: "#C1CBDD"
  bronze: "#8F5708"
  bronze-deep: "#6B4206"
  amber-wash: "#FCEBD0"
  amber-lamp: "#F2A93C"
  amber-lamp-deep: "#DB9020"
  amber-ink: "#241300"
  signal-ok: "#1E7A45"
  signal-ok-wash: "#E4F2E9"
  signal-ok-line: "#B9DDC5"
  signal-fail: "#9B2C20"
  signal-fail-wash: "#F3E1DC"
  signal-fail-line: "#E0B8AC"
  signal-watch: "#8A5A10"
  signal-watch-wash: "#F6EAD3"
  signal-watch-line: "#E3C88F"
  logo-ink: "#14181C"
  logo-green: "#51825B"
typography:
  display:
    fontFamily: "'Instrument Serif', 'IBM Plex Sans', serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0"
  body:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1.3
  label:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.1px"
  headline:
    fontFamily: "'Instrument Serif', 'IBM Plex Sans', serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.1
  stat:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
  wordmark:
    fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.06em"
  data:
    fontFamily: "'Fira Code', ui-monospace, 'SFMono-Regular', Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "'liga' 0, 'calt' 0"
rounded:
  sm: "5px"
  md: "9px"
  lg: "14px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.amber-lamp}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.amber-lamp-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.bronze-deep}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.amber-wash}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  process-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  nav-item:
    textColor: "#A6B2C9"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  nav-item-active:
    backgroundColor: "{colors.amber-lamp}"
    textColor: "{colors.amber-ink}"
  tag:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-mute}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "3px 10px"
---

> **Actualización (2026-10-05): dirección "Taller".** El usuario eligió entre 3 direcciones completas un tema oscuro con un solo acento ámbar. Los valores vigentes viven en el bloque `#bitacora-root { ... }` de `index.html` y mandan sobre cualquier valor de este documento. Cambios: lienzo `#0E1013`, tarjetas `#161A1F`, barra lateral `#0A0C0F`, texto `#E9ECF1`/`#98A1B1`, acento ámbar `#F0B75F` como texto y `#E8A33D` como relleno (texto oscuro `#1B1100`), radios 8/12/14, tipografía Outfit (títulos y cuerpo, sin serif) y JetBrains Mono para datos; el wordmark sigue en Space Grotesk. Los colores de estado conservan matiz y significado, aclarados para fondo oscuro (`#5FCF8C`, `#E7B45A`, `#F08A7C`) y con texto oscuro sobre su relleno (`--on-status`). Las secciones de abajo describen el sistema anterior ("El cuaderno de obra", claro, Instrument Serif); léelas por su intención, no por sus valores.

# Design System: Bitácora SECOP

## Overview

**Creative North Star: "El cuaderno de obra"**

Bitácora es, literalmente, un cuaderno de obra: un registro sobrio donde cada dato tiene su fuente y nada se afirma sin respaldo. El sistema visual traduce eso en una superficie fría y ordenada (gris azulado, tarjetas blancas, bordes finos) sobre la que vive un único acento cálido, el ámbar de una lámpara de escritorio, que marca solo lo que se puede hacer a continuación. El rigor lo da la estructura; el carácter, un título en serif cursiva por vista y un lateral azul marino que ancla la marca.

La densidad es media y orientada a escanear: el ingeniero abre una lista de procesos, lee un veredicto, mira qué falta y por qué. Por eso el color de estado (verde, rojo, ámbar oscuro) es una señal funcional de cumplimiento, nunca decoración, y no cambia con la paleta de marca. Los números, fechas y valores en pesos se leen en una fuente de datos sin ligaduras para que ningún carácter se reinterprete.

Rechazos confirmados: no debe parecer una app de consumo llamativa, un portal estatal genérico ni un dashboard de SaaS genérico.

**Key Characteristics:**
- Lienzo gris azulado frío con tarjetas blancas de borde fino y sombra ambiental suave.
- Un solo acento cálido (ámbar) para la acción principal; lateral azul marino para la marca.
- Títulos de página en serif cursiva; todo lo demás en sans-serif legible.
- Estado de cumplimiento en tres colores semánticos fijos, con borde y fondo tintado.
- Radios moderados (5/9/14 px); nada de píldoras ni de decoración gratuita.

## Colors

Una paleta fría y contenida con un único punto cálido: marino y gris azulado para estructura, ámbar para acción, y tres colores de señal reservados al cumplimiento.

### Primary
- **Lámpara de ámbar** (#F2A93C): relleno de la acción principal: botón lleno, ítem de navegación activo, paso activo del indicador de pasos, barra de progreso. Siempre con texto `amber-ink` encima, nunca blanco.
- **Bronce** (#8F5708): el ámbar como TEXTO sobre fondo claro: enlaces, iconos, borde de foco (4,6:1 o más sobre blanco, lienzo y velo de ámbar). Es una versión oscurecida porque el ámbar vivo no pasa contraste AA como texto.
- **Bronce profundo** (#6B4206): hover de enlaces y texto del botón secundario.
- **Tinta de ámbar** (#241300): texto oscuro sobre la lámpara de ámbar.
- **Velo de ámbar** (#FCEBD0): fondo tintado de foco, hover y resaltados.

### Secondary
- **Marino de marca** (#12182A): lateral de navegación y ancla de la identidad.
- **Marino profundo** (#0A0D15) y **Pizarra marina** (#1B2233): escalones más oscuro y más claro de la misma familia.
- **Marino apagado** (#8089A3): texto secundario sobre el marino (pie de la barra lateral), 5,1:1.

### Neutral
- **Lienzo gris azulado** (#EEF1F6): fondo de la aplicación; nunca blanco puro.
- **Papel** (#FFFFFF): tarjetas y paneles.
- **Tinta** (#171B26): texto de cuerpo y de encabezados (los títulos no se colorean; se distinguen por tipografía y peso).
- **Tinta apagada** (#535C6E) y **Tinta tenue** (#5F687B): texto secundario y marcadores de posición; ambas cumplen 4,5:1 sobre el lienzo y el papel.
- **Línea** (#D7DEEA) y **Línea fuerte** (#C1CBDD): bordes y divisores.

### Señal de cumplimiento
- **Verde cumple** (#1E7A45, fondo #E4F2E9, borde #B9DDC5), **Rojo no cumple** (#9B2C20, fondo #F3E1DC, borde #E0B8AC) y **Ámbar de revisión** (#8A5A10, fondo #F6EAD3, borde #E3C88F): CUMPLE / NO CUMPLE / GO / NO-GO / REVISAR y "requiere verificación".

### Velo de modales
- **Velo** (rgba(0,0,0,.35)): fondo semitransparente detrás del modal de cuenta; no es un color de la paleta.

### Marca del logo (independiente)
- **Tinta del logo** (#14181C) y **verde del logo** (#51825B): el monograma "B" conserva su propia paleta a propósito; no usa los tokens de la interfaz.

### Named Rules
**The One Lamp Rule.** El ámbar vivo es la única acción principal de una pantalla; si todo brilla, nada guía. Se usa como relleno, y como texto solo en su versión bronce.
**The Signal Stays Put Rule.** Verde, rojo y ámbar de señal no se reemplazan al cambiar la paleta de marca: son información de cumplimiento, no estilo.
**The Cold Ground Rule.** El fondo es gris azulado frío con tarjetas blancas; el blanco puro de página y los tintes cálidos de fondo quedan fuera.

## Typography

**Display Font:** Instrument Serif (con IBM Plex Sans y serif como respaldo), solo en cursiva y peso 400
**Body Font:** IBM Plex Sans (con la pila del sistema)
**Label/Mono Font:** Fira Code para datos (valores, fechas, radicados), con ligaduras apagadas; Space Grotesk 500 solo para el nombre de marca

**Character:** Una serif cursiva con carácter para anunciar cada vista, sobre una sans de ingeniería neutra y legible; los datos en mono para que se lean como cifras, no como texto.

### Hierarchy
- **Display** (400 cursiva, 28px, 1.05): título de cada vista. Nunca en cuerpo, en títulos de tarjeta ni en badges.
- **Headline** (400 cursiva, 22px, 1.1): título de diálogos como el de cuenta; misma serif cursiva que el Display.
- **Stat** (700, 28px, 1): cifra de las tarjetas de resumen del Dashboard (con variantes de 17–24px para valores largos); la etiqueta que la acompaña va en Label.
- **Title** (700, 14.5px): títulos de tarjeta y de bloque, en la misma tinta que el cuerpo.
- **Body** (400, 14px, 1.5): texto de lectura; descripciones de vista con ancho máximo de 640px.
- **Label** (600, 12px, 0.1px): etiquetas, tags y badges de estado.
- **Data** (400, 13px, mono sin ligaduras): cifras en pesos, fechas y radicados.
- **Wordmark** (500, 16px, 0.06em): "Bitácora" en el lateral.

### Named Rules
**The Display Is Page-Level Rule.** La serif cursiva anuncia páginas, no jerarquías internas; usarla en un título de tarjeta la devalúa.
**The Numbers Are Data Rule.** Toda cifra que el usuario podría copiar o comparar (pesos, fechas, páginas) va en la fuente de datos sin ligaduras.

## Layout

Aplicación de una columna de contenido con una barra lateral fija de 264px. A 900px o menos la barra se angosta a 208px y sigue vertical; a 560px o menos se convierte en un botón desplegable con el nombre de la vista activa, porque seis ítems con texto no caben en una fila de 375px. Las vistas se apilan como tarjetas con 20px de separación; las tablas anchas y el tablero del pipeline desbordan dentro de su propio contenedor con scroll horizontal, nunca a nivel de página. Ritmo de espaciado observado: 6, 10, 16 y 22px, con tarjetas de 22px × 24px. En pantallas táctiles o de 560px o menos, botones y campos miden al menos 44px de alto; los enlaces de texto y las etiquetas que se tocan amplían solo su zona sensible. El contenido principal vive en un landmark `main`. Ningún texto baja de 12px.

## Elevation & Depth

Híbrido y discreto: la profundidad la dan primero los bordes finos y el contraste tonal (tarjeta blanca sobre lienzo azulado), y después una sombra ambiental muy suave.

### Shadow Vocabulary
- **Reposo** (`box-shadow: rgba(15,19,30,.10) 0 2px 4px 0, rgba(15,19,30,.05) 0 1px 1px 0, rgba(15,19,30,.10) 0 0 0 1px`): tarjetas, filas de proceso y botón principal; el anillo de 1px hace de borde.
- **Elevado** (`box-shadow: rgba(15,19,30,.14) 0 20px 30px -14px, rgba(15,19,30,.08) 0 8px 12px -4px, rgba(15,19,30,.06) 0 2px 4px 0`): modales y elementos flotantes.

### Named Rules
**The Quiet Shelf Rule.** Una sombra sostiene un objeto, no lo decora: solo tarjetas, filas y diálogos la llevan; los controles planos (tags, ítems de navegación) no.

## Shapes

Esquinas moderadas, de carpeta de archivo, no de píldora: 5px para controles (botones, campos, tags, ítems de navegación), 9px para filas de proceso, 14px para tarjetas y paneles. Las filas de proceso llevan un borde izquierdo de 3px que cambia de color según la prioridad (rojo alta, ámbar media, gris baja). Nada usa radio completo.

## Components

### Buttons
- **Shape:** esquina de 5px (`rounded.sm`), 10px × 16px, peso 600 en 13,5px.
- **Primary:** relleno ámbar con texto marrón casi negro y sombra de reposo; hover hacia un ámbar más profundo.
- **Secondary:** fondo blanco con borde en ámbar vivo y texto en bronce profundo (el ámbar vivo nunca es texto); hover con velo de ámbar.
- **Mini (acción de tarjeta):** botón pequeño de borde fino; "Analizar" lleva tinte verde para distinguirse de "Marcar visto" y "Descartar".
- **Focus:** contorno de 2px en bronce con separación de 2px.

### Chips and tags
- **Style:** fondo lienzo, borde de línea fuerte, texto apagado, 11px 600, esquina de 5px.
- **State:** las variantes semánticas (alta, media, nuevo, no vigente) usan el trío fondo/borde/texto de la señal correspondiente.

### Cards / Containers
- **Corner Style:** 14px (tarjeta base `titleblock`), 9px (fila de proceso).
- **Background:** papel blanco sobre lienzo gris azulado.
- **Shadow Strategy:** sombra de reposo, ver Elevation.
- **Border:** línea fina; el encabezado de la tarjeta lleva un divisor inferior.
- **Internal Padding:** 22px × 24px (tarjeta), 16px × 18px (fila).

### Inputs / Fields
- **Style:** borde de línea fuerte, fondo blanco, esquina de 5px, 10px × 12px, 14px.
- **Focus:** borde en bronce y halo de 3px en velo de ámbar.
- **Placeholder:** tinta tenue.

### Navigation
- Barra lateral marino de 264px; ítems de 13,5px y peso 500 en gris azulado claro, con hover de velo translúcido y, el activo, relleno ámbar con texto oscuro. En celular, un botón desplegable con el nombre de la vista actual y un panel con los nombres completos.

### Process row (componente firma)
La fila de proceso de "Buscar procesos": tarjeta blanca de 9px con borde izquierdo de prioridad, entidad en negrita, tags de fuente (SECOP I/II) y de veredicto, datos clave en fila (valor, plazo) y acciones al pie; los procesos vencidos o descartados bajan su opacidad.

### Veredicto y señal de cumplimiento
Badge con símbolo para no depender solo del color: GO, REVISAR, NO-GO y CUMPLE / NO CUMPLE / NO DETERMINABLE usan el trío de señal, y "requiere verificación" se distingue por borde punteado cuando una cita no se pudo comprobar.

## Do's and Don'ts

### Do:
- **Do** reservar el ámbar vivo (#F2A93C) para la acción principal de la pantalla y ponerle siempre texto `amber-ink` encima.
- **Do** usar bronce (#8F5708) cuando el acento sea texto sobre fondo claro.
- **Do** mantener verde, rojo y ámbar de señal para cumplimiento, con símbolo además de color.
- **Do** poner cifras, fechas y valores en pesos en la fuente de datos sin ligaduras.
- **Do** anunciar cada vista con el título en serif cursiva de 28px y dejar el resto en IBM Plex Sans.
- **Do** probar cualquier cambio a 375px: el contenido ancho desborda dentro de su contenedor, no de la página.

### Don't:
- **Don't** parecer una app de consumo llamativa: sin gradientes, ilustraciones juguetonas ni colores vibrantes decorativos.
- **Don't** parecer un portal estatal genérico: evitar formularios grises apretados y tablas sin jerarquía.
- **Don't** parecer un dashboard de SaaS genérico: sin plantilla de tarjetas con íconos de relleno y métricas enormes sin sentido.
- **Don't** colorear los títulos de tarjeta con el color de marca ni usar la serif cursiva en cuerpo, tarjetas o badges.
- **Don't** usar blanco puro como fondo de página ni radios de píldora.
- **Don't** usar texto blanco sobre el ámbar vivo ni el ámbar vivo como color de texto sobre fondo claro.
- **Don't** recolorear el logo con los tokens de la interfaz: conserva su tinta y su verde propios.
