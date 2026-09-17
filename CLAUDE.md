# Bitácora SECOP — Contexto del proyecto

Rastreador de licitaciones SECOP II para una constructora en Norte de Santander
(Cúcuta). Sitio 100% estático (HTML/CSS/JS puro, sin backend, sin build step),
publicado en GitHub Pages. Un solo archivo: `index.html`.

## Arquitectura

- **Sin backend, sin build.** Todo corre en el navegador del usuario.
- **Persistencia**: `localStorage` del navegador (historial de vistos/descartados,
  perfiles de empresa, análisis de pliegos guardados). No hay servidor, no hay
  cuenta de usuario — los datos viven solo en el navegador donde se usó.
- **Fuente de datos**: dataset abierto "Procesos de Contratación — SECOP II"
  (datos.gov.co, Socrata, dataset `p6dx-8zbt`). Se consulta en vivo con `fetch()`
  al hacer clic en "Aplicar filtros" (vista "Buscar procesos").
- **Snapshot embebido de respaldo**: si la consulta en vivo falla, cae a un
  array de procesos reales embebido en el propio archivo (curado a mano en
  algún momento, con fecha fija). Solo es respaldo, no la fuente principal.

## Flujo principal: Experiencia → Personal → Pliego (compuerta de dependencias)

Reestructuración pedida explícitamente por el usuario: "Analizar Pliego" pasó
de ser lo primero que se hace a ser el ÚLTIMO paso de una secuencia
obligatoria. El principio: primero se conoce la empresa (experiencia) y su
gente (perfiles profesionales); solo entonces tiene sentido juzgar si puede
responder a un pliego puntual.

**Flujo pedido**: 1) Cargar experiencia → 2) Analizar experiencia → 3) Cargar
perfiles → 4) Analizar pliego → 5) Resultado de compatibilidad.

**Decisiones de interpretación** (el pedido original describía un flujo
genérico tipo wizard; se adaptó a la arquitectura real sin reconstruirla,
como pedía explícitamente el propio prompt):

- **Los "perfiles" del paso 3 NO son "Perfil de la empresa"** (RUP/K
  financiera, ya existente) — son perfiles PROFESIONALES individuales
  (director de obra, residente, especialistas...), un concepto nuevo que no
  existía. Se implementó como una sección nueva, **"Personal"**
  (`view-personal`, entre Experiencia y Evaluación en la sidebar), con el
  mismo patrón CRUD que "Perfiles de empresa" (`PERFIL_PROFESIONAL_VACIO`,
  `perfilesProfesionales` en `perfiles_profesionales`, doble clic para
  eliminar) pero sin el concepto de "comparar" -- TODOS los perfiles
  profesionales registrados son candidatos al cruzar contra el personal que
  pida un pliego, no hace falta marcarlos.
- **"Analizar pliego" sigue siendo por TARJETA** (un botón por proceso en
  "Buscar procesos"), no una página única de wizard -- la app es
  fundamentalmente "navega muchos procesos, analiza el pliego del que te
  interese", y una empresa revisa MUCHOS pliegos distintos con la MISMA
  experiencia/personal ya preparados. Lo que se gatea es la
  DISPONIBILIDAD del botón en todas las tarjetas, no un flujo de una sola
  vía. `estadoFlujoPliego()` (experiencia cargada + analizada + al menos un
  perfil profesional) se calcula una vez por render de la lista
  (`flujoListoParaPliego`), y el label del botón cambia a "🔒 Analizar
  pliego (completa Experiencia y Personal)" cuando falta algo -- al hacer
  clic bloqueado, se muestra el mensaje exacto de qué falta en el
  `.analysis-slot` de esa tarjeta, con un botón "Ir a Experiencia/Personal".
  Un indicador de 5 pasos (`#bt-flujo-steps`, mismo componente visual
  `.steps`/`.step` ya usado en Experiencia) vive arriba de "Buscar
  procesos" y se recalcula (`renderFlujoStepper()`) cada vez que se entra a
  esa vista -- junto con un `rerender()` de la lista, porque si no el aviso
  de arriba decía "ya puedes analizar" pero los botones de las tarjetas,
  dibujados antes de completar el flujo, seguían con el candado.
- **La "matriz de requisitos" del pliego NO se reemplazó** por el Excel de
  matriz que ya existía en "Experiencia" (Fuente B) -- el pedido original
  sugería extraer los requisitos directamente del PDF del pliego para la
  comparación final. Se mantuvo el motor de Experiencia (Excel vs Excel)
  intacto tal cual estaba, y el pliego PDF se sigue analizando con el motor
  de texto YA existente (`analizarTexto`/`REQUISITO_CATEGORIAS`). Motivo:
  el pedido mismo insiste en "no dupliques lógica existente" y "no
  reconstruyas innecesariamente" -- reemplazar el Excel-vs-Excel ya
  construido y probado por una extracción PDF-vs-personal/experiencia
  hubiera sido una reconstrucción, no una reorganización.
- **"Cargar pliego" y "Analizar pliego" son ahora dos acciones distintas**
  (pedido explícito, sección 7 del prompt). Antes, seleccionar el PDF en el
  `<input type=file>` disparaba automáticamente `extractPdfText` +
  `analizarTexto` + `compararConPerfiles`. Ahora:
  1. El evento `change` del input SOLO guarda el `File` en memoria
     (`pendingPliegoFiles[id]`, mismo patrón que `pendingOcrFiles` para el
     OCR -- vive solo en memoria, se pierde si se recarga la página antes
     de analizar, limitación ya aceptada para el caso de OCR) y muestra
     "✓ Pliego cargado: nombre.pdf (KB). Revisa que sea el documento
     correcto y pulsa el botón para analizarlo." con un botón
     **"Analizar pliego"** (`.analysis-confirmar-btn`).
  2. Ese botón, al pulsarse, ejecuta EXACTAMENTE la misma lógica que antes
     corría automáticamente (extracción, fallback a OCR si no hay texto,
     `analizarTexto`, `compararConPerfiles`, guardar en `analisis[id]`).
  El gate (`estadoFlujoPliego().listo`) se revisa TANTO al hacer clic en
  "Analizar pliego (PDF)" (antes de abrir el selector de archivo) COMO en
  el evento `change` (por si el usuario ya tenía el selector abierto antes
  de que el flujo se completara/rompiera).
- **Resultado de compatibilidad (paso 5)**: en vez de construir un motor de
  comparación paralelo, se reutilizó `evaluarProceso()`/`evaluarMejor()` --
  el motor go/no-go YA calculaba, gate por gate, prácticamente la misma
  "matriz de requisitos" que pedía el prompt (K financiera, RUP,
  Experiencia). Solo se le agregó un gate nuevo, **"Personal / equipo de
  trabajo"** (`gatePersonalRequerido()`, cruza los hallazgos de la nueva
  categoría `REQUISITO_CATEGORIAS` "Personal / Equipo de trabajo" contra
  `perfilesProfesionales` por palabra clave distintiva, reutilizando
  `palabrasClaveDe`/`normHeader`/`PALABRAS_GENERICAS_OBRA` del módulo de
  Experiencia -- nunca afirma "no cumple" solo por falta de coincidencia,
  eso es "Requiere verificación"). `renderCompatibilidadHtml()` /
  `resumenCompatibilidad()` traducen los gates (`ok/fail/revisar/nd`) al
  vocabulario pedido (Cumple / No cumple / Cumple parcialmente / Requiere
  verificación) con un % de cumplimiento (solo sobre gates evaluables, sin
  contar "Requiere verificación" ni a favor ni en contra) y listas de
  fortalezas/debilidades/riesgos. Este resumen aparece **inline, arriba del
  análisis del pliego** en la propia tarjeta (`renderAnalysisHtml(entry,
  item, s)` ahora recibe el proceso y su score para poder llamar a
  `evaluarMejor` -- `item`/`s` son opcionales, así que los llamados viejos
  sin ese contexto, como una tanda de OCR reabierta días después, siguen
  funcionando igual, solo sin el resumen). Como beneficio gratis: la vista
  separada "Evaluación" (go/no-go) también muestra el gate de Personal sin
  tocarle una línea, porque ya usaba el mismo `evaluarProceso()`.
- **Estados y recuperación**: todo el estado del flujo se DERIVA de datos ya
  persistidos (`expevalContratos`/`expevalResultado`/`perfilesProfesionales`),
  no hay una "máquina de estados" nueva que sincronizar -- si el usuario
  cierra el navegador a medias, al volver `estadoFlujoPliego()` simplemente
  refleja lo que sí quedó guardado. La única excepción es "pliego cargado
  pero no analizado" (`pendingPliegoFiles`), que es memoria pura y se pierde
  al recargar -- aceptado porque el mismo límite ya existía para OCR.

## Diseño de interfaz

Rediseño integral (pedido explícito del usuario): de una estética "bitácora de
campo" (papel cuadriculado, naranja vivo, tipografía condensada) a una
plataforma de consultoría empresarial profesional. Decisiones clave:

- **Sistema de tokens** en `#bitacora-root` (inicio del `<style>`):
  `--brand-*`, `--accent`, `--bg`, `--surface`, `--border*`, `--text*` +
  colores semánticos con fondo tintado (`--success*`, `--danger*`,
  `--warning*`, `--neutral*`) + radios/sombras (`--radius-*`, `--shadow-*`).
  Toda la hoja de estilos referencia estas variables — para ajustar la
  paleta completa basta con cambiar los tokens, no cada regla (esto se
  aprovechó literalmente para el reskin violeta "Wiza", ver más abajo).
- **Historial de paletas** (todas sobre el mismo sistema de tokens de
  `#bitacora-root` — cambiar de una a otra es básicamente redefinir el
  bloque `#bitacora-root { ... }`, casi nada más):
  1. Azul/slate corporativo (rediseño original).
  2. "Wiza" (violeta/lavanda) — pedida replicando un archivo de guía de
     estilo externo (`DESIGN (3).md`) casi literal.
  3. "Teal y coral" — el usuario pidió algo "más moderno y divertido sin
     perder el toque profesional"; se le ofrecieron 4 paletas por texto
     (pregunta con opciones) y escogió esta, pero al verla aplicada en vivo
     no le gustó ("no me gustaron los colores").
  4. "Cobalt & Marigold" -- elegida desde un Artifact con 6 paletas nuevas
     -- esta vez no solo con hex sueltos, sino con una réplica en miniatura
     del sidebar/tarjeta/badges reales para cada una (`sendPrompt` en el
     botón "Elegir esta paleta" mandó el mensaje con el nombre exacto).
     Lección: para color, mejor mostrar un preview en contexto que
     describir con palabras -- la ronda anterior eligió a ciegas y no le
     convenció el resultado real.
  5. "Registro Catastral" (verde bosque + dorado latón sobre papel/
     pergamino, Fraunces serif), pedida como REDISEÑO COMPLETO (no solo
     color) vía el skill `frontend-design`. Escalón más allá de la lección
     del punto 4: el preview mostró 3 DIRECCIONES enteras (tipografía +
     color + forma + textura, cada una con su propio nombre y mundo de
     referencia -- Registro Catastral/ledger público, Plano de Obra/
     blueprint técnico, Gaceta/boletín oficial), no solo variaciones de
     paleta sobre el mismo esqueleto tipográfico/de forma. El usuario
     aclaró primero, vía pregunta, que quería "profesional con más
     carácter" (no "bold/poco convencional") antes de construir el preview
     -- evitó gastar el ciclo de diseño en una dirección que se alejara
     demasiado del uso empresarial real de la app.
  6. **Actual: "Meridiano"**, vía `frontend-design` de nuevo -- el usuario
     encontró "Registro Catastral" simple/poco llamativo apenas unos días
     después de adoptarlo y pidió algo "moderno y atractivo". Misma
     mecánica de preview que el punto 5 (3 direcciones completas con
     réplica real de sidebar/tarjeta/badges), pero esta vez con una
     pregunta previa de dos ejes -- qué tan lejos ir ("moderno y vibrante"
     vs. "refinado con más punch" vs. "muéstrame 3 direcciones") y base
     clara/oscura (el usuario delegó la base a la dirección elegida) --
     antes de construir el preview. Eligió "Meridiano" de las 3: gris
     azulado frío + ámbar, sidebar en azul marino, Instrument Serif
     itálica para encabezados de página.
  Mapeo de la paleta actual: `--navy-900 #12182A` (sidebar/marca),
  `--ink-900 #171B26` (texto de cuerpo Y de encabezado -- a diferencia de
  "Registro Catastral", Meridiano NO colorea los títulos de tarjeta con el
  color de marca; los distingue por tipografía/peso, ver `--text-heading`).
  `--amber #A6660A` es `--accent` (color de TEXTO: enlaces, iconos, borde
  de foco) -- deliberadamente un ámbar oscurecido/"bronce", NO el ámbar
  vivo del logo/botones, porque `--accent` se usa como `color:` sobre fondo
  claro en ~10 lugares y un ámbar vivo (`#F2A93C`) ahí falla el contraste
  AA como texto (¬3.4:1 contra ¬4.5:1 exigido). Ese ámbar vivo vive aparte
  en `--accent-button #F2A93C`, SOLO como relleno de fondo (botón lleno,
  paso activo del stepper, nav activo, barra de progreso), siempre con
  `--accent-ink #241300` (oscuro) encima, nunca blanco -- mismo problema
  que ya había resuelto `--brass-ink` en la paleta anterior, aquí más
  extendido porque `--accent` se usa como texto en muchos más sitios que
  `--brass`. Fondo `--canvas #EEF1F6` (gris azulado frío, no blanco puro)
  con tarjetas en `--paper #FFFFFF` y bordes en `--line/-strong` (azulados
  fríos también).
  **Lo que sí cambió esta vez, a diferencia de un reskin solo de color**:
  - Radios más grandes (`--radius-sm:5px/--radius-md:9px/--radius-lg:14px`,
    antes 3/5/8) -- de "ficha/folio de archivo" a algo más cercano a un
    dashboard SaaS moderno, sin llegar a `border-radius:999px` (esa
    lección de la ronda anterior -- radios de píldora vía token, nunca
    hardcodeados -- ya estaba resuelta y se mantuvo).
  - Tipografía: Instrument Serif (SOLO 1 peso, 400 -- su "peso visual" lo
    da el itálico + el tamaño, no negrita; hubo que revisar cada uso de
    `font-weight:700` sobre Fraunces y bajarlo a 400+italic, y subir el
    tamaño del `<h1>` de vista de 25px a 28px para compensar la falta de
    negrita) reemplaza a Fraunces para encabezados/`.display-font`; IBM
    Plex Sans reemplaza a Public Sans para el cuerpo; Fira Code reemplaza a
    Spline Sans Mono en `.mono` (con `font-feature-settings:"liga" 0,"calt"
    0` -- Fira Code trae ligaduras tipográficas que alterarían cómo se lee
    un valor en pesos o una fecha si no se apagan).
  **La misma excepción de siempre**: los colores de estado
  (`--success/--danger/--warning`, CUMPLE/NO CUMPLE/NO DETERMINABLE,
  GO/NO-GO/REVISAR) NUNCA cambian con la paleta de marca — son señal
  funcional de cumplimiento, no decoración. Esta vez se REUTILIZARON
  literalmente los mismos hex de "Registro Catastral" (`--success #1E7A45`,
  `--danger #9B2C20`, `--warning #A6722A`) en vez de elegir unos nuevos --
  ya estaban probados en producción y son suficientemente distintos de
  navy/ámbar (la familia de marca cambió de verde a azul/ámbar, así que ni
  siquiera hacía falta re-verificar que no se confundieran con la marca).
- **Bug real encontrado durante el reskin a "Teal y coral" (llevaba ahí
  desde el primer rediseño profesional, sin que nadie lo notara)**: varias
  cadenas HTML generadas por JS (`renderResultadoExperiencia`,
  `evalDetalleHtml`, `renderAnalysisHtml`) tenían `style="color:var(--good)"`,
  `var(--orange)`, `var(--grey)`, `var(--navy-line)` — nombres de variable
  del tema ORIGINAL (antes de cualquier rediseño) que ya no existían. Al
  redefinir el bloque de tokens la primera vez, esas 4 referencias sueltas
  (dentro de `style="..."` inline, no en el `<style>` central) quedaron
  huérfanas — no rompían nada visualmente de forma obvia (el navegador
  simplemente ignora una `var()` que no resuelve y hereda el color del
  padre), así que pasaron desapercibidas en todas las pruebas anteriores.
  Se encontraron con un audit sistemático: extraer todos los `var(--x)`
  usados en el archivo y compararlos contra los definidos en
  `#bitacora-root { ... }`. Corregidas a sus equivalentes semánticos
  correctos (`--success`, `--danger`, `--warning`, `--text-muted`).
  **Lección**: después de redefinir el bloque de tokens, correr ese mismo
  audit (`grep -oE '\-\-[a-zA-Z0-9-]+' index.html | sort -u` contra las
  variables definidas) — los estilos inline dentro de strings de JS no
  aparecen en una búsqueda normal de la hoja de estilos.
- **Tipografía actual**: IBM Plex Sans (pesos 400–700) para toda la UI, más
  Instrument Serif itálica 400 solo para encabezados/`.display-font` (ver
  "Historial de paletas" arriba), y Fira Code en `.mono`. Antes de
  "Meridiano" fue Fraunces + Public Sans + Spline Sans Mono ("Registro
  Catastral"); antes de eso Inter + Plus Jakarta Sans; antes de eso, Barlow
  Condensed (encabezados condensados) + IBM Plex Mono.
- **Bug real encontrado al aplicar "Registro Catastral" (llevaba ahí desde
  que se quitó Barlow Condensed, sin que nadie lo notara)**: el mensaje "SIN
  RESULTADOS" de `render()` (cuando una búsqueda no trae nada) tenía
  `font-family:'Barlow Condensed'` HARDCODEADO dentro de un `style="..."`
  inline en el string de JS -- invisible en cualquier revisión de la hoja de
  estilos central porque, igual que el bug de las variables CSS huérfanas
  (ver más abajo), vivía dentro de un string, no en el `<style>`. Al no
  estar la fuente cargada, degradaba en silencio a sans-serif del sistema
  sin ningún error visible -- se notó recién al hacer un pase de tipografía
  completo (no solo de color) y buscar "Barlow"/"Jakarta"/"'Inter'" en todo
  el archivo. Corregido a Fraunces (el nuevo `.display-font`). **Lección**:
  cualquier auditoría de tipografía (no solo de color) debe incluir el mismo
  tipo de grep sobre TODO el archivo, no solo sobre el bloque `<style>` --
  las fuentes hardcodeadas en `style="..."` inline de JS son tan invisibles
  como las variables CSS huérfanas del bug anterior.
- **Navegación tipo SPA sin router real**: 5 `<section class="view" id="view-*">`
  (`dashboard`, `buscar`, `perfil`, `experiencia`, `evaluacion`) viven TODAS en
  el DOM desde el arranque; `mostrarVista(nombre)` solo alterna el atributo
  `hidden` y la clase `.active` en la sidebar — no hay re-render condicional
  de contenido, así que ningún dato ni listener depende de si su vista está
  visible. La última vista visitada se recuerda en
  `localStorage['bitacora_ultima_vista']`.
- **Reutilización de clases existentes**: `.titleblock`/`.titleblock-head`
  (tarjeta base), `.field`/`.field-grid`, `.row` (tarjeta de proceso), `.tag`,
  `.btn-primary`/`.btn-secondary`, `.analysis-block`/`.analysis-sub`,
  `.expeval-*` mantienen el MISMO nombre de clase que ya usaba el JS — el
  rediseño es casi 100% CSS sobre las mismas clases, no un sistema de
  componentes paralelo. Esto redujo drásticamente el riesgo de romper algo:
  las funciones que generan HTML (`renderAnalysisHtml`, `evalDetalleHtml`,
  `renderResultadoExperiencia`, etc.) casi no cambiaron.
- **Trampa real encontrada y corregida**: `.analysis-sub` se usa tanto para
  rótulos fijos de sección ("RECOMENDACIÓN", ya en mayúscula literal en el
  string) como para encabezados con datos dinámicos (nombre real de la
  empresa, ej. `r.perfil`). Ponerle `text-transform: uppercase` en el CSS
  (como se hizo en un primer intento) gritaba el nombre de la empresa en
  mayúsculas — **nunca uses `text-transform` en una clase que envuelve texto
  dinámico** sin revisar antes todos sus usos con grep.
- **Carga de documentos**: un solo componente `.dropzone` (clic + arrastrar y
  soltar + Enter/Espacio por teclado vía `wireDropzone(zoneEl, fileInputEl,
  onFile)`) reemplaza los antiguos `<button>` de "CARGAR RUP (PDF)"/"CARGAR
  EXCEL" — son `<div role="button" tabindex="0">`, no `<button>` reales, así
  que **necesitan su propio manejo de teclado** (el navegador no lo da gratis
  como con un `<button>`).
- **Trampa real encontrada y corregida**: tras recargar la página, el
  indicador de pasos de "Experiencia" restauraba correctamente el estado
  (pasos 1-2 "hechos") pero el texto bajo cada dropzone seguía diciendo "Sin
  cargar." — `renderExpEvalReview()` nunca restauraba `expevalExpStatusEl`/
  `expevalMatrizStatusEl` desde `expevalMeta`, solo lo hacían
  `cargarExcelExperiencia`/`cargarExcelMatriz` al momento de subir el
  archivo. Se corrigió para que la restauración desde `localStorage` también
  actualice ese texto.
- **Indicador de pasos** (`#bt-expeval-steps`, sección Experiencia):
  `renderExpEvalSteps()` calcula `is-done`/`is-active` a partir de
  `expevalContratos`/`expevalRequisitos`/`expevalResultado` — se llama desde
  `renderExpEvalReview()` y `renderExpEvalResultado()`, así que nunca queda
  desincronizado del estado real.
- **Dashboard** ("Inicio"): se recalcula solo al entrar a esa vista
  (`actualizarDashboard()`, invocado por `mostrarVista('dashboard')`), no en
  cada mutación de estado — no hace falta mantenerlo sincronizado mientras el
  usuario está en otra pantalla. "Actividad reciente" cruza `historial` con
  `lastScored` (la última búsqueda en pantalla) para mostrar título/veredicto
  cuando puede, y nunca inventa un título si el proceso no está en la
  búsqueda actual.
- **Responsive**: dos breakpoints, y el primer intento a 900px estaba mal —
  probar en un viewport real (no solo "achicar la ventana en desktop") lo
  dejó en evidencia dos veces seguidas:
  - Intento 1 (descartado): a ≤900px la sidebar pasaba de columna vertical a
    FILA horizontal con marca + 5 ítems de texto. Se veía bien en desktop
    achicado, pero probado en un viewport de celular real (375px) el
    contenido necesitaba 993px contra 359px visibles — desbordado con scroll
    horizontal sin ninguna pista visual. Al pedir "revisa cómo se ve en
    tablet" y probarlo en 768px real (no el ancho ~800px al que la
    herramienta de captura redondea por defecto — hay que fijar un tamaño
    custom de 768x1024 para que `window.innerWidth` sea realmente 768).
    seguía desbordado (993px contra 737px) — la fila horizontal tampoco cabe
    en un iPad en vertical.
  - Solución final: **la sidebar se queda vertical mucho más abajo**. A
    ≤900px (tablet, ej. 768px de ancho) solo se angosta a 208px — sigue
    siendo una columna con `.app-shell` en fila, hay espacio de sobra para
    el contenido en una sola columna al lado. Recién a ≤560px (celular real)
    `.app-shell` pasa a columna y la sidebar a fila horizontal SOLO ÍCONOS
    (`.nav-item .nav-label { display:none }`, con `title`/`aria-label` en
    cada botón para conservar el nombre accesible) — ahí sí una sidebar
    vertical de 208px se comería más de la mitad de la pantalla.
  - Lección: para probar un breakpoint intermedio (tablet), fijar el tamaño
    exacto con `resize_window` (ancho+alto explícitos) en vez de un preset o
    de solo achicar la ventana de escritorio — un preset o la ventana del
    propio panel de vista previa pueden no bajar de ~800px de ancho real
    aunque se pida menos, dando una falsa sensación de que "cabe".
- **Botones/mensajes en mayúscula sostenida** ("GUARDAR PERFIL", "CARGAR RUP",
  "¿ELIMINAR? CLIC DE NUEVO"): quedaban varios reinyectados dinámicamente por
  JS después de convertir el HTML estático a minúscula/oración normal (ej. en
  `cargarPerfilActivoEnCampos()`, en el flujo de doble clic de
  `eliminarPerfil()`). Si cambias el texto de un botón en el HTML, **busca
  también dónde el JS reescribe `textContent` de ese mismo elemento** —
  quedan fácilmente desincronizados.

## Logo: monograma B

El usuario diseñó el logo aparte en Claude Design (no en esta sesión) y pidió
"Implementa: Logo Bitácora.dc.html" -- un documento de exploración de marca
con dos rondas: Turno 1 (tres direcciones -- 1a "Registro" con líneas de
renglón, 1b "Sello" circular apto/no apto, 1c "Monograma B" modular) y Turno
2 (2a, la dirección elegida: 1c desarrollada a fondo -- lockup completo,
favicon, ícono de app, avatar, negativo, prueba de reducción a 32/20/14px).

**Import bloqueado en esta sesión**: `DesignSync` (el MCP de Claude Design)
pide `/design-login`, que no puede correr en una sesión no interactiva. El
usuario resolvió pasando el `.zip` exportado directamente (`Logo Bitácora.dc
.html` + `support.js`, este último es solo el runtime de renderizado del
canvas -- ningún contenido de diseño ahí). Si una sesión futura necesita
releer el proyecto original: `https://claude.ai/design/p/7e862cf6-2dfa-415a
-9b3f-02903872465d`.

**Paleta del logo, deliberadamente separada de "Meridiano"**: tinta
`#14181C` + verde `#51825B` (= `oklch(0.56 0.08 150)` del archivo original,
convertido a sRGB). Se le preguntó explícitamente al usuario si adaptar el
logo a los tokens de Meridiano (navy/ámbar) o dejarlo con su propia paleta
tal cual venía diseñado -- eligió lo segundo. Por eso `.brand-mark` en
`index.html` usa `#14181C`/`#F7F7F4`/`#51825B` como literales, NO
`var(--navy-900)`/`var(--accent-button)` -- es intencional, no un olvido del
audit de tokens.

**Cómo se construyó el SVG**: el archivo `.dc.html` define el monograma con
divs CSS (`border` + `border-left:none` + `border-radius` asimétrico -- una
barra vertical más dos "corchetes" abiertos a la izquierda y redondeados a
la derecha, apilados, que juntos leen como una "B"). Se tradujo a un `path`
SVG reproduciendo esa misma geometría a mano (un script en Python generó
las coordenadas exactas de cada corchete abierto, ver el commit) en vez de
dejarlo como divs, porque un favicon necesita ser una imagen real -- no se
puede usar CSS ahí. El mismo `path` se reutiliza en dos sitios:
- `.brand-mark` en el sidebar (SVG inline, 34×34, fondo tinta, tal como
  el tratamiento "ICONO APP" del documento original).
- El favicon (`<link rel="icon">`, SVG en `data:` base64 en el `<head>` --
  no hace falta un archivo aparte en el repo; `data:` ya estaba permitido
  por `img-src` en la CSP, no hizo falta tocarla).

**Tipografía del wordmark**: Space Grotesk 500, `letter-spacing:0.06em`,
SOLO en `.sidebar-brand-text h1` (el lockup del logo) -- se agregó a la
carga de Google Fonts junto a las demás. El resto de la tipografía de la UI
(Instrument Serif para títulos de página, IBM Plex Sans para el cuerpo)
NO cambió -- "implementa el logo" se interpretó como el ícono + el
tratamiento del wordmark, no como una excusa para recolorear o retipografiar
el resto de la app.

**Verificado**: geometría del SVG confirmada visualmente en aislamiento
(página de prueba en el scratchpad, 3 tamaños) antes de integrarlo; luego
en la app real servida por un server local (no `file://`, que tuvo
problemas de renderizado en esta sesión) en 375/768/1280px sin overflow;
fuente/peso/letter-spacing y el `href` del favicon verificados por estilo
computado vía JS. 14/14 tests de humo.

## Matriz de experiencia también en PDF (no solo Excel)

Pedido del usuario: "hay veces en que la cargan en pdf y no en excel" --
antes, el dropzone #2 de "Evaluación de experiencia" (Matriz de experiencia
/ formato de requisitos) solo aceptaba Excel. La Fuente A (Experiencia del
proponente) NO cambió -- sigue siendo solo Excel, el usuario solo pidió esto
para la matriz.

**Cómo se resolvió sin duplicar el motor de evaluación**: se extrajo
`construirRequisitoDesdeTexto(criterioTexto, i, celdas)` de dentro del
`.map()` de `parsearMatrizExperiencia` -- ya existían regex de respaldo
sobre `criterioTexto` para cuando el Excel NO traía una columna separada
para un campo (minContratos/minValor/minCantidad/obligatoriedad/acumulable).
Para el origen PDF (`parsearMatrizExperienciaPDF`), `celdas` siempre llega
vacío `{}`, así que se apoya 100% en esos mismos regex -- ningún camino de
extracción nuevo, solo el que ya existía como respaldo pasa a ser el
principal para este origen.

**Segmentación de texto libre en requisitos** (`segmentarTextoEnRequisitos`):
un PDF no trae columnas, así que primero hay que partir el texto plano en
"un trozo por requisito". Es un heurístico de FORMATO DE LISTA (corta antes
de "1.", "a)", "•", "Requisito N", "N°N" seguido de mayúscula), no
interpretación semántica -- mismo espíritu "por reglas, no NLP" que el resto
del motor (ver "Prompt maestro" del módulo de experiencia). Exige espacio
antes Y después del marcador para no partir dentro de un número con
separador de miles ("1.200.000.000", sin espacios alrededor del punto).

**Dos bugs reales encontrados escribiendo los tests de este segmentador**
(antes de integrarlo, no después -- ver "Tests de humo" más abajo):
1. El título del documento ("MATRIZ DE REQUISITOS DE EXPERIENCIA...") antes
   del primer ítem numerado se colaba como un falso "requisito 1". Se
   corrigió descartando el primer trozo cuando NO arranca con un marcador
   reconocido (y sí hubo al menos un marcador real más adelante -- si no
   hay NINGÚN marcador en todo el texto, ese primer/único trozo SÍ se
   conserva, como respaldo de "no hay lista reconocible, aquí está todo el
   texto" en vez de inventar que no hay nada).
2. La frase "mínimo 1 contrato" (sin la palabra "de") no hacía match con el
   regex de `minContratos`, que solo reconocía "mínimo DE N contratos" -- un
   bug preexistente en el regex compartido, invisible mientras el Excel
   siempre traía esa cifra en su propia columna (nunca dependía de este
   regex). Se hizo "de" opcional (`m[ií]nimo\s+(?:de\s+)?(\d+)\s+contratos?`)
   -- esto también mejora la lectura de un Excel sin columna de
   minContratos, no solo la de PDF.

**Extracción de texto del PDF**: reutiliza `extractPdfText`/`ocrPdfPages`
(las mismas funciones de "Analizar pliego" y del RUP) y el MISMO patrón de
respaldo ya probado en `procesarRUP()`: primero la capa de texto real del
PDF (rápido); si sale vacía o con menos de 100 caracteres ("parece
escaneado"), se ofrece un botón "Intentar con OCR" -- nunca se dispara OCR
solo, es lento y el usuario debe pedirlo a sabiendas. `cargarMatrizArchivo(file)`
es el único punto de entrada del dropzone: detecta `.pdf` por extensión/MIME
y despacha a `cargarMatrizPDF` o a `cargarExcelMatriz` (Excel, sin cambios)
-- el usuario solo arrastra el archivo que tenga, no elige nada aparte.

**Revisión de la interpretación, más importante aquí que con Excel**: como
la segmentación de texto libre es más incierta que leer columnas,
`renderRequisitosDetectadosPDF()` (nueva, junto a `renderColumnasDetectadas`)
lista cada requisito detectado CON el texto completo del trozo, abierta por
defecto (`<details open>`, a diferencia del panel de Excel que empieza
cerrado) -- el usuario debe poder ver de un vistazo si algún requisito quedó
partido en dos o dos quedaron juntos en uno, antes de correr la evaluación.

**Verificado**: 19/19 tests de humo -- 5 nuevos cubren el camino feliz (lista
numerada -> mismos campos que produciría un Excel equivalente), los dos
bugs de arriba (ya corregidos, con test que los habría atrapado), viñetas y
letras como marcadores alternativos, y el caso sin ningún marcador (devuelve
el texto completo como un solo trozo, no inventa una segmentación). También
probado en la app real: el dropzone muestra "EXCEL O PDF", el
`accept=".xlsx,.xls,.csv,.pdf"` del input se confirmó por JS, sin overflow
en 375/1280px, sin errores de consola. No se probó con un PDF real de una
matriz (no había ninguno a mano en esta sesión) -- si algún requisito real
queda mal segmentado, el panel de revisión (siempre abierto para este
origen) es la primera línea de defensa antes de confiar en el resultado.

**Actualización -- bug real encontrado con el primer PDF real que probó el
usuario** (ver siguiente sección: `ocrPdfPages` detecta y corrige rotación
automáticamente desde entonces): el resultado inicial fue ilegible, no por
la segmentación sino por el OCR en sí. Ya corregido.

## OCR de PDFs escaneados: detección automática de rotación

El usuario probó la carga de matriz en PDF con un archivo real (matriz de
experiencia del sector educativo, 69 páginas, escaneada) y el resultado del
OCR salió ilegible: `"E. E: xEE S : SA EEN 88 35 d h A ANES: MIN ENE 3 Pe
En si Na MERINO MPA EME sa FEE E"`. Afecta a los TRES usos de
`ocrPdfPages()` por igual (RUP, análisis de pliego, matriz de experiencia)
-- no es un bug de la segmentación de texto ni de `construirRequisitoDesde
Texto`, es más abajo, en la lectura del PDF misma.

**Diagnóstico** (con el archivo real que compartió el usuario, no
adivinado): se extrajo la imagen embebida de la página 1 con `pypdf`+
`pillow` (instalados temporalmente, igual que el patrón ya usado con
`tsc` -- desinstalados después) y se abrió con el visor de imágenes. La
imagen era de 2550×3900px -- buena resolución, ~300 DPI, NO el problema --
pero el contenido estaba **rotado 90°**: el título ("MATRIZ - EXPERIENCIA
PARA PROYECTOS DE INFRAESTRUCTURA SOCIAL...") corría de arriba a abajo por
el borde izquierdo de la imagen, no horizontal. Tesseract asume texto
horizontal por defecto; sobre texto girado 90° reconoce letras sueltas
fuera de secuencia -- exactamente la basura que reportó el usuario.

**Corrección en `ocrPdfPages()`**: antes de leer el rango de páginas
completo, se prueban las 4 rotaciones (0°/90°/180°/270°) SOLO en la primera
página del rango -- vía el parámetro `rotation` de `page.getViewport(...)`
de pdf.js -- y se usa `data.confidence` (0-100, que ya devuelve Tesseract)
para elegir cuál de las 4 se lee de verdad bien, no cuál "se ve derecha" a
ojo. Un documento escaneado casi siempre tiene la misma orientación en
todas sus páginas, así que esa rotación detectada se reutiliza para el
resto del rango sin repetir la prueba en cada una (repetirla por página
habría sido carísimo -- el OCR ya es lento de por sí). El texto de la
página 1 obtenido durante la propia detección se reutiliza tal cual -- no
se vuelve a correr OCR sobre ella una quinta vez.

**Verificado contra el archivo real que falló** (no solo lógica revisada a
ojo): se generaron las 4 rotaciones de la imagen extraída con `pillow`
(`rotate(-deg, expand=True)`, mismo sentido horario que el parámetro
`rotation` de pdf.js) y se les corrió Tesseract.js de verdad en Node
(instalado temporalmente en el scratchpad, luego `rm -rf node_modules`).
Resultado: confianza 42/93/46/42 para 0°/90°/180°/270° -- un margen
enorme e inequívoco a favor de 90°, con texto reconocido perfectamente
legible ("Matriz - Experiencia "Sector Educativo" ... MATRIZ - EXPERIENCIA
PARA PROYECTOS DE INFRAESTRUCTURA SOCIAL PARA EL SECTOR EDUCATIVO...") que
coincide exactamente con el documento real. La lógica de "elegir la
rotación de mayor confianza" queda confirmada sobre el caso real que
motivó el fix, no solo sobre el razonamiento de por qué debería funcionar.

**Costo**: 3 pasadas de OCR extra (una por cada rotación que NO ganó) SOLO
en la primera página de cada rango leído -- no por página. Para un rango de
15-20 páginas (`OCR_BATCH_PAGES`), es un aumento marginal sobre un proceso
que ya se advierte como "lento, puede tardar varios minutos" y que el
usuario dispara a propósito, a sabiendas.

**Segundo hallazgo, probando ese mismo PDF ya con la rotación corregida**:
el texto salió mayormente legible (ej. un requisito evaluó CUMPLE con
evidencia real -- "Fila 2: CONSTRUCCION DE LA INFRAESTRUCTURA FISICA DE LA
SEDE SIMON BOLIVAR..." y su valor comparado contra el mínimo exigido), pero
quedaba ruido de OCR disperso (palabras rotas sueltas como "hnotecion",
"pomitiruccion", "acredraren", "cnatas" -- inevitable en un escaneo real, no
algo que este proyecto vaya a eliminar del todo). El problema real no era
ese ruido en sí (el motor ya lo maneja bien: si ninguna palabra rota
coincide con nada, cae a NO DETERMINABLE, el resultado seguro) sino que la
JUSTIFICACIÓN de un NO DETERMINABLE por "solo genéricas" listaba TODAS las
`palabrasDistintivas` del requisito sin límite -- con un criterio
largo/ruidoso (típico de un PDF vía OCR, no de una celda corta de Excel)
eso eran decenas de palabras, una pared de texto casi ilegible.
**Corrección**: `listaAcotada(arr, max)` (junto a `palabrasClaveDe`) corta
cualquier lista de palabras que se muestre en una justificación a 12 ítems
+ "y N más" -- aplicada en los 3 lugares donde `evaluarRequisito` arma una
justificación a partir de listas de palabras (genéricas compartidas,
distintivas del requisito, distintivas que sí matchearon). No toca la
lógica de CUMPLE/NO CUMPLE/NO DETERMINABLE en absoluto, solo el texto que
se muestra -- un cambio de presentación, no de criterio de evaluación.

## Word (.docx) y PDF también en "Experiencia del proponente"

Pedido del usuario, después de ya tener PDF en la Matriz: "permite que se
puedan cargar archivos pdf y word también en Experiencia del Proponente y
Matriz de Experiencia" -- es decir, agregar PDF a Fuente A (Experiencia del
proponente, que hasta entonces era solo Excel) Y agregar Word a AMBOS
dropzones.

**Word (.docx): tabla primero, texto libre como respaldo, para ambos
dropzones por igual.** Se cargó `mammoth.js` (1.12.3, jsDelivr con SRI --
no está en cdnjs, se probó y da 404) porque es la única forma razonable de
leer un `.docx` (ZIP+XML) del lado del cliente; NO se intenta leer `.doc`
binario viejo (pre-2007), ninguna librería cliente lo soporta bien.
`mammoth.convertToHtml()` preserva las tablas del documento como HTML real
-- `leerPrimeraTablaHtml()` (nueva) las lee con la MISMA forma
`{headers, rows}` que ya devolvía `leerHojaComoFilas()` para Excel, así que
`detectarColumnas()` y todo lo que ya existía funciona igual sobre una
tabla de Word sin duplicar nada. Para eso se refactorizaron
`parsearExcelExperiencia`/`parsearMatrizExperiencia` en
`parsearExperienciaDeFilas`/`parsearRequisitosDeFilas` (reciben
`{headers,rows}` directo, sin acoplarse a un `workbook` de Excel) +
wrappers delgados que llaman `leerHojaComoFilas(workbook)` primero -- mismo
patrón de refactor que ya se había usado para `construirRequisitoDesdeTexto`
en la fase anterior. Si el `.docx` NO trae ninguna tabla (es texto corrido),
se usa `mammoth.extractRawText()` y cae al mismo camino de texto libre que
un PDF (ver abajo) -- un Word sin tabla y un PDF tienen exactamente el
mismo problema (sin columnas que leer), así que comparten la solución.

**PDF para "Experiencia del proponente": reconstrucción de FILAS por
posición, no segmentación por marcador de lista.** La matriz (una lista de
requisitos) se pudo segmentar por "1.", "a)", viñetas porque los
requisitos suelen redactarse como una lista. "Experiencia del proponente"
es casi siempre una TABLA de muchos contratos -- ahí no hay marcador de
lista que buscar. `extraerFilasPorPosicion()` (nueva) agrupa los
fragmentos de texto que `pdf.js` ya reporta con su posición (x,y) por
proximidad en Y (±4px = "mismo renglón visual"), ordenados de izquierda a
derecha -- reconstruye FILAS, no columnas (una reconstrucción de tabla
completa por posición sería mucho más frágil y no hacía falta: ver el
punto siguiente, por qué no se necesitan columnas separadas). Mismo patrón
de "texto no extraíble -> ofrecer OCR" que `cargarMatrizPDF`; en la vía
OCR (sin coordenadas x,y disponibles, Tesseract no las expone igual) se
parte por línea del texto reconocido en vez de por posición.

**Por qué un contrato de texto libre NO intenta extraer los 11 campos que
sí tiene el Excel** (`construirContratoDesdeTexto`, nueva): un requisito
necesita casi siempre una sola cifra extra (mínimo de contratos/valor);
un contrato tiene objeto, contratante, valor, 2 fechas, duración, cantidad,
tipo, número de contrato, % participación -- intentar separar los 11 de un
renglón de texto corrido sería, en la práctica, inventar la mayoría con
regex frágiles. En cambio, solo se extrae lo que de verdad se puede
reconocer con confianza:
- `objeto`: el texto completo del renglón -- alimenta el emparejamiento
  por palabra clave, que es el mecanismo PRINCIPAL de todos modos (no
  necesita campos separados, ver `evaluarRequisito`).
- `valor`: SOLO con una señal fuerte de que es dinero y no, por ejemplo,
  un número de contrato/expediente parecido (`valorConfiableDeTexto`,
  nueva) -- "$"/COP/SMMLV explícito, o un número agrupado en miles con al
  menos 2 puntos (formato colombiano estándar, ej. "1.200.000.000").
  Un contrato "No. 2024001234" sin esa forma NO se confunde con un valor.
- `fechaInicio`/`fechaFin`: hasta 2 fechas con formato reconocible en el
  texto (primera = inicio, segunda = fin).
- `contratante`, `duracion`, `cantidad`, `numeroContrato`, `participacion`:
  quedan `null` a propósito -- no hay señal confiable para aislarlos de un
  renglón de texto corrido sin inventar. Mismo principio "NO DETERMINABLE
  antes que inventar" ya aplicado en la evaluación, llevado ahora también
  a la EXTRACCIÓN de los contratos, no solo a su comparación contra la
  matriz.

**Panel de revisión, generalizado a 2 orígenes × 2 formas** (`renderExpEval
Review`): la distinción real de qué panel mostrar es si HAY columnas reales
que mapear (`headers.length`, no el string de `fuente`) -- Excel y un
`.docx` CON tabla usan `renderColumnasDetectadas` (ya existía); PDF y un
`.docx` SIN tabla usan paneles de texto libre abiertos por defecto:
`renderRequisitosDetectadosTexto` (renombrada desde `...DetectadosPDF`,
ya no es solo-PDF) para la matriz, y la nueva `renderContratosDetectadosTexto`
para Fuente A -- esta última muestra explícitamente "—" en contratante/
fechas cuando no se reconocieron, en vez de dejarlo ambiguo.

**Verificado de punta a punta con archivos REALES, no solo con HTML/texto
sintético** (a diferencia de la ronda de PDF de la matriz, donde no había
ningún archivo real a mano): se generaron dos `.docx` reales con
`python-docx` (instalado temporalmente, desinstalado después) -- una tabla
de requisitos y una tabla de contratos -- copiados al directorio servido
del proyecto, e inyectados en los `<input type="file">` reales de la app
vía `DataTransfer` + evento `change` (la única forma de simular una
selección de archivo real sin bloqueo del navegador). Resultado: mammoth.js
cargó de verdad desde jsDelivr con el SRI correcto, ambas tablas se
leyeron bien (2 requisitos, 1 contrato), y "Analizar información" corrió
la evaluación completa -- el requisito de puentes dio CUMPLE con evidencia
real ("Fila 1: Construcción de puentes vehiculares... valor 500000000"),
el de pavimentación (exige 2 contratos, solo había 1 no relacionado) dio
NO DETERMINABLE, resultado global REQUIERE REVISIÓN. 28/28 tests de humo
(8 nuevos: `leerPrimeraTablaHtml` con y sin tabla, una tabla de `.docx`
evaluada igual que su Excel equivalente, `valorConfiableDeTexto` en sus 3
casos -- con agrupación de miles, sin señal de dinero, con "$" --,
`construirContratoDesdeTexto`, y un contrato de texto libre evaluado
CUMPLE de punta a punta contra un requisito).

## Auditoría crítica del motor de evaluación: coincidencia total, no parcial

El usuario mandó una "PREOCUPACIÓN CRÍTICA" muy extensa: temía que el motor
estuviera decidiendo CUMPLE por coincidencia superficial de palabras en vez
de evaluar de verdad las condiciones del requisito, y pidió explícitamente
**auditar primero, no tocar código todavía** -- diagnóstico con ejemplos
concretos, propuesta de arquitectura, y solo después implementar. Se usó
`EnterPlanMode`/`ExitPlanMode` para eso exactamente: el plan aprobado
(guardado en el proyecto como referencia del proceso, no como archivo del
repo) es la auditoría completa verificada línea por línea contra el código
real, no contra una descripción de memoria.

**Los dos riesgos reales que confirmó la auditoría** (ejecutando la lógica
real a mano, no hipotéticos):
1. **Coincidencia de UNA sola palabra distintiva bastaba.** "Experiencia en
   construcción de vías **urbanas**" vs "Construcción de vías **rurales**"
   compartían "vías" (1 de 2 palabras distintivas) y el contrato se
   marcaba "relevante" -- sin criterios numéricos explícitos, esto
   producía CUMPLE automático ignorando que "urbanas" vs "rurales" es
   justo la condición que decide si aplica.
2. **Condiciones cuantitativas fuera de los 3 campos modelados
   (minContratos/minValor/minCantidad) desaparecían en silencio.**
   "Longitud mínima de 50 metros" no encajaba en ningún regex existente
   -- con coincidencia de palabras y sin ningún criterio numérico
   detectado, el resultado era CUMPLE automático sin haber verificado la
   longitud en absoluto (un puente de 20m pasando un requisito que pedía
   50m mínimo).

**Por qué NO se propuso un motor semántico/LLM**: el proyecto ya tiene esa
decisión tomada y reafirmada hace apenas unos días -- `nl-search` (que sí
usaba un LLM) se construyó y se **eliminó por costo**, a pedido del mismo
usuario. Meter un LLM en la pieza más crítica de la app además
introduciría el problema en sentido inverso: un LLM puede "sonar seguro"
con lenguaje natural convincente sin evidencia verificable, más difícil de
auditar que un regex. El fix implementado es 100% basado en reglas,
extiende el mismo mecanismo de palabras clave que ya existía.

**Fix 1 -- coincidencia TOTAL reemplaza al binario relevante/no-relevante**
(`evaluarRequisito`): un contrato ahora es "relevante" (puede producir
CUMPLE) solo si comparte **todas** las palabras distintivas del requisito,
no con que comparta una sola. Comparte algunas pero no todas =
`coincidenciaParcial`, una categoría nueva que nunca por sí sola decide
CUMPLE -- a lo sumo NO DETERMINABLE, con la palabra que faltó explícita en
la justificación (ej. "falta al menos: urbanas").

**Bug real encontrado implementando el Fix 1** (antes de que llegara a
producción -- los propios tests de regresión de Casos 1/2/5/7/8 lo
atraparon de inmediato): exigir coincidencia total rompía prácticamente
CUALQUIER requisito bien redactado, porque palabras como "experiencia" o
"específica" (parte de CÓMO se redacta el requisito -- "Experiencia
específica en...") no estaban en `PALABRAS_GENERICAS_OBRA` así que
contaban como "distintivas", pero un contrato real jamás describe su
propio objeto usando la palabra "experiencia". Se agregó
`PALABRAS_META_REQUISITO` (experiencia, específica, general, mínimo/a,
obligatorio, contratos, smmlv, acreditar, exigido, valor, cantidad...),
filtrada igual que las genéricas de obra, exclusivamente al calcular
`palabrasDistintivas` (no toca `palabrasClave` en sí). **Lección**: subir
una exigencia de coincidencia sin antes limpiar el "vocabulario del propio
requisito" del conjunto de palabras exigidas rompe todo lo que ya
funcionaba -- guárdate el conjunto de tests de regresión ya existentes
como red de seguridad antes de tocar el corazón del motor.

**Fix 2 -- condiciones cuantitativas no modeladas bloquean el CUMPLE
automático** (`condicionCuantitativaSinModelar`, `UNIDADES_DIMENSIONALES`
vs `UNIDADES_CONTABLES`): no se intenta parsear ni convertir unidades
físicas (frágil) -- solo se detecta que el requisito exige algo con una
unidad de longitud/área/volumen/peso/potencia (metros, km, m2, m3,
hectáreas, toneladas, kW, MW...) que el Excel/PDF/Word de experiencia no
tiene forma de verificar (no hay un campo estructurado equivalente al
`cantidad` genérico del contrato, que en cada documento podría significar
otra cosa). Cuando se detecta, el resultado que HABRÍA sido CUMPLE
automático baja a NO DETERMINABLE con la condición sin verificar explícita
("revisa manualmente si el contrato satisface la condición '50 metros'").
Las unidades CONTABLES (viviendas, unidades, aulas...) SÍ se tratan
distinto -- de verdad corresponden al campo `cantidad` de un contrato, así
que se extraen como `minCantidad` real y sí se comparan (cierra también un
hueco menor ya confirmado: antes `minCantidad` no tenía ningún respaldo de
texto libre, solo venía de una celda de Excel explícita).

**Un NO CUMPLE ya demostrado no se convierte en NO DETERMINABLE**: si los
criterios numéricos modelados YA fallan (`numericoOk === false`),
`condicionNoVerificable` no lo toca -- ocultar una evidencia real de
incumplimiento detrás de "falta verificar algo más" sería peor que el
problema que se está corrigiendo. Solo intercepta los caminos que
*habrían* producido CUMPLE.

**Alcance deliberadamente NO implementado en esta pasada** (documentado en
el plan aprobado para no perderlo): validación de fechas/período exigido
en el requisito (hoy `fechaInicio`/`fechaFin` del contrato existen pero
nunca se comparan contra nada del lado del requisito); un indicador
numérico de "nivel de confianza" (se decidió NO agregarlo -- la
coincidencia total/parcial YA es esa señal, de forma estructural, agregar
un número aparte duplicaría la misma información sin aportar más);
agrupamiento real de requisitos "alternativos" (OR entre varios) --
limitación ya documentada en el propio código desde antes, sigue sin
resolverse.

**Verificado**: 33/33 tests de humo -- 5 nuevos cubren específicamente los
2 riesgos confirmados (con fixtures diseñados para ejercitar CADA
mecanismo por separado: el caso de "50 metros" comparte TODAS las palabras
distintivas a propósito, para probar `condicionNoVerificable`
específicamente y no que la respuesta correcta salga por otro camino
accidental) más las unidades contables como control positivo (que SÍ deben
seguir funcionando, no sobre-corregir). Además, probado en el navegador
real con el caso "vías urbanas" vs "vías rurales" cargado como `.xlsx`
generado en memoria (no un mock) -- confirmado visualmente NO DETERMINABLE
con la justificación nueva y RESULTADO GLOBAL: REQUIERE REVISIÓN. (Una
primera prueba con un `.csv` de prueba mostró tildes rotas en la
justificación -- se investigó y era un artefacto de codificación del
archivo de prueba en sí, no del motor: repetido con un `.xlsx` real
generado con la misma librería `XLSX` que usa la app, el texto salió
perfecto -- confirma que no era un bug de producción antes de darlo por
cerrado.)

## Cosas aprendidas por las malas (no las repitas)

1. **fetch() SÍ funciona en GitHub Pages**, pero NO dentro del sandbox de
   artifacts de Claude.ai (CSP/iframe bloquea peticiones a dominios externos).
   Si alguna vez ves este proyecto corriendo dentro de un artifact y falla el
   fetch, es el sandbox, no un bug del código.

2. **El dataset abierto de SECOP se actualiza UNA VEZ AL DÍA**, no en tiempo
   real (confirmado en el manual oficial de Colombia Compra Eficiente). Un
   proceso publicado hoy puede no aparecer todavía — no es un bug, hay que
   esperar el refresco diario.

3. **Socrata (`$q`) no soporta bien múltiples palabras combinadas** (las trata
   como AND, no OR) — se debe hacer una consulta por palabra clave, nunca
   combinarlas en un solo `$q`.

4. **Sin `$order`, Socrata no garantiza ningún orden** en los resultados. Con
   palabras clave comunes a nivel nacional (ej. "pavimento"), un proceso real
   del departamento del usuario puede no cvcaer dentro del límite de resultados
   si no se ordena. Se pide `$order=fecha_de_publicacion_del DESC` (con
   reintento sin orden si el nombre de columna no coincide).

5. **El filtro de palabras clave usa coincidencia de RAÍZ (6 caracteres), no
   solo texto exacto** — evita que "pavimentación" no reconozca "pavimento"
   (son formas gramaticales distintas de la misma palabra, y esto causó un
   caso real de un proceso que no aparecía).

6. **El filtro de departamento (geográfico) compara SOLO contra el campo
   `departamento`, nunca contra el texto completo del registro ni contra
   `ciudad`.** Dos bugs reales encontrados por esto:
   - Comparar contra el registro completo hacía que "Santander" trajera
     procesos de Córdoba (por una entidad llamada "...Francisco de Paula
     Santander...").
   - Comparar también contra `ciudad` hacía que "Santander" trajera procesos
     de Cauca, porque existe el municipio "Santander de Quilichao" que está
     en el Cauca, no en Santander.

7. **Los enlaces a `community.secop.gov.co` necesitan los parámetros
   `isFromPublicArea=True&isModal=False`** para intentar la ruta de consulta
   pública. Aun así, SECOP II tiene protección anti-bot/verificación de
   sesión (reCAPTCHA o redirect a login) que puede bloquear el acceso directo
   sin sesión activa — no es algo que se pueda arreglar desde este lado. El
   número de "Referencia" del proceso se muestra en cada tarjeta como
   respaldo para buscar manualmente.

8. **Cualquier fecha fuera del rango 2015–2035 se descarta** al parsear —
   el dataset en vivo a veces trae fechas centinela/basura (ej. año 1961) en
   campos que la entidad no llenó.

9. **Tesseract.js (OCR) debe cargarse desde jsDelivr, versión 5 sin fijar el
   parche** (`cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js`).
   cdnjs NO sirve la estructura completa del paquete (worker + núcleo WASM),
   y causa `Cannot read properties of null (reading 'SetImageFile')`. Una
   versión vieja pinneada (4.1.1) tampoco funcionó aunque estuviera en
   jsDelivr — solo la v5 sin pin de parche, igual al ejemplo oficial del
   README del proyecto, funcionó en pruebas reales.

10. **pdf.js se carga de cdnjs sin problema** (a diferencia de Tesseract.js) —
    versión 3.11.174, con `GlobalWorkerOptions.workerSrc` apuntando al mismo
    CDN.

10b. **SheetJS (xlsx) también se sirve bien desde cdnjs** —
    `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`. Con
    `XLSX.utils.sheet_to_json(hoja, {header:1, raw:false, defval:''})` se
    obtienen filas como arrays (no objetos por encabezado), lo que permite
    detectar la fila de encabezados por heurística (primera fila con ≥2
    celdas no vacías) en vez de asumir que es la fila 1. No se pudo generar
    un `.xlsx` de prueba con Node/openpyxl en este entorno (ninguno de los
    dos está disponible) — los archivos de prueba se armaron a mano con
    `zipfile` de Python (OOXML mínimo: `[Content_Types].xml`, `_rels/.rels`,
    `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`,
    `xl/worksheets/sheet1.xml`, celdas `t="inlineStr"` para texto y `<v>`
    plano para números) e inyectados al `<input type=file>` real con el mismo
    patrón que el RUP (ver punto 11).

11. **Formato del RUP (certificado de la Cámara de Comercio / Confecámaras)** —
    verificado contra 2 certificados reales de la Cámara de Comercio de Cúcuta
    (2020 y 2026), para el autocompletado del perfil:
    - **Códigos UNSPSC**: el RUP los lista como `NN NN NN NN : DESCRIPCIÓN`
      (4 grupos de 2 dígitos separados por ESPACIO, con dos puntos detrás),
      **no** punteados. Un parser que solo espere `72.14.11.00` extrae CERO
      códigos de un RUP real. El `:` posterior es el ancla fiable. Igual se
      aceptan la forma punteada y el prefijo de versión `V1.` por si acaso, y
      los 8 dígitos seguidos solo dentro de la sección de clasificación.
    - **Volumen**: un RUP real puede traer 500+ códigos de clasificación (la
      empresa se inscribe en un rango enorme, desde semillas hasta cemento).
      Volcarlos todos deja el campo inútil para la comparación (todo "coincide").
      Se ordenan por segmento relevante para obra pública (72 construcción, 95
      infraestructura, 81 ingeniería, 30 materiales…) y se cortan a ~90. Se
      informa el total en la línea de estado. (El RUP también trae una sección
      de códigos "Certifica: Experiencia" — a propósito ya NO se extrae ni se
      usa: ver la nota de arquitectura más abajo, "Perfil de empresa NO evalúa
      experiencia".)
    - **Indicadores financieros**: el RUP es una tabla a 2 columnas. Extraída con
      **pdf.js real**, cada renglón queda como `ETIQUETA : valor` pegados
      (extracción limpia); NO como "todas las etiquetas y luego el bloque de
      valores" — eso es lo que produce `pdftotext`, no pdf.js. Se toma el valor
      inmediatamente después de la etiqueta. Los montos exigen `$` para no
      confundir "RENTABILIDAD DEL PATRIMONIO : 0" con el patrimonio real.
    - El RUP de Confecámaras **NO incluye "capacidad residual / máxima de
      contratación"** — eso lo calcula cada entidad por proceso. No la busques ahí;
      ese campo del perfil se llena a mano.
    - Un RUP tiene entre ~30 y ~90 páginas; se leen ~45 para cubrir las secciones
      de clasificación + información financiera.
    - **Probar la carga real es difícil desde el entorno de desarrollo**: el
      navegador de la sesión aísla la red, así que una página en el origen
      `github.io` no puede leer un archivo servido desde `localhost` (ni con CORS
      + `Access-Control-Allow-Private-Network`). Se validó sirviendo el
      `index.html` idéntico (mismo SHA-256) desde un servidor local, inyectando
      el File real en `#bt-perfil-rup-file`, y confirmando aparte que pdf.js
      carga en el origen real. El `<input type=file>` real se probó así, no con
      un clic literal.

12. **Perfil de empresa NO evalúa experiencia** (cambio de arquitectura,
    pedido explícito del usuario). Antes, "Perfiles de empresa" tenía dos
    campos de texto libre (Experiencia general / específica) que el RUP
    autocompletaba con códigos UNSPSC, y el análisis de pliego los comparaba
    por palabra suelta. Eso mezclaba dos cosas distintas: que el RUP mencione
    un código de clasificación NO equivale a acreditar experiencia específica
    para un proceso puntual (depende del objeto, valor, fechas y cantidades
    del contrato real). Ahora:
    - El perfil (`PERFIL_VACIO`) solo tiene `nombre, rup, k, kResidual` — el
      RUP-clasificador y la Capacidad K/financiera. `migrarPerfil()` descarta
      (no migra) los campos viejos `experiencia`/`experienciaGeneral`/
      `experienciaEspecifica` si los encuentra en un perfil guardado.
    - `parsearRUP()` ya NO extrae la sección "Certifica: Experiencia" del RUP.
    - La experiencia (general Y específica) vive exclusivamente en
      "Evaluación de experiencia" (Excel del proponente + matriz), que es
      GLOBAL — no una por perfil de empresa.
    - Todo lo que antes leía `compPerfil.expGeneralMatches` / `expTotal` (el
      gate "Experiencia" del semáforo go/no-go, el bloque de coincidencia del
      análisis de pliego, el informe .txt) ahora llama a
      `experienciaGateDetalle()`, que lee `expevalResultado` (el resultado
      global de "Evaluación de experiencia") y es el MISMO para cualquier
      perfil comparado — no depende de cuál empresa se está evaluando.

## Funcionalidad actual

- Navegación por sidebar con 6 secciones: Inicio (dashboard con resumen y
  actividad reciente), Buscar procesos, Perfil de la empresa, Experiencia,
  **Personal** (perfiles profesionales del equipo de trabajo) y Evaluación
  (ver "Diseño de interfaz" y "Flujo principal" arriba).
- "Analizar pliego" (por tarjeta, en Buscar procesos) está gateado: no se
  habilita hasta cargar y analizar la experiencia Y registrar al menos un
  perfil profesional en Personal. Cargar el PDF y analizarlo son dos clics
  separados (revisar antes de analizar). El resultado incluye un "Resumen de
  compatibilidad" (% de cumplimiento, fortalezas/debilidades/riesgos y una
  matriz de requisitos) antes del detalle de siempre.
- Búsqueda en vivo anclada por palabra clave (Especialidades), con
  departamento aplicado como filtro después de traer los resultados.
- Filtros: ocultar vencidos, solo publicados hace ≤30 días, solo Licitación
  Pública (Obra pública), filtro dinámico por Estado (checkboxes generados
  según lo que traiga cada búsqueda).
- Múltiples perfiles de empresa (RUP/clasificador, Capacidad K/financiera,
  Capacidad K residual — SIN experiencia, ver punto 12). El desplegable elige
  el perfil EN EDICIÓN; un juego de casillas ("Comparar en el análisis de
  pliegos") elige cuáles se comparan — se pueden marcar VARIOS a la vez y el
  análisis los evalúa empresa por empresa.
- Autocompletar el perfil desde el PDF del RUP ("CARGAR RUP"): extrae códigos
  UNSPSC de clasificación → RUP/Clasificador (priorizados por segmento de obra
  y acotados) e indicadores financieros → Capacidad K. Ya NO toca experiencia
  (ver punto 12). Fusiona sin duplicar; los campos de texto libre solo se
  rellenan si están vacíos. No guarda solo: el usuario revisa y pulsa GUARDAR
  PERFIL. Ver punto 11 de "Cosas aprendidas" para el formato del RUP.
- Análisis de pliegos PDF: extracción de texto normal, con respaldo de OCR
  (Tesseract.js) para PDFs escaneados como imagen, con progreso por página y
  botón para "seguir leyendo" más páginas sin repetir las ya leídas.
- El análisis categoriza hallazgos en Capacidad K/Financiera, Experiencia (lo
  que el pliego pide, detectado en el texto) y RUP/Clasificador. Extrae el
  valor de Capacidad K Residual exigido cuando el texto lo menciona
  explícitamente. Con varios perfiles marcados muestra un bloque de
  coincidencia por empresa (solo K/RUP) más UN bloque de Experiencia
  compartido (viene de "Evaluación de experiencia", no del perfil).
- Informe detallado del análisis (descargar `.txt` o copiar): requisitos
  detectados en el pliego + comparación término por término por empresa (lo que
  coincide y lo que NO aparece), con una valoración orientativa.
- Exportación CSV de procesos de alta prioridad, y "copiar resumen" como
  texto plano.
- Historial persistente de "visto"/"descartado" por proceso.
- **Evaluación de experiencia** (panel independiente, "Evaluación de
  experiencia"): cruza DOS Excel — "Experiencia del proponente" (contratos
  ejecutados) y "Matriz de experiencia / Formato" (requisitos) — con un motor
  de comparación ESTRUCTURADO por fila (no por palabra suelta como el
  análisis de pliegos PDF). Detecta encabezados por heurística de substrings
  (no asume nombres de columna fijos) y muestra qué columna usó por campo
  ("Revisar interpretación") antes de evaluar. Cada requisito se evalúa
  contra los contratos relevantes (coincidencia de palabra clave DISTINTIVA
  del objeto/actividades — una palabra genérica como "construcción" sola no
  basta) más los criterios numéricos que traiga la matriz (mínimo de
  contratos, valor mínimo, cantidad mínima, acumulable o no). Resultado por
  requisito: CUMPLE / NO CUMPLE / NO DETERMINABLE, con evidencia (qué fila de
  contrato) y justificación — NO DETERMINABLE nunca se convierte en NO CUMPLE
  automáticamente. El resultado global solo lo deciden los requisitos
  marcados "obligatorio" (detectado por palabras en la matriz;
  opcional/complementario/alternativo se muestran pero no arrastran el
  global). Informe descargable en `.txt`. Es una evaluación por reglas, no
  interpretación semántica real: no hay NLP/LLM en el navegador para juzgar
  si dos objetos contractuales son "equivalentes" en alcance — por diseño,
  ante la duda marca NO DETERMINABLE en vez de inventar un CUMPLE.

## Cómo probar cambios sin desplegar

Antes de subir cambios a GitHub Pages, valida:
1. Sintaxis: extraer el `<script>` y correr `node --check` sobre él.
2. Lógica pura (funciones sin DOM): extraer y testear con Node directamente.
3. Flujo completo con DOM real: usar `jsdom` (`npm install jsdom`) para
   simular clics, cambios de checkbox, subida de archivos, etc. Sirvió para
   atrapar varios bugs reales antes de que el usuario los viera en producción.

Nunca se pudo probar la carga real de pdf.js/Tesseract.js desde una CDN en
este entorno de desarrollo (sin acceso de red a cdnjs/jsDelivr) — esas partes
solo se validan con mocks de `window.pdfjsLib`/`window.Tesseract`, o
directamente en producción con el usuario.

**Actualización:** en la sesión de la auditoría (ver punto siguiente) sí hubo
acceso de red saliente a cdnjs/jsDelivr/datos.gov.co desde el entorno de
desarrollo -- se pudo servir `index.html` con `python -m http.server`,
navegarlo de verdad, e inyectar archivos reales (`DataTransfer` + `fetch` de
un archivo copiado a la misma carpeta servida, mismo patrón que el punto 11)
en los `<input type=file>` para confirmar pdf.js/xlsx/Tesseract+OCR y el fetch
en vivo a Socrata funcionando de punta a punta. Puede que dependa del entorno
(sandbox/red de esa sesión en particular) -- si una sesión futura no tiene
salida a red, sigue aplicando el punto anterior (mocks / probar en producción).

## Auditoría full-stack (seguridad de scripts de terceros)

Se auditó el proyecto contra un checklist genérico de seguridad/calidad para
apps full-stack (backend, BD, auth, etc. -- explícitamente NO APLICAN aquí,
es 100% cliente). De ahí salieron 3 cambios reales, aplicados y probados:

- **SRI (`integrity`/`crossorigin`) en los 3 `<script>` de terceros** (pdf.js,
  Tesseract.js, xlsx) -- sin esto, el navegador ejecuta lo que sea que cdnjs/
  jsDelivr sirvan en ese momento sin verificar que sea el código esperado.
  Los hashes (`sha384-...`) se calcularon descargando el archivo real sobre
  el que apunta cada URL pinneada y sacando su SHA-384 en base64
  (`openssl dgst -sha384 -binary archivo | openssl base64 -A`) -- si algún
  día se sube de versión cualquiera de las 3 librerías, hay que recalcular el
  hash contra el archivo nuevo o la carga falla (el navegador la bloquea).
- **Tesseract.js pasó de `@5` (parche flotante) a `@5.1.1` (fijo)** -- un
  hash SRI solo puede verificar un archivo exacto, y `@5` puede resolver a un
  parche distinto en cualquier momento. Se fijó a la versión que `@5` resuelve
  HOY (confirmado contra la API de jsDelivr: `data.jsdelivr.com/v1/packages/
  npm/tesseract.js/resolved?specifier=5`). Sigue siendo v5 -- el patrón que
  funciona, según el punto 9 de arriba -- solo que ya no flota. La lección del
  punto 9 (v4.1.1 fijo fallaba) fue sobre esa versión puntual, no sobre fijar
  parches en general; se confirmó en la práctica (ver abajo) que pinnear
  5.1.1 no reintroduce ese problema.
- **Meta `Content-Security-Policy`** restringiendo script/estilo/fuente/
  conexión/worker a `'self'` + los orígenes realmente usados (cdnjs,
  jsDelivr, fonts.googleapis.com/fonts.gstatic.com, www.datos.gov.co).
  `script-src` incluye `'unsafe-inline'` a propósito: todo el JS de la app
  vive en un único `<script>` inline (sin build no hay forma de usar nonce, y
  un hash de script inline habría que recalcularlo en cada edición futura del
  archivo -- inviable). El valor real de esta CSP no es bloquear ese inline,
  sino impedir que cualquier script (inyectado o no) hable con un origen que
  no sea uno de los permitidos -- en particular `connect-src` cierra la vía
  de exfiltrar `localStorage` (perfiles, RUP, personal) a un servidor ajeno.
  `worker-src`/`'wasm-unsafe-eval'`/`connect-src data:` existen específicamente
  por Tesseract.js: crea Workers, corre WASM, y en al menos una ruta interna
  hace `fetch()` de un `data:` URI -- las tres cosas las bloquea una CSP
  estricta si no se permiten explícitamente, y el bloqueo NO tira un error
  obvio de "Tesseract no carga", sino un error de CSP suelto en consola
  mientras el OCR simplemente no reconoce texto.
- **Cómo se probó (importante, no se puede dar por buena a ciegas)**: server
  local + navegador real, con los 3 `<input type=file>` recibiendo archivos
  reales (RUP → dispara pdf.js real; Excel de experiencia → dispara xlsx.js
  real) inyectados vía `DataTransfer`, más una prueba directa de Tesseract.js
  (cargar el script con el mismo `integrity`, crear un worker, correr
  `recognize()` sobre un canvas con texto) para confirmar el camino de OCR
  (el más frágil bajo CSP: Worker + WASM + `data:`) de punta a punta. La
  primera versión de la CSP SÍ rompía algo real y silencioso: Tesseract
  cargaba y creaba el worker bien, pero un `fetch()` interno a un `data:` URI
  (parte de cómo entrega el núcleo WASM) quedaba bloqueado por `connect-src`
  sin permitir `data:` -- se detectó por un error de CSP en consola, no por
  ningún mensaje de error propio de la app. Lección: probar CSP nueva
  significa correr el camino MÁS profundo de cada librería (para Tesseract,
  eso es el OCR real, no solo que el `<script>` cargue), no solo confirmar
  que el `onload` del script se dispara.

## Tests de humo (`tests/smoke.mjs`) + CI (`.github/workflows/smoke.yml`)

Hallazgos MEDIO de la auditoría: no había ninguna prueba automatizada
versionada (todo dependía de verificación manual sesión a sesión) ni ningún
gate antes de que GitHub Pages sirviera un cambio. Se agregaron los dos,
sin introducir build step ni dependencias nuevas:

- **`tests/smoke.mjs`**: Node puro (`node:fs`, `node:child_process`,
  `node:crypto`, `fetch` global), sin `npm install`. Los primeros 5 chequeos
  son análisis estático del propio `index.html` (no simulan clics ni DOM real
  -- eso sigue siendo el método de "Cómo probar cambios sin desplegar" de
  arriba, para cambios grandes); del 6 en adelante SÍ ejecutan código real
  (ver más abajo):
  1. El `<script>` principal es JS válido (`node --check` sobre el cuerpo
     extraído).
  2. Todo `getElementById('...')` referenciado existe como `id="..."` en
     algún lugar del archivo (cubre tanto HTML estático como ids escritos a
     mano dentro de strings de JS que generan HTML dinámico).
  3. Una lista de funciones clave del flujo principal sigue existiendo por
     nombre (detecta un renombre/borrado accidental sin actualizar a quien
     la llama).
  4. Todo host `https://` mencionado en el script aparece en algún lado de
     la política CSP -- con una lista explícita de excepciones
     (`NAVIGATION_ONLY_HOSTS`) para los hosts que solo son destino de un
     `<a href>` o dato de ejemplo del snapshot embebido, que no necesitan
     estar en la CSP (una navegación de nivel superior no está sujeta a
     `script-src`/`connect-src`).
  5. El SRI embebido de pdf.js/xlsx/Tesseract.js sigue coincidiendo con el
     archivo real que sirve hoy cada CDN (requiere red -- si algún día se
     sube de versión sin recalcular el hash, este test avisa antes que un
     usuario real se quede con esa librería bloqueada en silencio).
- **Checks 6-14 -- motor de "Evaluación de experiencia" ejecutado de verdad,
  no solo verificado por nombre**: surgió de revisar el archivo adjunto por
  el usuario ["Prompt maestro — Módulo de evaluación de experiencia del
  proponente.md"] contra lo ya construido (ver esa sección más abajo) -- el
  check 3 solo comprueba que `evaluarExperienciaCompleta` etc. EXISTAN, no
  que decidan bien; nada atrapaba una regresión silenciosa en la lógica más
  crítica de la app. Se agregó `extractExperienceEngine()`: extrae por
  anclas de texto (mismo espíritu que la extracción del `<script>` principal)
  el bloque `normHeader..evaluarExperienciaCompleta` y el bloque
  `parseNumCO..parseValorUnidad`, y los ejecuta con `new Function` inyectando
  un `window.XLSX` falso (`sheet_to_json` devuelve el array de filas tal
  cual) -- evita instalar la librería xlsx real solo para testear. Cubre,
  con datos Excel sintéticos armados a mano, los 8 escenarios obligatorios de
  la sección 17 del prompt maestro (cumple todo, falla un obligatorio,
  información insuficiente, ambigüedad -- el mismo ejemplo textual de la
  sección 13 del pedido --, acumulación entre varios contratos, falso
  positivo por palabra genérica -- el mismo ejemplo de la sección 12 --,
  Excel con columnas distintas a las habituales, y varios requisitos con
  distinta obligatoriedad en la matriz). **Verificado que de verdad
  detectan una regresión y no pasan por casualidad**: se mutó a propósito
  `evaluarRequisito` (un contrato con solo palabra genérica compartida pasó a
  contar como "relevante") y los 3 casos que dependen de esa protección
  (4, 6 y 8) fallaron como se esperaba; se revirtió la mutación después.
- **Extracción del `<script>` principal**: por posición de la etiqueta EN SU
  PROPIA LÍNEA (`/^<script>$/m`), no por la primera aparición del texto
  "`<script>`" en el archivo -- el propio archivo lo menciona dentro de dos
  comentarios (explicando por qué la CSP necesita `'unsafe-inline'`), y un
  regex ingenuo capturaría HTML/CSS como si fuera JS.
- **Cómo se validó `smoke.mjs` sin tener Node en este entorno de
  desarrollo** (ver nota de arriba: sí hubo red, pero Node no estaba
  instalado): se reimplementó la misma lógica de cada chequeo en JS de
  navegador (`fetch` + regex idénticos + `crypto.subtle.digest('SHA-384',
  ...)` en vez de `createHash('sha384')` de Node) y se corrió contra el
  `index.html` real servido en local, confirmando los 5 resultados a mano
  antes de confiar en el script. La validación de sintaxis (`node --check`)
  se aproximó con `new Function(cuerpoDelScript)` en una pestaña SIN la CSP
  de la propia app (la CSP real bloquea `new Function`/`eval` a propósito --
  confirma que ese bloqueo funciona, pero impide usarlo ahí mismo para
  probarse a sí mismo).
- **`.github/workflows/smoke.yml`**: corre en push/PR a `main` y manualmente
  (`workflow_dispatch`). `actions/setup-node@v4` con Node 20 fijo -- sin
  `npm install`, porque `smoke.mjs` no tiene dependencias. Es un gate
  informativo, NO bloquea el despliegue: GitHub Pages publica en cuanto
  llega el push a `main`, sin esperar a que termine este workflow (no está
  configurado como el mecanismo de deploy, solo corre en paralelo).

## Snapshot de respaldo en archivo aparte (`snapshot.json`)

Hallazgo MEDIO de la auditoría: `EMBEDDED_RECORDS_II` (el array de respaldo
para cuando falla la consulta en vivo) pesaba ~317 KB de los ~562 KB totales
del archivo -- más de la mitad -- y se descargaba SIEMPRE, en cada carga de
la página, aunque casi nunca se usa (solo si falla `fetchAllForDataset`).

- El array se movió tal cual (mismo contenido JSON, verificado con
  `json.loads`/`JSON.parse` antes y después) a `snapshot.json`, al lado de
  `index.html`. `loadEmbeddedSnapshot()` lo trae con `fetch('snapshot.json')`
  SOLO dentro del `catch` de `runSearch()` -- si la consulta en vivo funciona
  (el caso normal), `snapshot.json` nunca se pide. Se cachea en
  `cachedSnapshot` para no repetir la descarga si el usuario reintenta
  "Aplicar filtros" varias veces seguidas sin conexión.
- No hace falta tocar la CSP: `fetch('snapshot.json')` es mismo-origen,
  cubierto por `connect-src 'self'`.
- `loadDemo()` ("Ver datos de ejemplo") es un array chico e independiente,
  ficticio, escrito a mano dentro del propio `index.html` -- no tiene
  relación con `EMBEDDED_RECORDS_II`/`snapshot.json` y no se tocó.
- **Probado** sirviendo `index.html` en local y forzando el fallo de la
  consulta en vivo desde la consola (parchando `window.fetch` para que
  rechace cualquier URL con `datos.gov.co`, dejando pasar todo lo demás):
  el mensaje de `#bt-data-freshness` mostró correctamente "457 procesos,
  actualizado el 03 de sept de 2026" -- mismo comportamiento que antes de
  mover el array, ahora cargado desde `snapshot.json`.

## Patrón ARIA de pestañas completo

Hallazgo MEDIO de la auditoría: `#bt-nav` ya tenía `role="tablist"` +
`role="tab"`/`aria-selected` por botón, pero le faltaba la otra mitad del
patrón -- ningún panel (`<section class="view">`) tenía `role="tabpanel"` ni
`aria-labelledby`, y no había navegación por flechas entre pestañas (solo
`Tab` secuencial).

- Cada botón de `#bt-nav` ahora tiene `id="bt-nav-<vista>"` +
  `aria-controls="view-<vista>"`; cada `<section class="view">` tiene
  `role="tabpanel"` + `aria-labelledby="bt-nav-<vista>"` -- enlace en ambos
  sentidos entre pestaña y panel.
- Navegación por teclado (flechas ←/→/↑/↓, Home, End, con vuelta al principio/
  final) agregada como un solo `keydown` en `#bt-nav` (delegación, no un
  listener por botón), con activación automática (mover el foco ya cambia de
  vista -- coherente con que un clic también cambia al instante).
- **Trampa al probarlo**: la herramienta de automatización de este entorno
  (tecla sintética vía protocolo de depuración remota) NO preserva el cambio
  de foco hecho por el propio código dentro del manejador del evento --
  `document.activeElement` después de "apretar" la flecha seguía mostrando el
  botón anterior, aunque la vista sí cambiaba (prueba de que el manejador SÍ
  corrió y SÍ llamó a `.focus()`). Se confirmó que era un artefacto de la
  herramienta, no un bug real, disparando el mismo `KeyboardEvent` desde
  dentro de la página (`element.dispatchEvent(new KeyboardEvent(...))`) en
  vez de por la tecla sintética externa -- ahí el foco sí se mueve
  correctamente. Lección: para probar foco/teclado en este entorno, disparar
  el evento desde JS de página es más confiable que la tecla simulada de la
  herramienta de automatización.

## App Token de Socrata (activado)

Hallazgo BAJO de la auditoría: las consultas a datos.gov.co iban sin
`X-App-Token`, así que compartían el límite de tasa más estricto que aplica a
cualquier app anónima. Se agregó soporte para uno (`SOCRATA_APP_TOKEN` +
`socrataFetchOptions()`, usado en `fetchSecopDataset`/`buscarAdjudicaciones`),
dejando la constante vacía en un primer momento porque conseguir un token
real exige crear una cuenta, y ese es un paso manual que le corresponde a una
persona, no a una herramienta automatizada actuando en su nombre. El usuario
creó la cuenta y generó el token; ya está activado con su valor real (no es
una credencial secreta -- Socrata los diseña para ir embebidos en código de
cliente, igual que la anon key de Supabase). Verificado contra la API real
(`curl` con y sin el header, ambos `200`) y con búsquedas en vivo reales en
los 3 breakpoints antes de publicar.

**Nota para el futuro**: el portal de registro que documentaba originalmente
este paso, `dev.socrata.com/register`, está descontinuado desde el 1 de
abril de 2021 (el usuario se topó con el aviso de cierre al intentar
entrar). El flujo vigente (verificado contra la documentación oficial de
Socrata/Data & Insights, actualizada octubre 2025) es: crear cuenta/iniciar
sesión directo en el dominio de datos abiertos que se esté usando (en este
caso, datos.gov.co) → menú de perfil → "Developer Settings" → "Create New
App Token". Si en una fase futura hace falta regenerar o explicar esto de
nuevo, no asumir que las instrucciones viejas del README siguen vigentes sin
verificarlas primero -- ver
<https://support.socrata.com/hc/en-us/articles/210138558-Generating-App-Tokens-and-API-Keys>.

## Bug real de responsive encontrado al revisar en celular (post-"Personal")

Al pedir "revisa cómo se ve en el celular" después de agregar la sección
**Personal** (en una sesión anterior, ver "Flujo principal" arriba), la barra
horizontal de íconos de `#bt-nav` (activa a ≤560px, ver "Responsive" más
arriba) ya NO cabía completa: 6 íconos + el texto "Bitácora" del logo
necesitan ~388px, pero un celular real de 375px de ancho solo tiene ~359px
utilizables (16px se van en el margen por defecto del navegador, sin resetear
-- ver nota abajo). El último ícono ("Evaluación") quedaba parcialmente
cortado en el borde derecho, sin scroll visible que indicara que había más
contenido -- `.sidebar { overflow-x: auto }` ya existía (para no romper si
algún día no cabe), así que técnicamente SÍ se podía llegar arrastrando,
pero nada en la interfaz sugería que hiciera falta.

- **Cómo se detectó**: no por la captura de pantalla en sí (a simple vista
  parecía razonable), sino midiendo en JS `sidebar.scrollWidth` vs
  `sidebar.clientWidth` a 375px reales -- la diferencia (29px de overflow)
  confirmó el problema antes de confiar en lo que mostraba la captura.
  Lección reforzada de la sección "Responsive" de arriba: medir con
  `getBoundingClientRect()`/`scrollWidth`, no solo mirar la imagen.
- **Causa raíz**: la sección "Personal" (agregada después del último rediseño
  responsive) subió el conteo de ítems de nav de 5 a 6, sin volver a probar
  el breakpoint de celular con el conteo nuevo.
- **Arreglo**: mismo criterio que ya se usaba para los ítems de nav (solo
  ícono, sin texto, con `title`/`aria-label` para conservar el nombre
  accesible) aplicado también al texto del logo -- `.sidebar-brand-text {
  display: none }` a ≤560px, dejando solo la marca "B". Libera ~73px,
  suficiente para que los 6 íconos quepan sin desbordar (0px de overflow
  medido tras el cambio). No afecta tablet/escritorio (la regla vive dentro
  del mismo `@media (max-width: 560px)` que ya existía).
- **Nota aparte, no relacionada con el bug**: `body` no tiene un reset de
  margin explícito en ningún lado del archivo -- el margen por defecto del
  navegador (8px) se nota en las mediciones (`body.scrollWidth` = ancho de
  viewport − 16px). No causó ningún problema visible en esta revisión (el
  diseño ya asume ese inset), pero vale la pena tenerlo presente si algún
  cálculo de ancho futuro no cuadra por ~16px.
- **Lección sobre la herramienta de prueba, no la app**: al verificar la
  navegación por teclado de las pestañas (ver "Patrón ARIA de pestañas
  completo" más abajo) en este mismo repaso, un clic disparado por
  coordenadas en vez de por `id` aterrizó bien (confirmado contra
  `document.querySelector('.nav-item.active')`), pero identificar a simple
  vista CUÁL ícono quedó resaltado en una captura de 18×18px es propenso a
  error -- confirmar el tab activo por JS (`.nav-item.active` /
  `data-view`), no solo por lectura visual de la captura.

## README.md y 404.html

Hallazgo BAJO de la auditoría: no había ningún `README.md` (solo
`CLAUDE.md`, que es contexto para asistentes de IA, no documentación de
producto) ni una página 404 personalizada -- un enlace roto caía en la 404
genérica de GitHub Pages. Se agregaron ambos; `404.html` reutiliza los
colores/tipografía de la paleta actual en una página mínima e independiente
(no reutiliza `#bitacora-root` ni el `<style>` completo de `index.html` --
sería la única otra página del sitio, no vale la pena duplicar todo el
sistema de diseño para una pantalla de error).

## Fase 1: cuentas y sincronización (Supabase, opcional)

Origen: el usuario compartió un "prompt maestro" pidiendo evolucionar la app
hacia una plataforma completa de contratación estatal (descubrimiento,
inteligencia de proceso, preparación de oferta, inteligencia competitiva --
25 entidades de datos, IA/RAG, jobs, planes de suscripción). Auditoría previa
a implementar: la app es 100% estática (un solo `index.html`, sin backend, sin
base de datos, sin auth -- todo el "modelo de datos" de hoy son ~9 claves en
`localStorage`, ver más abajo) alojada en GitHub Pages, así que el roadmap
completo no es una extensión, es construir infraestructura nueva desde cero.
Decisiones tomadas junto con el usuario antes de escribir código: (1) empezar
solo por la Fase 1 (arquitectura + modelo de datos), no comprometerse al
roadmap de 14 fases de una vez; (2) Supabase (Postgres + Auth) como backend,
en vez de Firebase o un backend propio -- gestionado, gratis para empezar, y
el modelo relacional de la plataforma completa encaja mejor en SQL que en
NoSQL; (3) posponer cualquier LLM real (búsqueda en lenguaje natural, resumen
ejecutivo, chat con citaciones, red flags) para una fase posterior, porque
tiene costo por uso y no es necesario para tener cuentas + sincronización
funcionando.

**Qué hace esta fase, en concreto**: agrega cuentas de usuario y
sincronización de datos entre dispositivos, opcional y con cero regresión si
no se activa. NO agrega ningún LLM, ningún buscador en lenguaje natural, ni
ninguna de las funcionalidades de las fases 2 en adelante del prompt
maestro -- esas siguen pendientes y deliberadamente fuera de esta fase.

**El "modelo de datos" real de hoy, antes de esta fase**: toda la persistencia
de la app pasa por una única interfaz `window.storage.get(key)` /
`window.storage.set(key, value)` (un shim que usa `localStorage.getItem/
setItem('bitacora_' + key, ...)` cuando corre como sitio independiente). Las
claves usadas hoy son: `historial`, `perfiles_empresa`, `perfil_activo_id`,
`perfiles_activos`, `perfil_empresa` (legado, se migra), `analisis_pliegos`,
`experiencia_evaluacion`, `perfiles_profesionales`, `personal_activo_id`,
`ultima_vista`. Cada valor es texto (JSON.stringify de lo que haga falta), no
hay ninguna tabla ni relación -- es la razón por la que el diseño de abajo usa
una tabla clave-valor genérica en vez de normalizar cada cosa por separado.

**Diseño elegido**: en vez de reescribir `loadHistorial`/`loadPerfiles`/etc.
para hablar con tablas específicas, se mantiene exactamente la misma interfaz
`get(key)`/`set(key, value)` y se le agrega un backend remoto detrás -- así
CERO lógica de negocio existente se toca. El respaldo real es una tabla
genérica `app_state(company_id, key, value)` con Row Level Security por
empresa (`supabase/schema.sql`), que espeja 1:1 esas mismas 10 claves. Cuando
una fase futura necesite de verdad cruzar filas entre empresas (ej.
inteligencia competitiva) o consultar relacionalmente sobre alguno de estos
datos, ESA clave puntual se normaliza a su propia tabla entonces -- no hace
falta normalizar todo de una vez ("no reescritura masiva sin justificarla",
regla explícita del prompt maestro del usuario).

**Modelo de tenant**: `companies` (la empresa) + `company_members` (usuario
↔ empresa, con `role`). En esta fase, 1 usuario = 1 empresa, creada
automáticamente por un trigger de Postgres (`handle_new_user`, `security
definer`) al registrarse -- el frontend nunca crea la empresa por su cuenta
(ni podría: sin la fila de `company_members` previa, las políticas de RLS le
niegan el insert). `company_members` ya deja la puerta abierta a varios
usuarios por empresa (plan Enterprise) sin migrar el esquema más adelante.

**Aislamiento entre empresas (punto de seguridad explícito del prompt
maestro: "un usuario nunca debe poder ver información de otra empresa")**: se
hace cumplir con Row Level Security de Postgres, NO en el frontend -- la app
es 100% cliente (llama a Supabase directo desde el navegador, sin backend
propio de por medio), así que RLS es la única barrera real, no una
conveniencia. Cada política de `app_state`/`companies` exige que
`company_id` esté en la lista de empresas de las que el usuario autenticado
(`auth.uid()`) es miembro.

**Cero regresión mientras no se active**: `SUPABASE_URL`/`SUPABASE_ANON_KEY`
(constantes al principio del `<script>`, mismo patrón que
`SOCRATA_APP_TOKEN`) empiezan vacías. Con ellas vacías, `SUPABASE_ENABLED` es
`false` y todo el bloque de cuenta queda inerte: no se toca `.sidebar-foot`,
no se agrega ningún listener al modal, `window.storage.get/set` se comportan
exactamente como el shim original. Ningún usuario ve un cambio hasta que se
completen las dos constantes.

**CSP**: se agregó `https://*.supabase.co` a `connect-src` DE ANTEMANO,
aunque las constantes empiecen vacías -- mismo error que ya se vio una vez
con Tesseract.js (CSP bloqueando en silencio, sin que la app muestre error
propio): mejor dejarlo listo ahora que olvidarlo el día que se completen las
credenciales. `script-src` no necesitó tocarse: supabase-js se sirve desde
`cdn.jsdelivr.net`, ya permitido para los otros 3 scripts de terceros.

**SRI**: igual que pdf.js/Tesseract.js/xlsx, `supabase-js` se carga con
versión exacta pineada (`2.116.0`, no `@2` flotante) + hash `integrity`
calculado contra el archivo real de jsDelivr para esa versión -- `tests/
smoke.mjs` ahora espera 4 pares script/integrity en vez de 3.

**Migración de datos existentes**: al iniciar sesión por primera vez en una
cuenta, si esa cuenta todavía no tiene NINGÚN dato en `app_state`, se copian
de una vez las claves que ya hubiera en `localStorage` de ese navegador --
para que un usuario que ya venía usando la app sin cuenta no "pierda" sus
perfiles/experiencia al crear una. Si la cuenta YA tenía datos (otro
dispositivo sincronizó primero), no se pisan -- se asume que los datos de la
nube son los vigentes.

**Cómo activar esto (para el usuario, no para un futuro yo)**:
1. Crear un proyecto en [supabase.com](https://supabase.com) (plan gratuito
   alcanza para empezar) -- esto requiere una cuenta, que un asistente de IA
   no puede crear en nombre de nadie.
2. En el SQL Editor del proyecto, pegar y correr todo `supabase/schema.sql`.
3. En Project Settings → API, copiar el "Project URL" y la "anon public key"
   (la "service_role key" NUNCA debe pegarse en el frontend -- puede
   saltarse RLS por completo; esta arquitectura no la necesita en ningún
   momento, porque el navegador habla con Supabase directo y RLS es la
   barrera).
4. Pegar esos dos valores en las constantes `SUPABASE_URL`/`SUPABASE_ANON_KEY`
   al principio del `<script>` de `index.html`.
5. Opcional: en Authentication → Providers → Email, decidir si se exige
   confirmación por correo antes de poder iniciar sesión (activado por
   defecto en Supabase) -- no es una decisión que competa cambiar sin que el
   usuario lo pida.

**Limitación conocida, a propósito**: el punto de entrada al modal de cuenta
vive en `.sidebar-foot`, que ya se ocultaba en celular (≤560px) desde antes de
esta fase (ver "Bug real de responsive..." arriba) -- por alcance de Fase 1
(y para no arriesgar reintroducir el overflow de 6 íconos que se arregló en
esa misma sección), la gestión de cuenta es de escritorio/tablet por ahora.
Si el uso real de cuentas despega, vale la pena agregar un punto de entrada
específico para celular en una fase posterior.

**Qué NO se implementó a propósito, por ahora** (todo esto sigue en el
prompt maestro del usuario, pendiente para fases futuras que el usuario
decida encarar): recuperar contraseña, invitar miembros a una empresa
(aunque el esquema ya lo permite), cualquier LLM/RAG, alertas, SECOP I,
inteligencia competitiva, generación de documentos, planes de suscripción con
límites reales.

**Activación real, verificada de punta a punta**: el usuario creó su propio
proyecto de Supabase, corrió `supabase/schema.sql`, y `SUPABASE_URL`/
`SUPABASE_ANON_KEY` ya llevan sus valores reales (no vacíos) -- son datos
diseñados por Supabase para ir embebidos en código de cliente, protegidos por
RLS y no por secretismo, igual que se documenta arriba. Antes de publicar se
probó el flujo completo real (no solo local/simulado): registro, login,
guardar un dato desde "Perfil de la empresa" y confirmar que sobrevive un
recargue de página -- y, por separado, que sin sesión (`curl` con la sola
anon key) las tres tablas siguen devolviendo `[]`, confirmando que RLS aísla
la cuenta real igual que aislaba cuando la cuenta no existía.

## Bug real encontrado activando Fase 1: el modal de cuenta no cerraba

Al probar el login real con el usuario, el popup de "Iniciar sesión" se
quedaba en pantalla sin importar qué se hiciera -- ni el botón ✕, ni clic en
el fondo oscuro, ni la tecla Escape lo cerraban. Los tres mecanismos de
cierre fallando A LA VEZ, sin ningún error en consola ni en Network, fue la
pista de que no era un problema de lógica (los tres usan funciones/casos
distintos) sino algo más básico compartido por los tres.

- **Causa raíz**: la regla `#bitacora-root .account-modal-backdrop {
  display: flex; ... }` es una regla de AUTOR (mía), y una regla de autor con
  `display` le gana SIEMPRE a la regla por defecto del navegador para
  `[hidden]` (`[hidden] { display: none }`) -- sin importar especificidad,
  el origen de la regla decide primero. Resultado: `elemento.hidden = true`
  seguía poniendo el atributo `hidden` correctamente (confirmado por JS), pero
  visualmente no cambiaba nada -- `getComputedStyle(el).display` daba
  `"flex"` tanto con `hidden` en `true` como en `false`. El modal quedaba
  visible desde el momento en que cargaba la página (con las credenciales de
  Supabase ya configuradas), no solo después de abrirlo.
- **Por qué no se detectó al construirlo**: cada vez que "probé" el cierre
  (en esta sesión y en la anterior), verifiqué el ATRIBUTO `hidden` vía JS
  (`document.getElementById(...).hidden === true`), que sí cambiaba
  correctamente -- nunca hasta ahora verifiqué el ESTILO COMPUTADO
  (`getComputedStyle(...).display`) ni tomé una captura de pantalla de una
  carga nueva de la página SIN tocar nada. Es la misma lección que ya dejó
  el bug de overflow de celular más arriba ("medir con `scrollWidth`, no
  solo mirar"), aplicada aquí al revés: medí el estado de JS en vez del
  render real, cuando el render real era justamente lo que estaba roto.
- **Arreglo**: agregar `#bitacora-root .account-modal-backdrop[hidden] {
  display: none; }` -- mismo patrón que el código ya usaba para
  `.view[hidden]` más arriba en el archivo (una regla de autor MÁS
  específica, todavía de autor, que si gana por especificidad normal dentro
  del mismo origen). Verificado con clics/eventos reales (no solo
  manipulación directa del atributo) que los tres mecanismos de cierre
  funcionan, en una carga de página con caché evitada (`?v=N` en la URL --
  la navegación normal de la herramienta de prueba a veces reusaba una
  versión cacheada del CSS entre ediciones, lo que casi hizo parecer que el
  arreglo no funcionaba).
- **Efecto colateral al arreglarlo**: el chequeo de CSP de `tests/smoke.mjs`
  (#4) no entendía comodines (`https://*.supabase.co`) al comparar contra un
  host literal real (`https://mfqdeqxuwnczexonhlxu.supabase.co`, que
  apareció en el código recién al activar las credenciales) -- se le agregó
  soporte para matchear por sufijo cuando la CSP declara un comodín.

## Fase 4 del prompt maestro: alertas por criterios guardados

Primera funcionalidad nueva sobre la base de Fase 1 (cuentas/sincronización).
Del prompt maestro del usuario, punto 5 ("Sistema de alertas"): guardar una
búsqueda y que avise cuando aparezcan procesos nuevos que coincidan.

**Decisión de alcance, acordada explícitamente con el usuario antes de
construir**: el prompt maestro pide correo automático aunque la app esté
cerrada, lo cual exige infraestructura que hoy no existe -- un job programado
(no hay backend propio; se necesitaría una Edge Function de Supabase +
`pg_cron`) y un servicio de correo transaccional (cuenta nueva que solo el
usuario puede crear, ej. Resend). Se optó por la versión más simple para
empezar: **alertas solo dentro de la app, sin correo ni push** -- se revisan
al abrir la app y bajo demanda ("↻ Revisar ahora"), nunca en segundo plano
mientras está cerrada. El correo/job programado queda como posible fase
futura si el usuario decide encararla (implica crear esa cuenta de correo).

**Diseño de datos**: NO se creó ninguna tabla SQL nueva. Una alerta es
`{ id, nombre, keywords, geos, minV, maxV, creadaEn, ultimaRevision,
ultimoConteo }`, guardado bajo la clave `alertas_guardadas` con el MISMO
`window.storage.get/set` que usa el resto de la app -- funciona igual con
cuenta conectada (sincroniza vía `app_state` en Supabase, ver Fase 1) o sin
ella (solo este navegador). Se agregó a `SYNCED_KEYS` para que migre al
conectar una cuenta por primera vez, igual que los demás datos. Se prefirió
esto sobre una tabla relacional propia porque una alerta no necesita
consultarse desde otras filas/empresas (a diferencia de, por ejemplo, la
futura inteligencia competitiva) -- normalizarla aparte no daría ningún
beneficio real hoy.

**Motor de evaluación**: reutiliza EXACTAMENTE la lógica de "Buscar
procesos" -- `fetchAllForDataset` para la consulta en vivo,
`normalize`/`matchesTerm`/`matchesGeo` para decidir si un registro coincide.
Ninguna alerta reinterpreta por su cuenta qué es una coincidencia. "Nuevo" se
define como: coincide con los criterios de la alerta Y su
`fecha_de_publicacion_del` es posterior a `ultimaRevision` de esa alerta. A
propósito NO cae al snapshot de respaldo si la consulta en vivo falla (a
diferencia de `runSearch`) -- comparar "nuevos" contra una muestra vieja y
estática daría un conteo falso, así que la alerta queda marcada con error en
vez de mostrar un número que no es real.

**Cuándo se revisan**: al arrancar la app (dentro del mismo `appReady.then()`
que ya restauraba experiencia/personal), en segundo plano -- no bloquea el
primer render, y al terminar se vuelve a dibujar sola la lista. También bajo
demanda con el botón "↻ Revisar ahora" en "Buscar procesos". Ver "Ver
nuevos" (por alerta, en el Dashboard o en "Buscar procesos") aplica los
criterios guardados a los campos de búsqueda, corre `runSearch()` de
verdad, y recién ahí marca la alerta como revisada (vuelve a 0) -- mostrar
el número en una tarjeta no cuenta como "vista", tiene que abrirse.

**Bug real encontrado al probar "Ver nuevos"**: una alerta marcaba
correctamente "121 nuevos", pero al abrir esos resultados en "Buscar
procesos" la pantalla mostraba "0 procesos". Causa: los checkboxes "Solo
publicados hace ≤30 días" y "Solo Licitación Pública" (marcados por defecto,
ver "Responsive"/flujo principal) seguían activos y no son parte de los
criterios de una alerta -- tapaban justo los procesos que la alerta había
encontrado. Arreglo: `verNuevosDeAlerta` desmarca esos dos filtros antes de
correr la búsqueda (no toca "Ocultar vencidos", que sigue teniendo sentido
igual). Verificado con datos reales: la misma alerta pasó de "0 procesos" a
"40 procesos" tras el arreglo.

**Bug real, más general, encontrado de paso (no específico de alertas)**:
`actualizarDashboard()` solo se llamaba al ENTRAR a la vista "Inicio" por
clic de navegación -- nunca al terminar de cargar los datos. Con
`localStorage` esto era invisible (la carga tardaba un microtask, casi
instantánea); con una cuenta de Supabase conectada, `window.storage.get` es
una consulta de red real, y si "Inicio" (o "Buscar procesos") es la vista
CON LA QUE ARRANCA LA PÁGINA, se quedaban mostrando ceros/vacío para
siempre, porque nada los volvía a dibujar después de que los datos
realmente llegaran. Se agregaron `actualizarDashboard()`/
`renderFlujoStepper()`/`rerender()`/`renderAlertasList()` al bloque
`appReady.then(...)` que ya existía (junto a `renderPersonalSelect()` y
similares) -- llamarlas ahí es barato (son solo-render) incluso si esa vista
no es la visible en ese momento.

**UI**: panel "Alertas guardadas" dentro de "Buscar procesos" (guardar,
listar, ver nuevos, eliminar) + resumen "Alertas" en el Dashboard (solo
lectura + "Ver"). Reutiliza componentes existentes sin CSS nuevo de
estructura (`.titleblock`, `.recent-list`/`.recent-item`, `.field`,
`.link-btn`) -- solo se agregó una variante de badge, `.tag.nuevo`
(paleta `--warning`, ya existente).

## Fase 2 del prompt maestro: SECOP I (solo en adjudicaciones, no en búsqueda)

**Investigación antes de construir**: el prompt maestro pide "SECOP I +
SECOP II" en el buscador centralizado. Antes de agregarlo a ciegas se
consultó el dataset real -- "SECOP I - Procesos de Compra Pública" (Colombia
Compra Eficiente, dataset `f789-7hwg` en datos.gov.co) -- y resultó tener
6.4 millones de filas, de las cuales la enorme mayoría son historial ya
cerrado, no oportunidades abiertas:

```text
Celebrado (contrato firmado)      3.9M
Liquidado                         1.7M
Convocado                         474K
Terminado sin liquidar            191K
Borrador / convocatoria abierta /
  lista corta / expresión interés  ~2,700   <- lo único parecido a "abierto"
```

Esto tiene sentido: desde 2021 los procesos NUEVOS se publican en SECOP II;
SECOP I quedó como archivo histórico (más algunos procesos residuales de
entidades pequeñas). El esquema de columnas también es completamente
distinto al de SECOP II (`nombre_entidad`, `objeto_a_contratar`,
`cuantia_contrato`, `nom_razon_social_contratista`... en vez de `entidad`,
`objeto_del_proceso`, `precio_base`...), y el registro ya junta proceso +
contrato (no hay un campo `adjudicado` sí/no separado como en SECOP II).

**Decisión, presentada y acordada con el usuario antes de implementar**: NO
agregarlo a "Buscar procesos" (el universo de ~2,700 realmente abiertos, de
6.4M, no justificaba el riesgo de mezclar contratos ya cerrados con
oportunidades reales). SÍ usarlo para ampliar **"Ver adjudicaciones de esta
entidad"** (dentro de la Evaluación go/no-go) -- ahí el histórico adicional
es puro valor: ver el comportamiento de contratación de una entidad más
atrás de 2021, que es justo lo que SECOP II no puede mostrar por sí solo.

**Implementación**: `buscarAdjudicaciones(entidad)` ahora consulta SECOP II
y SECOP I EN PARALELO (`Promise.allSettled` -- si una tabla falla o tarda
demasiado, la otra igual muestra sus resultados; con 6.4M de filas en SECOP
I, un timeout ahí no debía tumbar lo que sí llegó de SECOP II). Cada fuente
tiene su propia función de extracción (`deSecopII`/`deSecopI`, dentro de
`buscarAdjudicaciones`) porque el criterio de "está adjudicado" es distinto
en cada una:
- SECOP II: campo `adjudicado` = "Si"/"Sí", o un valor de adjudicación > 0.
- SECOP I: no existe ese campo -- se infiere adjudicado si el registro trae
  contratista (`nom_razon_social_contratista`) o un valor de contrato
  (`valor_contrato_con_adiciones`/`cuantia_contrato`) mayor a 0.

Ambas comparten el mismo `ancla`/`coincide` (misma entidad buscada) y se
mezclan y ordenan juntas por valor adjudicado. Cada fila de la lista muestra
de qué fuente viene (`<span class="tag fuente">SECOP I/II</span>`, mismo
componente que ya usaban las tarjetas de "Buscar procesos"). Se agregó
`$order=fecha_de_cargue_en_el_secop DESC` a la consulta de SECOP I -- sin
orden, `$limit=400` sobre una tabla de 6.4M filas podría devolver una
muestra vieja y no representativa.

**Verificado con una entidad real (INVIAS)**: 216 adjudicaciones combinadas
(170 de SECOP II, 46 de SECOP I), ordenadas correctamente por valor, cada
una con su etiqueta de fuente. Probado en los 3 breakpoints sin overflow ni
errores de consola.

**Nota para el futuro**: si alguna vez se reconsidera agregar SECOP I a
"Buscar procesos", filtrar estrictamente por
`estado_del_proceso in ('Borrador', 'Convocado', 'Publicación para
manifestaciones de interés', 'Expresión de Interés', 'Lista Corta')` --
"Convocado" por sí solo no basta (474K filas, probablemente incluye
procesos viejos que solo se actualizaron en el sistema, no publicaciones
recientes reales) -- valdría la pena cruzar también contra una fecha
reciente antes de mostrarlo como "oportunidad abierta".

## LLM para lenguaje natural: implementado y luego eliminado

Se construyó por completo (proxy server-side obligatorio vía Edge Function
propia, `ANTHROPIC_API_KEY` como secret, límite diario por empresa en una
tabla `llm_usage` sin RLS, `tool_choice` forzado para extracción
estructurada) pero **nunca llegó a desplegarse** -- el usuario decidió no
gastar en la API de Anthropic ("Por el momento no quiero gastar dinero")
justo antes del paso de activación, y unos días después, reconsiderándolo,
pidió eliminar la opción por completo ("Pensándolo bien, deseo eliminar la
opción de Buscar en lenguaje natural de la app").

**Qué se eliminó** (todo, nada quedó a medias -- se le preguntó al usuario
el alcance y confirmó "todo, incluida la tabla en Supabase"): el panel y la
función `runBusquedaNatural` de `index.html`, el host
`https://*.functions.supabase.co` de la CSP (ya no lo usa nada -- `daily-
digest` la invoca un cron server-side, no el navegador, así que nunca
necesitó estar en la CSP), el archivo `supabase/functions/nl-search/
index.ts`, la sección `llm_usage` de `supabase/schema.sql`, y la tabla
`llm_usage` en la base de datos real (estaba vacía y sin uso -- `drop
table` sin ningún riesgo de pérdida de datos).

**Por qué queda esta nota en vez de solo borrar la sección**: para que una
sesión futura no proponga reconstruir esto sin saber que ya se hizo una vez
y se descartó deliberadamente por costo, no por que no funcionara -- el
diseño (documentado en el historial de commits, `git log --grep=nl-search`)
seguía siendo válido si algún día se retoma.

## Fase 8 del prompt maestro: sugerencia de oferta económica

Del prompt maestro del usuario, punto 15 ("Preparar oferta económica").
Elegida como siguiente paso (en vez del LLM, pospuesto) porque no necesita
ninguna cuenta nueva ni tiene costo: es aritmética pura sobre el MISMO
historial de adjudicaciones que ya trae "Ver adjudicaciones de esta entidad"
(Fase 2, SECOP I+II) -- se construye directamente encima de ese trabajo.

**Método**: de las adjudicaciones "comparables" de la entidad (misma banda
0.3-1.3 entre valor adjudicado y precio base que ya usaba el listado --
factorizada a `descuentoComparable()` para no repetir el umbral en dos
lugares), se calculan tres escenarios aplicando al presupuesto oficial del
proceso actual:
- **Conservador** = el descuento más leve que la entidad ha aplicado en su historial.
- **Competitivo** = la mediana de sus descuentos históricos.
- **Agresivo** = el descuento más fuerte visto.

Cada escenario queda topado al presupuesto oficial (ofertar por encima lo
descalifica en la mayoría de modalidades). Si hay menos de 3 adjudicaciones
comparables (`OFERTA_MIN_MUESTRA`), se dice explícitamente que no alcanza
para hablar de un patrón -- **nunca se inventa un número sin base real**,
mandato explícito del punto 15 del prompt maestro ("no presentar el valor
sugerido como garantía de adjudicación... mostrarlo como estimación/
referencia").

**UI**: se integró donde ya se pedían las adjudicaciones (`.eval-adj-btn`,
en "Evaluación"), no como una sección nueva aparte -- el análisis económico
depende de los mismos datos que esa consulta ya trae, así que agregarlo ahí
evita una segunda consulta y mantiene el flujo en un solo clic. Reutiliza
`.stat-grid`/`.stat-card` (el mismo componente de las 4 tarjetas del
Dashboard) en vez de CSS nuevo; solo se agregaron 3 modificadores de color
semántico (`.oferta-conservador/-competitivo/-agresivo`, verde/ámbar/rojo,
tokens ya existentes) para distinguir los escenarios de un vistazo.

**Verificado con datos reales**: entidad con historial insuficiente (0
adjudicaciones comparables) mostró el mensaje explícito correctamente, sin
inventar nada; una Gobernación con 41 adjudicaciones comparables mostró
$33.810.000 presupuesto → conservador/competitivo iguales ($33.810.000,
0.0%) y agresivo $13.614.356 (-59.7%), cifras reales derivadas de su
historial real. Probado en los 3 breakpoints sin overflow ni errores de
consola.

## Fase 11 del prompt maestro: inteligencia competitiva (ficha de empresa)

Del prompt maestro del usuario, puntos 18-19 ("Competencia" / "Perfil de
empresa"). Es la misma consulta que `buscarAdjudicaciones` (Fase 2) pero
invertida: en vez de "¿a quién le ha adjudicado esta entidad?" pregunta
"¿con quién y cuánto ha contratado esta empresa?" -- filtra por CONTRATISTA
(`nombre_del_proveedor` en SECOP II, `nom_razon_social_contratista` en SECOP
I) en vez de por entidad. Se factorizó `prepararBusquedaPorNombre()` (ancla
`$q` + coincidencia tolerante de nombre) fuera de `buscarAdjudicaciones` para
que ambas funciones compartan el mismo criterio de matching, en vez de tener
dos copias del mismo algoritmo.

**Nueva sección de navegación** ("Competencia", 7º ítem): el prompt maestro
pide un módulo de nivel superior, no un botón escondido dentro de otra
vista. Con esto vino, previsiblemente, el mismo bug de overflow que ya se
vio al agregar "Personal" (documentado arriba) -- confirmado con la misma
técnica (`sidebar.scrollWidth - sidebar.clientWidth`, 6px de overflow a
375px real). Arreglo más chico esta vez: bajar el padding de `.nav-item` de
10px a 8px en el breakpoint de celular alcanzó, sin necesitar ocultar nada
más. Lección reforzada: cada ítem de nav nuevo hay que volver a medir el
ancho del sidebar en celular, no asumir que "cabe parecido a los anteriores".

**Agregación**: `agregarFichaEmpresa()` agrupa los contratos encontrados por
entidad (`agruparContratos`, reutilizada también para sectores) y por año de
fecha de firma/adjudicación (descartando fechas no plausibles, mismo criterio
`isPlausibleDate` que el resto de la app). "Sectores" usa `tipo_de_contrato`
en SECOP II y `nombre_familia`/`nombre_grupo` en SECOP I -- se prefirió esto
sobre el código UNSPSC (`codigo_principal_de_categoria`) de SECOP II porque
no hay una tabla de traducción código→nombre disponible, y un código numérico
solo no le dice nada al usuario.

**Gráficos sin librería**: "Principales entidades" y "Contratos por año" se
dibujan con barras horizontales de puro CSS (ancho proporcional vía
`style="width:N%"` sobre un `.comp-bar-track`/`.comp-bar-fill`), no con una
librería de charts -- coherente con que la app no tiene ninguna dependencia
de gráficos y esto no ameritaba agregar una. `filaBarra()` recibe el `pct`
ya calculado por el llamador (no decide él mismo contra qué normalizar cada
serie), para poder reusarse igual entre "valor de entidad vs. máximo entre
entidades" y "contratos de un año vs. máximo entre años" sin un hack de
reemplazo de string (primer intento, corregido antes de probarlo en el
navegador: ver historial de edición de este archivo si hace falta el porqué
exacto de por qué ese primer enfoque era frágil).

**Limitación real encontrada probando con datos reales**: buscar "CONSORCIO
DSC" (nombre corto, con una sigla de 3 letras que el filtro de tokens de
`prepararBusquedaPorNombre` descarta por ser <4 caracteres) no encontró nada
-- el ancla de búsqueda queda en la palabra genérica "consorcio", que trae
una muestra de cientos de consorcios distintos sin relación real. Buscar
"ECOPETROL" (nombre distintivo, ≥4 caracteres) sí funcionó de punta a punta:
114 contratos, 25 entidades, $1.16 billones COP, con "Principales entidades"/
"Sectores"/"Contratos por año" todos con datos reales y coherentes. El
mensaje de "no encontrado" se actualizó para explicar esta limitación y
sugerir agregar una palabra más distintiva de la razón social completa, en
vez de dejar al usuario sin ninguna pista de por qué no encontró nada.

## Fase 12 del prompt maestro: seguimiento de empresas

Del prompt maestro del usuario, punto 21 ("Seguimiento de empresas"). Se
construye directo encima de la Fase 11 (ficha de empresa) recién hecha:
"seguir" una empresa guarda su nombre y compara, contra el mismo
`buscarFichaEmpresa()` de la ficha manual, qué contratos tienen fecha
posterior a la última revisión -- arquitectura casi idéntica a "Alertas
guardadas" (Fase 4: misma clave de almacenamiento genérica vía
`window.storage`, mismo patrón revisar-en-el-arranque + botón "Revisar
ahora", mismo "ver = marcar como revisado").

**Alcance recortado a propósito, distinto del ejemplo del prompt maestro**:
el prompt maestro pide avisar cuando una empresa aparece como "proponente,
adjudicatario, contratista, o posible competidor" en un proceso -- pero el
dataset abierto de SECOP no publica la lista de proponentes/oferentes por
proceso (solo conteos agregados como `proveedores_unicos_con`), así que es
IMPOSIBLE saber con estos datos cuándo una empresa "se presentó" sin ganar.
Se avisa únicamente de lo que sí se puede verificar: cuándo aparece como
CONTRATISTA en un contrato nuevo. Inventar la actividad de "proponente" sin
poder verificarla habría violado el principio ya establecido en toda la app
("no inventar", puntos 32-33 del prompt maestro).

**Feed real, no solo un contador**: a diferencia de las alertas (que solo
muestran "N nuevos"), aquí se guarda además `feedReciente` (hasta 5 items:
entidad, fuente, fecha, valor) para poder mostrar líneas de actividad
legibles tipo "Apareció como contratista en un contrato con [entidad]
(SECOP [I/II])" -- más cercano al ejemplo del prompt maestro ("Empresa XYZ
ganó el proceso DEF") que un simple badge numérico. Se decidió persistir
este feed pequeño (no es texto largo) para que el Dashboard pueda mostrar
actividad real sin tener que re-consultar SECOP en cada carga.

**Botón "Seguir/Dejar de seguir"** integrado directo en `renderFichaEmpresaHtml`
(Fase 11) en vez de un flujo aparte -- el usuario ya está viendo la ficha de
la empresa que le interesa, seguirla desde ahí es el punto natural. El botón
cambia de estado sin repetir la consulta a SECOP: se guarda el último
resultado de `buscarFichaEmpresa` en `ultimosRegistrosCompetencia` y se
vuelve a dibujar solo la ficha (`renderFichaEmpresaHtml`) con los mismos
datos ya en memoria.

**Bug de secuencia de prueba (no del código) detectado al verificar**: al
probar manualmente forzando una `ultimaRevision` vieja vía
`localStorage.setItem` directo, un primer intento pareció no funcionar --
la causa real fue de la prueba, no de la app: haber hecho clic en "Revisar
ahora" ANTES de recargar la página dejó que `persistirEmpresasSeguidas()`
sobreescribiera el cambio manual con el estado en memoria (todavía con la
fecha original). Lección para probar esta clase de función en el futuro:
editar `localStorage` y recargar la página ANTES de disparar cualquier
acción que persista, nunca al revés.

**Verificado con datos reales**: seguir "ECOPETROL", forzar una revisión
"desde 2020", y "Revisar ahora" mostró correctamente "109 nuevo(s)" con un
feed de 5 contratos reales (entidad, fuente, valor); "Ver" navegó a
"Competencia", re-buscó la empresa, mostró los resultados y volvió el
contador a cero; "Dejar de seguir" limpió la lista. Tests de humo 5/5.
Probado en los 3 breakpoints sin overflow ni errores de consola.

## Fase 13 del prompt maestro: capacidad contractual estimada

Del prompt maestro del usuario, punto 24 ("Capacidad contractual estimada").
El campo "Capacidad K residual" del perfil (ver punto 11 de "Cosas
aprendidas": el RUP de Confecámaras NO trae ese dato, se llena a mano) es un
valor declarado en un momento dado -- se vuelve obsoleto en cuanto la empresa
firma un contrato de obra nuevo, y nada en la app avisaba de eso.

**Investigación previa a implementar (obligatoria por el principio "no
inventar")**: antes de tocar código se investigó la metodología oficial de
Colombia Compra Eficiente para la Capacidad Residual de Contratación (Art.
2.2.1.1.1.6.4 del Decreto 1082 de 2015 + la guía CCE-REC-GI-22). Esa fórmula
completa combina factores de experiencia, capacidad financiera, técnica y
organizacional certificados en el RUP -- reproducirla en el navegador
significaría re-certificar de facto el RUP de la empresa, algo que ni el
RUP mismo hace (por eso el campo se llena a mano) y que esta app no tiene
forma de verificar. Intentar aproximarla sin esos índices habría sido
inventar un número con apariencia oficial sin serlo.

Lo que SÍ es una regla fija, pública y simple de aplicar -- no depende de
índices certificados -- es el cálculo del **Saldo de los Contratos en
Ejecución (SCE)**, de la Ley 1682 de 2013 / Decreto 791 de 2014: la suma de
los saldos pendientes de los contratos de obra vigentes de la empresa,
prorrateados linealmente a 12 meses (360 días) cuando el plazo de ejecución
restante de un contrato supera ese plazo. Fase 13 implementa ÚNICAMENTE esa
parte, y la etiqueta siempre como "estimada" -- mismo criterio de
transparencia que la "Sugerencia de oferta económica" de Fase 8 (pura
aritmética, sin IA, explícita sobre qué NO cubre).

**Qué se agregó**: en "Perfil de la empresa", bajo cada perfil, una sección
"Capacidad contractual estimada" donde se registran los contratos en
ejecución de esa empresa (entidad/objeto opcional, saldo pendiente, fecha de
terminación). Con eso se calcula:

- `calcularSCE(contratos, hoyMs)` -- SCE por contrato, con la regla del
  prorrateo a 360 días; ignora (y explica por qué) contratos sin saldo/fecha
  válidos o ya vencidos. `hoyMs` es inyectable para poder testear la regla
  del prorrateo sin depender del reloj real.
- `capacidadContractualEstimada(perfil)` -- K residual declarado (solo si
  está en COP; si está en SMMLV o vacío, no hay nada confiable que restar y
  se explica en la UI) menos el SCE. Sin contratos registrados, la
  disponible es igual a la declarada -- mismo comportamiento que antes de
  esta fase, sin cambios para quien no usa esta sección nueva.

Ese resultado se inyecta en `matrizCapacidad(p)`: si hay contratos
registrados, el `kResidual` que entra en los gates de `evaluarProceso`
("Capacidad vs valor" y "Capacidad K residual") pasa a ser la disponible
ESTIMADA en vez de la cruda -- un solo punto de inyección, sin tocar la
lógica de los gates, y los mensajes se ajustan ("tu capacidad disponible
estimada" en vez de "tu K residual") solo cuando aplica.

**Bug real evitado antes de probar (no llegó a producción)**: el patrón
existente `Object.assign({}, PERFIL_VACIO, p)` en `migrarPerfil()` /
`nuevoPerfil()` copia por REFERENCIA cualquier valor no primitivo de
`PERFIL_VACIO`. Si `contratosEnEjecucion: []` se hubiera puesto ahí como en
un primer borrador, todos los perfiles sin ese campo (todos los existentes,
y cada perfil nuevo) habrían terminado apuntando al MISMO array -- agregar
un contrato a una empresa se habría filtrado a todas las demás en silencio.
Se corrigió manteniendo `contratosEnEjecucion` FUERA de `PERFIL_VACIO` y
clonándolo/creándolo explícitamente en cada punto donde se arma un perfil
(`migrarPerfil`, `nuevoPerfil`). Verificado con datos reales: perfil A con 2
contratos + perfil B recién creado -> `localStorage` mostró los arrays
completamente independientes (ver más abajo).

**Segundo bug real evitado**: `savePerfil()` reconstruía
`perfiles[perfilActivoId]` desde cero con solo `{nombre, rup, k,
kResidual}` -- guardar el perfil (aunque sea solo para cambiar el RUP)
habría borrado en silencio los contratos en ejecución, gestionados aparte
con su propio autoguardado. Se corrigió preservando
`contratosEnEjecucion` del objeto anterior en ese mismo reconstruido.

**Sin perder el foco al escribir**: los campos de cada contrato (entidad,
saldo, fecha) actualizan el modelo en memoria y hacen autoguardado con
debounce (mismo patrón ya usado para el nombre del perfil), pero
**redibujan solo el resumen de capacidad** (`renderCapacidadEstimada`), no
la lista de filas -- si cada tecla regenerara el `innerHTML` de la lista
completa, el input activo perdería el foco y el cursor a mitad de
escritura. La lista completa solo se redibuja al agregar/eliminar una fila
o cambiar de perfil.

**Verificado con datos reales** (perfil "Empresa de prueba", K residual =
2.000.000.000): un contrato con saldo 500.000.000 y 200 días restantes
(factor 1) más otro con saldo 720.000.000 y ~500 días restantes (factor
360/500 = 0,72) dieron SCE = 1.018.400.000 y disponible = 981.600.000,
coincidiendo exactamente con el cálculo manual. Al evaluar un proceso real
(valor base 1.850.000.000) con ese perfil marcado, el gate "Capacidad vs
valor" mostró "⚠ Tu capacidad disponible estimada ($981.600.000) es menor
que el valor de la obra" -- y al borrar los contratos, sobre el MISMO
proceso volvió a "✅ Tu K residual cubre el valor de la obra" (K residual
crudo, 2.000.000.000 >= 1.850.000.000), confirmando que el comportamiento
sin contratos registrados es idéntico al de antes de esta fase. Se
confirmó también el aislamiento entre perfiles (ver bug evitado arriba),
que "Guardar perfil" no borra los contratos, que un saldo/fecha inválidos
o vencidos se excluyen del SCE con motivo explicado, y el escenario de
sobre-capacidad (contratos > K residual declarado) con la tarjeta en rojo y
el aviso "Tus contratos en ejecución superan tu K residual declarado".
Tests de humo 5/5. Probado en los 3 breakpoints (la fila de contrato
colapsa a 1 columna en mobile) sin overflow ni errores de consola.

**Nota sobre re-evaluar tras editar el perfil**: como ya pasaba con
cualquier otro campo del perfil (K, RUP...), el veredicto de un proceso ya
buscado en pantalla no se recalcula solo al editar el perfil en otra
pestaña -- hay que volver a "Buscar procesos" (una nueva búsqueda, o
cualquier cambio de filtro) y pulsar "Evaluar" de nuevo para ver el
veredicto actualizado. No es una regresión de esta fase: es una limitación
preexistente de cuándo se recalcula `s.evaluacion`, igual para todos los
campos del perfil.

## Fase 9 del prompt maestro: buscar socios (consorcios)

Del prompt maestro del usuario, punto 9 ("Buscar socios para consorcios").
Presentado al usuario con 3 alcances posibles antes de construir (mismo
patrón de confirmación que el resto de fases): (1) un directorio por
sector/clasificación, independiente; (2) sugerencia automática enganchada a
las brechas que detecta el análisis de un pliego; (3) ambas. Se eligió la
(1) -- el directorio es la pieza base que la (2) necesitaría de todos modos,
y enganchar automáticamente el análisis de pliego es un alcance mayor y
distinto (tocar `evaluarProceso`/`renderCompatibilidadHtml`) que puede
pedirse después si hace falta.

**Qué hace**: en "Competencia", una nueva búsqueda "Buscar socios
(consorcios)" -- mismos campos que "Buscar procesos" (especialidades +
departamento) pero en vez de listar procesos ABIERTOS, agrega qué EMPRESAS
ya han sido CONTRATISTAS (SECOP I+II) en procesos que coinciden con esos
criterios, ordenadas por valor total contratado -- un directorio de
candidatas a consorcio/unión temporal con experiencia verificable en el
sector, no una función de "empresas buscando socio" (eso no existe en datos
abiertos; sería inventarlo).

**Reutilización máxima, cero motor de búsqueda nuevo**: el ancla de consulta
es literalmente la misma de "Buscar procesos" (`fetchAllForDataset` +
`normalize`/`matchesTerm`/`matchesGeo` para filtrar por especialidad/
departamento), la fuente combinada SECOP I+II con `Promise.allSettled` es la
misma que `buscarAdjudicaciones`/`buscarFichaEmpresa`, y el criterio de "es
un contrato adjudicado real" (SECOP II: `adjudicado=sí` + proveedor; SECOP I:
cualquier registro con contratista) es el mismo que ya usan esas dos
funciones. Lo único nuevo es agregar por EMPRESA en vez de por entidad/nombre
buscado (`agruparPorEmpresa`, mismo patrón que `agruparContratos`).

**Se excluyen los propios perfiles del usuario** (`esPerfilPropio`,
reutilizando `prepararBusquedaPorNombre().coincide()`): sin este filtro, si
la empresa del usuario ya tiene contratos en el sector buscado, aparecería
en su propia lista de "candidatos a socio" -- una empresa no es candidata a
consorcio de sí misma.

**Integración con "Competencia" existente**: cada resultado trae un botón
"Ver ficha" (`verFichaDeSocio`) que llena el campo de "Buscar empresa" con
ese nombre y corre `runBuscarCompetencia()` tal cual -- cero renderizado
duplicado, la ficha completa (Fase 11) se reutiliza sin cambios.

**Bug real de eficiencia encontrado y corregido antes de probar en el
navegador**: `fetchSecopDataset` siempre intentaba primero `$order=
fecha_de_publicacion_del DESC` (la columna real de SECOP II) y solo
reintentaba sin orden si fallaba -- correcto para SECOP II, pero esta fase es
la PRIMERA que le pasa el dataset de SECOP I a esta función genérica (antes,
`buscarAdjudicaciones`/`buscarFichaEmpresa` construían su URL de SECOP I a
mano, con su propia columna). Sin arreglarlo, cada búsqueda de socios habría
disparado un 400 garantizado por cada ancla contra SECOP I, seguido del
reintento -- funciona igual para el usuario, pero duplica cada solicitud y
llena la consola de errores. Se agregó un parámetro `ordenCol` opcional a
`fetchSecopDataset`/`fetchAllForDataset` (por defecto la columna de SECOP II,
así que ningún llamador existente cambia de comportamiento) y
`buscarSociosPorSector` le pasa `fecha_de_cargue_en_el_secop` para SECOP I.
Verificado con una pestaña nueva del navegador (consola limpia desde cero):
0 errores, contra 4 errores 400 reproducibles antes del fix.

**Alcance recortado a propósito**: búsqueda por PALABRA CLAVE contra el
objeto del contrato, no por código UNSPSC estructurado -- a diferencia del
RUP (que si trae clasificación UNSPSC por empresa, ver Fase 11), SECOP no
expone de forma confiable el código UNSPSC de cada adjudicación individual;
estructurarlo habría aparentado una precisión que los datos no tienen. Si el
usuario escribe un código, igual puede coincidir si aparece literal en el
texto del objeto, pero no es el mecanismo principal.

**Verificado con datos reales**: "pavimentación" + "Norte de Santander"
encontró 7-8 empresas reales (consorcios y uniones temporales reales,
ej. "CONSORCIO EL CARMEN 2018", "UNION TEMPORAL ALCANTARILLADO RG CACOTA"),
con conteo de contratos, valor total, entidades distintas y fuente (I/II)
correctos. "Ver ficha" navegó a Competencia, precargó el nombre y mostró la
ficha completa real (100 contratos, $208.193.598.977, 31 entidades). Se
verificó la exclusión de perfiles propios sembrando un perfil con el mismo
nombre de un resultado real y confirmando que desaparecía de la lista en la
siguiente búsqueda. Mensajes de validación probados: sin especialidad ni
departamento ("Escribe al menos..."), y sin resultados con una palabra sin
sentido (sugerencia de término más genérico). Tests de humo 5/5. Probado en
los 3 breakpoints sin overflow ni errores de consola (ver el bug de
eficiencia arriba).

## Fase 10 del prompt maestro: generación de documentos CCE

Del prompt maestro del usuario, punto 10 ("Generación de documentos CCE").
Presentado con 4 opciones antes de construir (carta de presentación / hojas
de vida del personal / ambas / otra combinación) -- se eligió carta de
presentación de la oferta: el documento que pide prácticamente cualquier
pliego de obra pública, y el único de los dos que necesitaba campos nuevos
en el perfil (justificando la fase por sí sola; las hojas de vida de
Personal quedan pendientes para cuando se pidan, ya que no requieren datos
nuevos).

**Es una PLANTILLA, no el formato oficial**: el contenido (manifestación de
conocer el pliego, ausencia de inhabilidades/incompatibilidades, compromiso
de suscribir el contrato...) es el estándar de este tipo de carta en
contratación pública colombiana, pero cada entidad/pliego trae su propio
Anexo/Formato con numeración y a veces firma digital específica que esta
plantilla no puede replicar sin tener ese documento -- se etiqueta así de
explícito en el propio texto generado, mismo criterio que "Sugerencia de
oferta económica" (Fase 8) y "Capacidad contractual estimada" (Fase 13).

**Campos nuevos en el perfil, solo para esto**: NIT, representante legal,
cédula del representante, dirección, ciudad, teléfono, correo -- a
diferencia de K/K residual (texto libre, porque vienen de una tabla del RUP
con formato variable), estos son campos ESTRUCTURADOS de una sola línea: van
a insertarse tal cual en un documento que alguien firma, así que parsear
texto libre con regex (como se hace con K) habría arriesgado insertar el
dato equivocado en el lugar equivocado de una carta formal -- no es
aceptable el mismo margen de error que en un análisis orientativo. A
diferencia de `contratosEnEjecucion` (un array, con su propio problema de
referencia compartida, ver Fase 13), estos son strings simples y SÍ pueden
vivir directo en `PERFIL_VACIO` sin ese riesgo.

**Qué NO se puede rellenar solo, a propósito**: el valor de la oferta y el
plazo de ejecución ofrecido quedan como `[COMPLETAR]` en el texto generado.
El valor de la oferta NO es el presupuesto oficial/valor base del proceso
(eso ya se muestra aparte, y confundir los dos sería literalmente inventar
la cifra que el proponente va a firmar) -- lo decide la empresa, la app no
tiene ese dato en ningún lado.

**Botón por PERFIL, no por proceso**: a diferencia de "Descargar evaluación"
(un solo botón para el proceso completo, con todos los perfiles comparados),
"Generar carta de presentación" aparece una vez por cada perfil dentro de
"Evaluación" (`bloquePerfil`), porque el NIT/representante/contacto son de
UNA empresa puntual. Para saber de qué perfil sacar esos datos al hacer clic
se agregó `perfilId` al resultado de `evaluarProceso()` -- viene de
`matrizCapacidad(p).id`, que a su vez sobrevive a `migrarPerfil()` porque
`Object.assign` copia cualquier propiedad extra de `p` (incluida `_id`, que
ya traía `perfilesParaComparar()`), no solo las que están en `PERFIL_VACIO`.
Sin `perfilId` (perfil borrado entre que se evaluó y ahora) el botón
simplemente no se muestra, en vez de romper.

**Verificado con datos reales**: perfil "CONSTRUCTORA DEL NORTE S.A.S." con
todos los campos nuevos llenos + un proceso real de la demo -> la carta
generada sustituyó cada dato correctamente (entidad, objeto, modalidad,
NIT, representante, cédula, dirección, teléfono, correo) y dejó `[COMPLETAR:
valor de la oferta]`/`[COMPLETAR: plazo ofrecido]` donde correspondía. Con
un segundo perfil recién creado (todos los campos vacíos) la misma carta
sustituyó cada placeholder por su corchete (`[REPRESENTANTE LEGAL]`,
`[NIT]`...) sin romperse ni mostrar "undefined". Se recordó también, al
probarlo, la limitación ya documentada en Fase 13 sobre `s.evaluacion`
cacheado: agregar un segundo perfil no basta para que aparezca su botón de
carta hasta volver a "Buscar procesos" (nueva búsqueda o cambio de filtro)
y "Evaluar" de nuevo. Tests de humo 5/5. Probado en los 3 breakpoints sin
overflow ni errores de consola reales (los dos únicos errores vistos al
probar fueron de mi propio método de prueba -- un `fetch('blob:...')` para
inspeccionar la descarga, bloqueado correctamente por la CSP -- no del flujo
real de descarga, que usa `<a download>` sin pasar por `connect-src`).

## Fase 6 del prompt maestro: correo/job de alertas

Del prompt maestro del usuario, punto 6 ("Sistema de alertas" -- la parte de
correo/job que se dejó pendiente a propósito en Fase 4: "Solo en la app, sin
correo (recomendado para empezar)"). Antes de escribir código se discutió
con el usuario, igual que en Fase 1, porque **es el primer cambio de
arquitectura real desde Fase 1**: confirmó proveedor (Resend), frecuencia
(diaria) y contenido (resumen breve, no el detalle completo en el correo).

**Por qué esto NO puede vivir en `index.html`**: enviar un correo *sin que
el usuario tenga la pestaña abierta* exige algo que corra solo, en un
horario, del lado del servidor -- el navegador no puede. La única pieza de
servidor que ya existe en esta app es Supabase (Fase 1), así que el diseño
usa lo que ya está: una **Supabase Edge Function** (`supabase/functions/
daily-digest/index.ts`, Deno/TypeScript) disparada por un **cron de
Postgres** (`pg_cron` + `pg_net`, `supabase/cron.sql`) una vez al día.

**Primer secreto REAL del proyecto, y por qué necesita su propio archivo**:
a diferencia de la anon key de Supabase o el App Token de Socrata (ambos
diseñados para ir embebidos en código de cliente, protegidos por RLS o por
solo subir un límite de tasa respectivamente -- ver la nota de seguridad ya
documentada en Fase 1/Socrata), la API key de Resend SÍ es un secreto real:
quien la tenga puede enviar correos en nombre de la cuenta de Resend del
usuario. Por eso NUNCA se pega en `index.html` ni en ningún archivo del
repo -- vive únicamente como *Supabase secret* (`RESEND_API_KEY`,
configurado con `supabase secrets set`, nunca visible en el navegador ni en
git). Mismo criterio ya anotado en CLAUDE.md para un caso entonces todavía
sin construir ("LLM para lenguaje natural") -- este (`RESEND_API_KEY`) es
el primero que en realidad se desplegó; el de Anthropic se construyó
después pero nunca se desplegó, y terminó eliminado -- ver "LLM para
lenguaje natural: implementado y luego eliminado" más abajo.

**La Edge Function está protegida con un secreto compartido
(`CRON_SECRET`), no abierta al público**: una función desplegada en
Supabase tiene una URL pública alcanzable por cualquiera que la descubra.
Sin esa protección, cualquiera podría invocarla directamente y forzar el
envío de correos a todos los usuarios de la app. El cron de Postgres manda
ese mismo secreto en un header (`x-cron-secret`) en cada llamada
(`supabase/cron.sql`); la función responde 401 si no coincide.

**Duplicación deliberada de lógica, no descuido**: la Edge Function corre en
Deno, un runtime totalmente aparte del navegador -- no hay forma de
"importar" funciones de un `<script>` de `index.html` sin agregar un paso de
build, que esta app no tiene por diseño. Se portaron a mano las funciones
puras que hacían falta (`parseNumCO`, `normalizeGeo`, `matchesGeo`,
`matchesTerm` -- incluida la regla de la raíz de 6 letras para pavimento/
pavimentación --, `findField`, `prepararBusquedaPorNombre`,
`fetchSecopDataset`), cada una comentada con el nombre exacto de su
contraparte en `index.html` para que quede claro qué mantener sincronizado
si esa lógica cambia ahí. Se verificaron con un test desechable de Node
(casos ya documentados en este archivo: "PAVIMENTO FLEXIBLE" vs
"pavimentación", "Santander" NO matchea "Norte de Santander", INVIAS vs su
nombre completo) -- los 7 casos pasaron antes de dar la lógica portada por
buena.

**Qué SÍ se pudo probar en este entorno antes del despliegue real**:
- El checkbox nuevo en "Tu cuenta" ("Recibir un resumen diario...") --
  render, que no desborda el modal (`max-width:360px`) ni en 375px, que
  persiste con `window.storage.set('correo_digest_activo', ...)` y que se
  recarga correctamente al reabrir el modal.
- Sintaxis del archivo TypeScript de la Edge Function, con `tsc --noEmit`
  (sin Deno instalado en este entorno) -- cero errores de sintaxis; los
  únicos errores reportados son los esperables por faltar los tipos de Deno
  (`Deno.*`, `npm:` specifier), no problemas reales.
- La lógica pura de coincidencia (ver test desechable arriba).

**Despliegue real, hecho en esta misma sesión (a diferencia de la primera
redacción de esta fase) -- con el usuario autorizando explícitamente
ejecutar los comandos de instalación/CLI**: login (`supabase login`, hecho
por el usuario en su propia terminal -- el entorno de comandos no tiene TTY
para el flujo interactivo), `link --project-ref`, `functions deploy`, y los
dos secrets (`RESEND_API_KEY`/`CRON_SECRET`) puestos por el usuario mismo en
su terminal, nunca pegados en el chat -- ver "Cómo se manejaron los
secretos" más abajo.

**Dos bugs reales encontrados y corregidos SOLO probando el despliegue de
verdad** (ninguno de los dos era detectable sin desplegar contra un
proyecto real):
1. **La plataforma de Supabase exige su propio JWT en cada Edge Function
   por defecto**, antes incluso de que corra el código de la función -- la
   protección con `CRON_SECRET` que ya tenía el código nunca llegaba a
   ejecutarse, así que TODA solicitud (con o sin el secret correcto) recibía
   401 de la plataforma misma. Se corrigió desplegando con
   `--no-verify-jwt` y agregando `supabase/config.toml`
   (`[functions.daily-digest] verify_jwt = false`) para que quede así en
   futuros despliegues sin tener que acordarse del flag. Diagnosticado
   comparando: si `CRON_SECRET` no estuviera seteado del todo, el código
   propio NUNCA devuelve 401 (`if (cronSecret && ...)`) -- que SIEMPRE diera
   401 apuntaba a una capa anterior al código.
2. **Sin visibilidad de qué pasaba dentro de la función** (sin `supabase
   functions logs` disponible en esta versión del CLI), un fallo real de
   Resend ("API key is invalid" -- la key configurada la primera vez no era
   válida) quedaba atrapado en silencio por el `catch` que evita que un
   error de una empresa tumbe la revisión de las demás. Se agregó un modo
   `?debug=1` (o header `x-digest-debug: 1`) a la función: sin tocar el
   comportamiento normal del cron, devuelve el conteo crudo por alerta/
   empresa y cualquier error atrapado en cada paso (contar, buscar
   miembros, resolver el correo del usuario, enviar el correo) -- así se
   pudo ver el error real de Resend sin adivinar. Se deja permanente (no es
   throwaway): sirve para depurar sin esperar al cron diario ni tener
   acceso a logs.

**Verificado de punta a punta con datos y cuenta reales**: alerta real
("Obras civiles Norte de Santander", forzando `ultimaRevision` a 2020 vía
`supabase db query --linked` para simular "hace tiempo que no se revisa")
contó 100+ procesos nuevos reales contra SECOP en vivo; encontró al usuario
dueño de la empresa vía el Admin API de Auth; y el correo llegó de verdad a
la bandeja de entrada. Cron confirmado activo (`select * from cron.job`).
Después de la prueba, la alerta de prueba se borró (`update app_state set
value = '[]' where key = 'alertas_guardadas'`) para no dejar el conteo
"pisado" en 2020 esperando al cron real de mañana.

**Cómo se manejaron los secretos durante el despliegue**: ninguno de los
dos secretos reales (`RESEND_API_KEY`, `CRON_SECRET`) se pidió ni se aceptó
en el chat -- el usuario los generó y configuró él mismo, en su propia
terminal, con `supabase secrets set`. Para verificar sin verlos, se usó
`supabase secrets list` (que solo devuelve un hash + fecha de actualización,
nunca el valor) y, para confirmar CUÁL valor estaba activo sin pedirlo de
nuevo, se compararon hashes SHA-256 calculados localmente contra candidatos
que YA habían quedado expuestos por accidente (ver el punto siguiente) --
nunca contra un valor pedido a propósito.

**Incidente real durante el despliegue, y cómo se corrigió**: al escribir
`CRON_SECRET=<valor>` literalmente CON los símbolos `<` `>` (confundiendo la
notación de placeholder de la instrucción con sintaxis real), el comando
falló en PowerShell -- y el intento (con el valor real adentro) quedó
visible en el historial de la terminal, que se leyó para diagnosticar el
error. Esto expuso el valor sin querer. Se trató como comprometido de
inmediato: se pidió rotar el secret (generar uno nuevo y volver a
`supabase secrets set`) antes de seguir, en vez de reutilizar el valor
visto. Lección para instrucciones futuras: nunca usar `<algo>` como
notación de placeholder en un comando que el usuario vaya a copiar/pegar
literal -- preferir una palabra sin símbolos especiales (`TU_VALOR_AQUI`) o
aclarar explícitamente "sin los símbolos < >".

**Cero regresión mientras no se active**: el checkbox nuevo empieza sin
marcar y el flujo `window.storage.get/set` de siempre sigue funcionando
igual si no se despliega la Edge Function -- simplemente nadie recibiría el
correo (la casilla no falla ni bloquea nada, solo no tiene efecto sin el
backend desplegado). Ningún otro flujo de la app cambia.

**Qué NO hace este resumen, a propósito**: no reemplaza "Ver nuevos"/"Ver
actividad" dentro de la app (que sí marca `ultimaRevision` y resetea el
contador) -- el correo es de solo lectura, nunca escribe en `app_state`. Si
el usuario no entra a la app, el mismo resumen se repite al día siguiente
mientras siga habiendo novedades sin revisar -- comportamiento intencional
(avisar hasta que se atienda), no un bug de "no se marca como visto".

## Fase 10 (segunda mitad): hojas de vida del personal

Cierra la Fase 10 (generación de documentos CCE) con la segunda opción de
las 4 presentadas al usuario al empezar esa fase: hoja de vida por cada
perfil profesional ya registrado en "Personal".

**Por qué es más simple que la carta de presentación**: no necesita ningún
campo nuevo (`PERFIL_PROFESIONAL_VACIO` ya tiene nombre/cargo/años/
formación/especializaciones/experiencia/competencias, cargados desde que
existe "Personal") ni depende de un proceso puntual -- por eso el botón
"⬇ Hoja de vida (.txt)" vive en la lista "Equipo registrado"
(`renderPersonalList`), uno por fila, en vez de en "Evaluación" como la
carta (que sí necesita datos del proceso elegido). `generarHojaDeVidaTexto`
recibe directo el objeto `perfilesProfesionales[id]`, sin pasar por
`evaluarProceso`/`perfilId` como la carta.

**También es plantilla, no formato oficial** -- mismo criterio que la carta
de presentación (Fase 10) y la sugerencia de oferta (Fase 8): el texto
generado lo dice explícito, y además aclara por qué NO es el Formato Único
de Hoja de Vida de Función Pública (ese es para servidores públicos; el
personal aquí es del equipo de un proponente privado, no aplica -- aclararlo
evita que alguien intente presentar esta plantilla donde en realidad se pide
ese formato específico).

**Verificado con datos reales**: perfil "Carlos Andrés Rodríguez Vega"
(director de obra, 12 años, formación/especializaciones/experiencia/
competencias completas) generó el texto con cada campo en su lugar; un
perfil recién creado sin datos generó la misma plantilla con "(no
registrado/a)" en cada sección, sin "undefined" ni errores. Tests de humo
5/5. Probado en los 3 breakpoints sin overflow ni errores de consola.

## Auditoría de primer uso (perspectiva de un ingeniero civil nuevo en la app)

El usuario pidió auditar la aplicación "desde la perspectiva de un ingeniero
civil que va a usar la aplicación por primera vez". Se hizo un recorrido real
en navegador (no lectura de código) por las 7 vistas, incluida una carga real
de un Excel de experiencia y una matriz de requisitos generados para la
prueba, corriendo el análisis completo hasta ver CUMPLE/NO DETERMINABLE en
pantalla, más una pasada en tamaño de celular (375px). El reporte completo
(0 críticos, 4 importantes, 3 menores, 5 aciertos) se entregó como artefacto;
el usuario pidió implementar los tres cambios de mayor impacto.

### 1. El texto de ayuda ya no es el mismo bloque repetido en cada pantalla

Hallazgo: `.footnote` (el bloque de 8 párrafos que empieza con "Fuente:
conjunto de datos abiertos...") es un ÚNICO elemento del DOM, fuera de las
`<section class="view">` -- por eso aparecía idéntico, palabra por palabra,
al pie de CUALQUIER vista (Experiencia, Evaluación, Personal...), mezclando
temas de "Buscar procesos", el semáforo GO/NO-GO o SECOP I vs II aunque el
usuario no estuviera en esa pantalla. Un texto largo e irrelevante enseña al
usuario a dejar de leer la ayuda -- justo cuando sí aparezca algo importante
para esa pantalla, ya la habrá aprendido a saltar.

Fix: cada `<p>` del bloque ahora lleva `data-help-view="buscar"` (o
`"dashboard"`, `"perfil"`, `"evaluacion"`, `"buscar competencia"`, etc. --
espacio-separado cuando aplica a más de una vista). Dos párrafos que mezclaban
dos temas se partieron en dos (`El historial... persisten` quedó en
`dashboard`; `En "Perfil de la empresa"... RUP` quedó en `perfil`. Igual con
el párrafo del semáforo: la parte de la tarjeta quedó en `buscar`, la parte
de "En 'Evaluación' ves el veredicto..." quedó en `evaluacion`).
`mostrarVista(nombre)` (la misma función que ya alternaba qué `<section>`
mostrar) ahora también filtra `#bt-footnote [data-help-view]`: oculta los
`<p>` que no aplican a la vista activa, y oculta el `<div class="footnote">`
completo si ninguno aplica -- por eso "Experiencia" y "Personal" (que ya
traen su propia guía en pantalla) quedan sin footnote, en vez de mostrar un
bloque irrelevante. Nada del contenido se perdió, solo se repartió.

### 2. El panel "Revisar interpretación" avisa solo cuando falta algo que importa

Hallazgo: ese panel (tabla CAMPO / COLUMNA DEL EXCEL USADA) es la única forma
de detectar una mala auto-detección de columnas, pero empezaba siempre
colapsado sin distinguir cuáles de los 11 campos posibles son importantes.
Con un Excel real de prueba, 6 de 11 campos salían "no detectada" sin que el
usuario supiera si eso arruinaba el análisis o no (normalmente no, son
opcionales) -- genera desconfianza justo antes del paso que decide si la
empresa cumple o no.

Fix: `renderColumnasDetectadas` recibe ahora un cuarto parámetro
`camposEsenciales` (`CAMPOS_ESENCIALES_CONTRATO = ['objeto']`,
`CAMPOS_ESENCIALES_REQUISITO = ['criterio']` -- el único campo sin el cual el
motor de coincidencia de palabras no tiene nada que comparar). Si alguno de
esos NO se detectó: el `<details>` se abre solo (`open`), el resumen agrega
"-- revisa esto primero", aparece un aviso reutilizando `.demo-banner` (el
mismo estilo ámbar ya usado en otros avisos de la app) nombrando el campo
exacto que falta, y esa fila de la tabla se resalta con fondo ámbar y una
etiqueta "ESENCIAL". Si el campo esencial SÍ se detectó (el caso normal), el
badge "esencial" igual se muestra en su fila pero sin abrir el panel ni
mostrar el aviso -- confirmado con un Excel real donde "Objeto" sí se
detectaba (sin aviso, panel cerrado) y con un segundo Excel con el
encabezado deliberadamente irreconocible ("Detalle ABC123" -- no contiene
"objeto", "descripcion" ni "alcance", los sinónimos que reconoce
`DICC_CONTRATO`) donde el aviso, la apertura automática y el resaltado sí
aparecieron.

### 3. Ejemplo de formato junto a cada zona de carga

Hallazgo: las dos zonas de carga de "Experiencia" solo decían "Excel, PDF o
Word" sin mostrar qué columnas espera el sistema. El motor reconoce muchos
sinónimos de encabezado (`DICC_CONTRATO`/`DICC_REQUISITO`), pero eso es
invisible hasta después de cargar el archivo -- el usuario con su propio
Excel no tenía forma de saber de antemano si iba a funcionar.

Fix: un `<details>` "Ver ejemplo de formato aceptado" debajo de cada
dropzone (mismo estilo `.expeval-review` que el panel de interpretación, así
que no se agregó CSS nuevo para esto), con una tabla de una fila mostrando
encabezados típicos + un ejemplo realista de obra pública, y una nota
aclarando que otros nombres de columna parecidos también sirven y que en
PDF/Word sin tabla el sistema extrae menos campos con confianza.

### Verificación

`node tests/smoke.mjs`: 33/33 (ninguno de los tres cambios toca las
funciones de negocio extraídas por el arnés de tests, solo HTML/CSS/JS de
interfaz). Probado en navegador real: recorrido por Buscar procesos,
Evaluación y Personal confirmando que cada uno muestra solo los párrafos de
ayuda que le corresponden (o ninguno); carga de un Excel real de experiencia
con "Objeto" detectado (panel cerrado, sin aviso) y con "Objeto" no detectado
a propósito (panel abierto, aviso ámbar, fila resaltada); confirmado que el
enlace "Ver ejemplo de formato aceptado" aparece bajo ambas zonas de carga.

## Auditoría de primer uso, segunda pasada: los hallazgos importantes/menores restantes

Después de los 3 cambios rápidos, el usuario pidió revisar el resto del
reporte (1 importante y 2 menores que quedaban, más el de nomenclatura).

### "Capacidad K / financiera": el placeholder enseñaba un formato que rompía su propio buscador

La recomendación original del audit era "campos numéricos estructurados",
pero investigar el código reveló algo más preciso y más urgente: el campo SÍ
se usa programáticamente (`compararConPerfil`, línea ~4073) -- se parte por
`,`/`;`/salto de línea (`splitTerms`) en términos, y cada término se busca
como substring dentro del texto del pliego analizado. El placeholder decía
`"K = 3.500.000.000 · Patrimonio = 450.000.000 · Liquidez = 1,3"` usando
"·" como separador -- pero "·" NO es uno de los delimitadores de
`splitTerms`. Un usuario que copiara ese formato al pie de la letra
terminaba con UN solo término gigante (el texto completo) que nunca iba a
aparecer literal en un pliego real -- la comparación quedaba rota en
silencio para cualquiera que llenara el campo a mano (el autocompletado
desde el RUP no tiene este problema: `parsearRUP` ya arma el texto con
`ind.join('\n')`, un indicador por línea).

Fix: el placeholder ahora usa saltos de línea reales (`&#10;` en el
atributo) -- mismo formato que ya produce el autocompletado del RUP -- y la
etiqueta dice "un dato por línea" en vez de sugerir la sintaxis "K = ... ·
...". No se tocó el modelo de datos (`k` sigue siendo un string libre) ni
`compararConPerfil` -- el bug estaba en el ejemplo mostrado al usuario, no
en la lógica.

### Nomenclatura: "Perfil en edición" ahora dice a qué perfil se refiere

El mismo `<label>Perfil en edición</label>` se repetía igual en "Perfil de
la empresa" (selector de empresas) y en "Personal" (selector de
profesionales) -- ahora dicen "Empresa en edición" y "Profesional en
edición" respectivamente. Cambio de una sola palabra por pantalla, sin
tocar los `id` ni la lógica de los `<select>`.

### "Ver datos de ejemplo" ahora también se ofrece directo en el estado vacío

Antes solo existía el botón junto a los filtros, arriba del todo -- si la
primera búsqueda de alguien nuevo daba "SIN RESULTADOS" (real: con los
filtros de fábrica, en el momento de la prueba no había licitaciones
abiertas en Norte de Santander en esos rubros), tocaba volver a subir para
encontrarlo. Ahora el mensaje de "SIN RESULTADOS" incluye un enlace propio
("Ver datos de ejemplo") que llama al mismo `loadDemo()` -- delegado en el
listener de click de `resultsEl` ya existente (`e.target.closest('#bt-empty-demo')`),
mismo patrón que ya usaban los botones "Ir a Experiencia/Personal" del
mismo contenedor. También se aclaró el texto: "Puede que ahora mismo no
haya ninguna licitación abierta con esos criterios -- no es un error."

### Navegación móvil: se intentó y se revirtió (documentado para no repetir el intento)

Se probó mostrar el nombre de la sección junto al ícono, pero SOLO para el
ítem activo (para no repetir el problema de los 7 labels completos que ya
se había evitado a propósito). Medido con el mismo método que los bugs de
overflow ya documentados en este archivo (`sidebar.scrollWidth -
sidebar.clientWidth` a 375px real): con "Competencia" como activo, 56px de
desborde; con "Perfil de la empresa" (el label más largo), 93px. Se
revirtió por completo -- el nav vuelve a ser exactamente como estaba
(solo íconos, `title`/`aria-label` como nombre accesible). El nombre de la
sección activa de todas formas ya es visible de inmediato: cada vista
muestra su propio `<h1>` justo debajo del nav apenas se toca el ícono. Lo
que de verdad falta -- ayudar a elegir el ícono correcto ANTES de tocarlo,
sin conocer aún la app -- necesitaría reemplazar la fila de íconos por un
menú desplegable con nombres completos en celular, un cambio de diseño más
grande que no se improvisó en esta pasada para no arriesgar el ajuste ya
afinado del nav actual.

### Verificación

`node tests/smoke.mjs`: 33/33. Probado en navegador real: "Empresa en
edición"/"Profesional en edición" confirmados en sus pantallas; placeholder
de Capacidad K confirmado con saltos de línea reales
(`textarea.placeholder`); el enlace nuevo en el estado vacío sí dispara
`loadDemo()` (aparece el banner "Estás viendo datos de ejemplo"); el
intento de navegación móvil se probó, se midió el desborde real y se
revirtió antes de dejar nada roto -- `sidebar.scrollWidth -
sidebar.clientWidth` volvió a día 0 tras revertir.

## Navegación móvil: menú desplegable (el hallazgo que había quedado revertido)

El intento anterior (ver sección anterior) de mostrar el nombre de la
sección activa junto al ícono se había revertido por desbordar 56-93px a
375px real. El usuario pidió resolverlo de raíz con un menú desplegable.

**Diseño**: en vez de una fila de 7 íconos, a ≤560px aparece UN botón
("nav-toggle": ícono de hamburguesa + nombre de la vista activa + flecha)
que abre `#bt-nav` (el mismo `<div role="tablist">` de siempre, con los
mismos 7 `<button class="nav-item">`) como panel desplegable en vez de fila
horizontal. Como el panel abierto no comparte fila con nada más, los 7
nombres completos caben sin desbordar nunca -- el problema de fondo (ancho
insuficiente para texto + 7 íconos en una sola fila) se evita en vez de
intentar exprimirlo más.

**Reutiliza, no duplica**: son los MISMOS 7 botones que ya tenía el nav
(mismo `id`, mismo listener de clic que llama `mostrarVista()`, mismo
patrón ARIA `tablist`/`tab`/`aria-selected`, misma navegación por teclado
con flechas/Home/End) -- el CSS `@media (max-width: 560px)` solo cambia
cómo se ven (`.sidebar-nav` pasa de fila de solo-íconos a panel vertical
con `.nav-label` visible), no se crea un menú paralelo.

**Bug real encontrado implementando esto**: el panel se abría (confirmado
por JS: `display:flex`, tamaño y posición correctos, `nav-open` en la
clase) pero no se veía en pantalla -- invisible pese a estar "en el DOM".
Causa: la regla base de `.sidebar` (escritorio) trae `overflow-y: auto`
para el scroll vertical de la sidebar completa; a ≤560px nada la pisaba, y
un `overflow` distinto de `visible` en CUALQUIER eje recorta también el
otro eje (regla de CSS poco conocida) -- así que el panel
`position:absolute` (más alto que la barra que lo contiene, que a su vez
mide `height:auto` en celular) quedaba recortado a la altura de la barra
misma. Fix: `overflow: visible` en `.sidebar` dentro del media query de
celular, pisando la regla base.

**Mecánica**: `mostrarVista()` (la misma función de siempre) ahora también
sincroniza el texto del botón desplegable con la vista activa, y cierra el
panel (`sidebar.classList.remove('nav-open')`) en cada cambio de vista sin
importar el camino (clic, teclado, "Ir a Experiencia", tarjetas rápidas del
dashboard...) -- un solo lugar en vez de repetir el cierre en cada listener
distinto. Aparte: clic en el botón alterna abrir/cerrar, clic fuera del
panel lo cierra, Escape lo cierra y devuelve el foco al botón.

**Verificado**: 33/33 tests de humo (nada de esto toca lógica de negocio).
Probado en navegador real a 375px: `sidebar.scrollWidth - clientWidth = 0`
tanto cerrado como con el panel abierto; el panel muestra los 7 nombres
completos con el activo resaltado; clic en un ítem navega, cierra el panel
y actualiza el texto del botón; clic fuera y Escape cierran el panel.
Probado también en tablet (768px) y escritorio: sin cambios visuales, el
botón desplegable no existe ahí (`display:none` fuera del media query).

**Confirmado en iPhone real por el usuario**: las pruebas de arriba fueron
con Chromium emulando el tamaño de pantalla (nunca WebKit/Safari real, esta
herramienta no puede correrlo -- se dejó explícito al usuario en su
momento, incluidos los riesgos puntuales sin verificar: `position: sticky`
+ `overflow: visible`, y `100vh` con la barra de direcciones de iOS). El
usuario probó el menú desplegable con el dedo en su propio iPhone contra el
sitio en producción y confirmó que funciona bien -- cierra el único punto
de la auditoría de primer uso que había quedado sin verificación directa
en dispositivo real.

## Validación de fechas del requisito ("últimos N años")

El usuario pidió explícitamente atacar este punto, ya identificado como
pendiente en la auditoría crítica del motor (elegant-wandering-dewdrop.md,
"Fuera de alcance de esta pasada"): un pliego típico exige "experiencia
adquirida dentro de los últimos N años" y el motor tenía `fechaInicio`/
`fechaFin` del contrato pero nunca los comparaba contra nada del requisito.

**Extracción** (`condicionTemporalDelRequisito`, junto a
`condicionCuantitativaSinModelar`): reconoce la convención de redacción
legal colombiana -- casi siempre el número va en letras Y en dígito entre
paréntesis ("últimos diez (10) años") -- con dígito suelto como respaldo
("últimos 10 años") y letras solas como último recurso ("últimos quince
años", vía un diccionario `NUMEROS_ESPANOL` de 1 a 20). Un prefijo conector
opcional ("dentro de los", "durante los", "en los", "de los") se incluye en
el fragmento capturado a propósito -- ver el bug real más abajo.

**Comparación** (`evaluarCondicionTemporal`, junto a `evaluarRequisito`):
la fecha de referencia del contrato es `fechaFin` (cuándo se completó el
trabajo -- coincide con la convención más común en pliegos: "...contados a
partir de la fecha de terminación") con `fechaInicio` como respaldo si no
hay fechaFin. Tres desenlaces, igual que `condicionNoVerificable` pero con
uno más:
- Si ALGÚN contrato relevante (coincidencia total) cae dentro de la
  ventana → no bloquea nada, CUMPLE sigue en pie.
- Si TODOS los que sí traen fecha quedan fuera de la ventana (y ninguno
  sin fecha) → **NO CUMPLE**, no solo "falta verificar" -- es evidencia
  real de incumplimiento, mismo principio que `numericoOk === false` (un
  incumplimiento demostrado no se esconde detrás de una revisión manual).
- Cualquier otro caso (fechas faltantes que podrían cambiar el resultado)
  → NO DETERMINABLE, nunca se inventa que cae dentro de la ventana.

**Limitación conocida, documentada a propósito**: "hoy" (fecha real del
navegador) es la única ancla disponible -- a diferencia del análisis de
pliegos PDF (que sí conoce la fecha de cierre de un proceso puntual), la
evaluación de "Experiencia" corre independiente de cualquier proceso
específico, así que no hay una "fecha de cierre" con la que anclar "los
últimos N años". `evaluarRequisito`/`evaluarExperienciaCompleta` reciben
`hoy` como parámetro opcional (default `new Date()`) precisamente para que
los tests no dependan del reloj real y no se vuelvan flaky con el tiempo.

**Bug real encontrado por los propios tests, dos veces seguidas** (mismo
patrón que el bug de `PALABRAS_META_REQUISITO` de la auditoría crítica --
los tests atraparon esto ANTES de cualquier push):
1. "ultimos"/"anos" sueltos quedaban como palabras distintivas del
   requisito -- agregados a `PALABRAS_META_REQUISITO` (mismo principio:
   describen CÓMO se redacta la exigencia, no el alcance técnico).
2. Insuficiente: con "dentro de los últimos diez (10) años", las palabras
   "dentro" (conector) y "diez" (número en letras) TAMBIÉN quedaban como
   distintivas -- una lista fija de palabras a excluir no alcanza porque
   los conectores varían según cómo redacte cada pliego. Fix real: en vez
   de una lista fija, se excluye TODO el fragmento que capturó
   `condicionTemporalDelRequisito` (por eso el prefijo conector se incluye
   en el match) -- `palabrasClaveDe(condicionTemporal.texto)` da el
   conjunto exacto de palabras a excluir de `palabrasDistintivas`, sin
   tocar `palabrasClave` (que sigue completo, como con las demás
   exclusiones). A diferencia de "50 metros" (que si puede describir
   alcance técnico real, por eso esa NO se excluye), la cláusula temporal
   es 100% boilerplate -- ninguna de sus palabras pertenece al alcance de
   la obra.

**Verificado**: 38/38 tests de humo (5 nuevos: extracción en sus 3 formas
+ que no contamine palabrasDistintivas + los 3 desenlaces de la
comparación). Probado en navegador real con dos Excel reales generados
para la prueba -- mismo requisito ("vías urbanas dentro de los últimos
diez (10) años"), mismo contrato ("Construcción de vías urbanas...") con
solo la fecha de terminación distinta: 15/03/2005 dio NO CUMPLE citando la
condición exacta en la justificación ("El requisito exige experiencia
'dentro de los últimos diez (10) años' (contados desde hoy), pero el
único contrato... tiene fecha de terminación fuera de esa ventana"; nótese
sin la duplicación "...dentro de "dentro de..."" que sí apareció en el
primer intento, corregida antes de este commit); 15/03/2023 dio CUMPLE.

## Requisitos alternativos (OR entre varios)

El usuario pidió explícitamente atacar la última limitación pendiente del
motor de evaluación que quedaba documentada desde la auditoría crítica:
"agrupamiento real de requisitos alternativos (OR entre varios) --
limitación ya documentada en el propio código desde antes, sigue sin
resolverse". Hasta ahora, `obligatoriedad: 'alternativo'` existía como
clasificación pero cada fila se evaluaba y mostraba de forma
independiente, sin ninguna noción de "estos N requisitos son opciones
entre las que basta con acreditar una" -- una matriz con "acredite UNO de
los siguientes: a)... b)..." quedaba invisible para el resultado global,
como si ninguna de las opciones importara.

**Por qué no se agrupó a ciegas por cercanía o texto**: el propio comentario
del código ya advertía "la matriz rara vez dice explícitamente qué
alternativos van agrupados" -- inventar una relación de agrupamiento que
en realidad no existe es exactamente el tipo de invención que la auditoría
crítica pidió evitar (mismo principio que ya rige `condicionNoVerificable`/
`condicionTemporal`: mejor NO DETERMINABLE que una condición inventada).
Se usan dos señales, en orden de confianza, nunca una tercera especulativa:

1. **Columna explícita "Grupo"** (`DICC_REQUISITO.grupo`: "grupo
   alternativo", "grupo de alternativas", "grupo", "opcion") -- si el
   pliego SÍ la trae, agrupa por el mismo valor normalizado. Es la señal
   más confiable posible porque la puso quien redactó la matriz, no una
   inferencia de este motor.
2. **Sin columna**: una racha de filas CONSECUTIVAS que el regex de
   `obligatoriedad` YA clasificaba como "alternativo" (texto con
   "alternativ", "cualquiera de", "uno de los siguientes", "o bien") --
   en la práctica, cuando un pliego redacta "acredite uno de los
   siguientes: a)... b)... c)...", esas opciones aparecen una tras otra en
   la matriz. Un "alternativo" SUELTO (racha de 1) NO forma grupo -- sigue
   exactamente el comportamiento de antes de este cambio (informativo,
   no afecta el global), así que ninguna matriz existente cambia de
   resultado por accidente.

**`agruparAlternativos(resultados)`** (junto a `evaluarExperienciaCompleta`):
separa por columna explícita primero, agrupa el resto por rachas
consecutivas de "alternativo", y calcula el resultado agregado de cada
grupo: CUMPLE si algún miembro CUMPLE, NO CUMPLE SOLO si TODOS los
miembros dieron NO CUMPLE (nunca se mezcla con NO DETERMINABLE para
inventar un NO CUMPLE que no está confirmado), NO DETERMINABLE en
cualquier otro caso -- mismo principio de siempre.

**Un grupo cuenta como un "obligatorio" para el resultado global**
(acreditar UNO de varios alternativos suele ser en sí mismo obligatorio):
`evaluarExperienciaCompleta` ahora combina `obligatorios` (como antes) con
el resultado de cada grupo detectado a la hora de decidir NO CUMPLE /
REQUIERE REVISIÓN / CUMPLE.

**Bug real evitado antes de escribir el primer test** (no llegó a
producción): una fila con columna "Grupo" explícita pero cuyo propio texto
NO dispara la palabra "alternativo" cae, por el `if/else` existente, en
`obligatoriedad = 'obligatorio'` (el valor por defecto) -- sin excluirla,
esa fila se habría contado DOS veces hacia el resultado global: una vez
sola (vía el filtro `obligatorios` de siempre) y otra vez dentro de su
grupo. Fix: `obligatorios` ahora excluye explícitamente cualquier fila con
`requisito.grupo` no vacío (`&& !r.requisito.grupo`) -- una fila agrupada
queda representada por su grupo, nunca por sí sola además.

**UI**: un bloque nuevo "Grupos de requisitos alternativos" (badge de
resultado + qué filas lo componen) aparece antes de la tabla de detalle
cuando hay al menos un grupo; cada fila agrupada de la tabla de detalle
lleva una etiqueta adicional "Grupo N" junto a su obligatoriedad. El
informe `.txt` descargable (`informeExperienciaTexto`) incluye la misma
sección de grupos y anota "grupo N" en el encabezado de cada requisito
agrupado.

**Verificado**: 43/43 tests de humo (5 nuevos: columna explícita con un
miembro CUMPLE arrastrando el global, columna explícita con todos NO
CUMPLE, el bug del doble conteo evitado explícitamente, racha automática
de consecutivos, y un alternativo suelto sin grupo que NO afecta el
global -- este último confirma que ninguna matriz existente, incluido el
propio Caso 8 del arnés de tests, cambia de comportamiento). Probado en
navegador real con un Excel real de 3 requisitos (2 en "Grupo 1" -- uno
CUMPLE, el otro sin contrato relacionado -- más uno individual obligatorio
sin grupo, sin contrato relacionado): el grupo mostró CUMPLE correctamente
en su propio bloque, cada fila agrupada quedó etiquetada "Grupo 1" en la
tabla, y el resultado global salió REQUIERE REVISIÓN (correcto: el grupo
sí cumple, pero el tercer requisito individual, sin grupo, quedó NO
DETERMINABLE y por sí solo ya fuerza esa revisión).

## Recuperar contraseña

Del roadmap de Fase 1, explícitamente aplazado en su momento ("Qué NO se
implementó a propósito, por ahora: recuperar contraseña..."). El usuario
pidió atacarlo directamente -- a diferencia del motor de evaluación de
experiencia, esto es Auth estándar de Supabase (patrón bien documentado
por el proveedor, no una decisión de negocio ambigua), así que se
implementó directo sin ronda de auditoría previa.

**Flujo de Supabase Auth (`resetPasswordForEmail` + `PASSWORD_RECOVERY` +
`updateUser`)**: el modal de cuenta gana un tercer modo, `'forgot'`
(además de `'login'`/`'signup'`), con un enlace "¿Olvidaste tu
contraseña?" visible solo en modo login. Al enviarlo, llama a
`client.auth.resetPasswordForEmail(email, { redirectTo })` -- el correo
que Supabase manda trae un enlace que, al abrirse, hace que supabase-js
(`detectSessionInUrl: true`, el default) detecte el token de recuperación
en la URL y dispare el evento `PASSWORD_RECOVERY` vía
`onAuthStateChange`. Se registra ese listener justo después de
`createClient()` en `getSupabaseClient()` (no en otro lado) para no
arriesgar perderse el evento si llegara antes de que el resto del
bootstrap termine. Cuando dispara, `openRecoveryPanel()` abre el modal
solo (sin que el usuario haga clic en nada) mostrando un panel nuevo
("Elige una nueva contraseña", ajeno a los campos de login/signup) que al
guardar llama a `client.auth.updateUser({ password })`.

**`redirectTo` dinámico, no hardcodeado**
(`window.location.origin + window.location.pathname`): funciona igual en
producción, en un fork con otro dominio, o en una prueba local. *Requiere
un paso manual en el proyecto de Supabase del usuario*: esa URL exacta (o
un patrón con comodín que la cubra) debe estar en Authentication -> URL
Configuration -> Redirect URLs, o Supabase la ignora y el enlace cae al
Site URL por defecto -- mismo tipo de paso de activación ya documentado
para Fase 1/Fase 6 (algo que un asistente de IA no puede hacer por
tratarse de la cuenta del usuario).

**`sbRecoveryActive`**: mientras esté en `true` (desde que llega el evento
hasta que se guarda la contraseña o se recarga la página), CUALQUIER forma
de abrir el modal (el enlace de la sidebar, "Cuenta"...) lleva al panel de
recuperación en vez del de login normal -- hay una sesión de recuperación
en curso y completarla es la acción correcta, no un login normal.

**Dos bugs reales corregidos de paso, encontrados al escribir este mismo
flujo** (no eran nuevos, ya existían en el signup):
1. El mensaje de confirmación de signup ("Cuenta creada. Revisa tu
   correo...") reutilizaba `showAccountError` (caja roja de error) para
   una buena noticia -- y además `setAccountModalMode('login')` se
   llamaba DESPUÉS de mostrar el mensaje, y esa función oculta
   `#bt-account-error` al final -- el mensaje nunca llegaba a verse en la
   práctica. Se agregó `.account-notice` (mismo cuadro, tono verde de
   `--success`) + `showAccountNotice()`, y se invirtió el orden (cambiar
   de modo PRIMERO, mostrar el mensaje DESPUÉS) en los dos flujos que lo
   necesitan (signup sin sesión, y ahora "forgot").

**Verificado**: 43/43 tests de humo (sin tests nuevos de lógica pura --
esto es UI/Auth dependiente del navegador real, no una función aislable
como el motor de experiencia; se agregaron `openRecoveryPanel`/
`handleSetNewPassword` a la lista de funciones clave del check 3). Probado
en navegador real contra el proyecto de Supabase real: clic en "¿Olvidaste
tu contraseña?" cambia correctamente de panel (título, botón, campo de
contraseña oculto); enviar el formulario con un correo de prueba
inexistente disparó la llamada real a `resetPasswordForEmail` sin error y
mostró el mensaje de confirmación en verde (no rojo), volviendo a modo
login con el campo de contraseña visible de nuevo; el panel "Elige una
nueva contraseña" se revisó visualmente (sin errores de layout); su
validación local (contraseñas que no coinciden) se probó real, sin tocar
la red; con contraseñas iguales sí llamó a `updateUser()` de verdad, que
devolvió el error esperado "Auth session missing!" (no hay una sesión de
recuperación real sin haber llegado por el enlace del correo) manejado
con gracia en la caja de error, sin romper la página.

**Lo único que NO se pudo probar en este entorno** (requiere abrir un
correo real, algo que un asistente de IA no puede hacer): el camino
completo end a end -- recibir el correo real, abrir el enlace, y
confirmar que `PASSWORD_RECOVERY` dispara y abre el panel solo. El
usuario debería probarlo una vez con su propia cuenta antes de darlo por
completamente verificado, y agregar la URL de redirect en el dashboard de
Supabase si todavía no lo ha hecho (ver arriba) -- sin ese paso, el enlace
del correo no completará la detección de sesión.

## Red flags del análisis de pliego: garantías por debajo del mínimo legal

El usuario preguntó si se podía integrar, sin el "chat experto" (una función
del estilo de un mockup ajeno que vio -- LLM con citas a página/artículo),
las otras dos piezas que sí encajan con la arquitectura 100% basada en
reglas de este proyecto: alertas ("red flags") citando el artículo legal
exacto, y un puntaje de "viabilidad" orientativo.

**Investigación previa a codificar cualquier cifra** (mismo principio ya
aplicado en Fase 13, "capacidad contractual estimada"): antes de escribir
una sola regla se verificó el texto real del Decreto 1082 de 2015 (2
fuentes independientes por cada cifra, ver el hilo de la conversación) --
y esa investigación cambió el planteamiento original. El decreto fija
PISOS (mínimos), no techos: no existe un límite legal fijo que una
garantía "alta" supere. Por eso NINGUNA regla dispara por un % demasiado
alto (eso sería el principio general de proporcionalidad de la Ley 1150,
un criterio de revisión humana, no una cifra verificable -- deliberadamente
fuera de esta primera versión). Las 3 reglas implementadas SÍ son cifras
objetivas: disparan solo cuando el pliego declara un valor explícito POR
DEBAJO del mínimo legal -- señal real de un pliego mal redactado (revisar
si el valor del contrato es el que parece) o de una irregularidad, nunca
un "no cumple" del proponente.

**`REGLAS_RED_FLAG`** (junto a `parseValorUnidad`, antes de
`extraerExigencias`): 3 reglas, cada una `{ regex, mínimo, unidad,
severidad, artículo }` --
- Garantía de cumplimiento < 10% del valor del contrato -- Decreto 1082 de
  2015, Art. 2.2.1.2.3.1.12 (severidad alta).
- Garantía de seriedad de la oferta < 10% del valor de la oferta -- Art.
  2.2.1.2.3.1.9 (media).
- Garantía de responsabilidad civil extracontractual < 200 SMMLV -- Art.
  2.2.1.2.3.2.9 (media).
Cada regex exige la etiqueta ("garantía de cumplimiento"...) Y un número
junto a ella en el mismo fragmento -- una mención suelta sin cifra cercana
no dispara nada, no se inventa un valor (mismo principio que
`extraerExigencias`/`cerca()`, ya existente).

**Página real, no inventada** (`paginaDeOffset`, `extractPdfText`/
`ocrPdfPages` extendidas): hasta ahora esas dos funciones solo devolvían el
texto concatenado de todo el PDF, sin rastro de qué página aportó cada
fragmento. Se agregó `paginaOffsets: [{ pagina, hasta }]` (el índice de
carácter donde termina cada página en el texto concatenado) -- barato de
guardar (unos pocos números, no el texto de cada página duplicado) y
suficiente para mapear el índice de un match a su página real
(`paginaDeOffset`). En el flujo de OCR por tandas ("Seguir leyendo más
páginas"), los offsets de la tanda nueva se desplazan por el largo ya
acumulado antes de concatenarlos -- mismo patrón que ya usaba `entry.ocrText`
para ir sumando texto entre tandas.

**Viabilidad orientativa** (`calcularViabilidad`): 100 menos una
penalización fija por severidad de cada alerta (alta -20, media -10, baja
-5), nunca por debajo de 0 -- mismo criterio simple y auditable que
`scoreRecord`/`classify` de "Buscar procesos", explícitamente etiquetado
como orientativo, no una certificación.

**UI**: bloque "Alertas del pliego" en `renderAnalysisHtml`, justo debajo
del encabezado del análisis (antes del resumen de compatibilidad) --
badge de severidad (`.tag.redflag-alta/-media/-baja`, mismos tokens
`--danger`/`--warning` ya existentes, ningún color nuevo), el mensaje, la
página citada y el artículo legal. Con 0 alertas se muestra igual el
bloque con el mensaje "No se detectaron..." en vez de ocultarse -- que la
ausencia de alertas sea visible, no silenciosa. `entry.redFlags`/
`entry.viabilidad` no existen en análisis guardados ANTES de esta
funcionalidad (localStorage de sesiones previas) -- el render los omite
por completo en ese caso (`Array.isArray(entry.redFlags)`) en vez de
mostrar "undefined/100". Misma sección agregada al informe `.txt`
descargable (`informeAnalisisTexto`).

**Verificado**: 49/49 tests de humo (6 nuevos: cada regla dispara por
debajo del mínimo con la página real del match, NINGUNA dispara igual o
por encima del mínimo -- incluido un caso al 30% a propósito, para dejar
constancia de que un % alto no debe inventar una alerta --, las 3 reglas
a la vez sin pisarse entre sí, una mención sin cifra cercana no dispara
nada, la aritmética de `calcularViabilidad` incluido el piso en 0, y
`paginaDeOffset` mapeando índices a páginas reales). Probado en navegador
real de punta a punta: un PDF sintético de 2 páginas (generado con
`fpdf2`, instalado temporalmente y desinstalado después, mismo patrón que
`openpyxl`/`python-docx` en rondas anteriores) con las 3 garantías por
debajo del mínimo en la página 2 -- inyectado en el flujo real "Analizar
pliego" (gate de Experiencia/Personal simulado escribiendo directamente en
`localStorage` antes de recargar, ya que solo hacía falta probar el
análisis del pliego, no el motor de experiencia otra vez). Resultado real:
las 3 alertas con la página 2 citada correctamente, viabilidad 60/100
(100-20-10-10), y los colores de severidad resueltos contra los tokens
reales del tema (`getComputedStyle` confirmó `--danger`/`--warning`, no un
`var()` huérfano).

## Extensión: reglas de proporcionalidad (garantía MUY por encima del mínimo)

El usuario pidió construir también la pieza que la sección anterior había
dejado fuera a propósito: la regla "blanda" de proporcionalidad, para un %
demasiado ALTO. **Corrige una afirmación de la sección anterior**: el test
"un 30% (por ENCIMA del mínimo) no debe inventarse una alerta" ya no
aplica tal cual -- con esta extensión, 30% (exactamente 3x el mínimo de
10%) SÍ dispara, pero una alerta de una naturaleza deliberadamente distinta
(ver abajo). El test se reescribió para reflejar esto (ver "Verificado").

**La distinción de certeza entre los dos tipos de alerta es el punto
central, no un detalle de implementación**: por debajo del mínimo es una
cifra legal objetiva (cita el artículo exacto del Decreto 1082, severidad
alta/media); muy por encima es un criterio nuestro, orientativo, NUNCA
presentado como infracción -- el decreto no fija ningún techo. Se cita el
principio general de selección objetiva/libre concurrencia (Ley 1150 de
2007, Art. 5), con severidad **baja** a propósito (la categoría más débil,
para que nunca se confunda visualmente con una alerta de mínimo legal) y
un mensaje que dice explícitamente "no es necesariamente una infracción".

**Umbral** (`umbralProporcion: 3` en cada regla de `REGLAS_RED_FLAG`): 3x
el mínimo legal (30% para las garantías del 10%, 600 SMMLV para la de
RC extracontractual) -- un múltiplo orientativo elegido por nosotros, NO
una cifra que exista en el decreto (a diferencia de `minimo`, que sí está
verificada contra el texto oficial). Si el usuario pide ajustar este
múltiplo más adelante, es un solo número por regla, no un rediseño.

**`detectarRedFlags` reestructurada** para evaluar ambos casos por regla
sin re-matchear el texto dos veces: extrae el valor una sola vez y decide
`valor < minimo` (alerta de mínimo legal, id `<regla>-baja`) vs.
`valor >= minimo * umbralProporcion` (alerta de proporcionalidad, id
`<regla>-alta`) -- mutuamente excluyentes por construcción, nunca las dos
a la vez para la misma regla. Un valor entre el mínimo y el umbral (ej.
15% de garantía de cumplimiento) no dispara nada -- es el rango normal,
no hay nada que señalar.

**Verificado**: 50/50 tests de humo (2 nuevos, 1 reescrito: el caso del
10% exacto y un 15% razonable NO disparan nada; el caso del 30% SÍ
dispara pero como alerta de proporcionalidad -- severidad baja, cita la
Ley 1150 no el Decreto 1082, y el mensaje nunca afirma una infracción
confirmada). Probado en navegador real de punta a punta con un segundo
PDF sintético (mismo patrón `fpdf2` temporal): garantía de cumplimiento al
35% y RC extracontractual a 700 SMMLV (ambas ≥3x su mínimo) + garantía de
seriedad al 8% (por debajo del mínimo, la alerta "dura" de la sección
anterior) -- las 3 alertas salieron juntas y correctas (2 "BAJA" citando
Ley 1150, 1 "MEDIA" citando el Decreto 1082), viabilidad 80/100
(100-5-10-5), confirmado con los `className`/página real de cada una.

## Auditoría de usabilidad, segunda pasada (app ya crecida a 7 secciones)

El usuario pidió "que la interfaz sea más fácil de entender" sin apuntar a
una pantalla concreta -- se repitió el mismo método de la primera auditoría
de "primer uso" (recorrido real en navegador, estado limpio, no lectura de
código) porque la app creció mucho desde esa pasada (Personal, Competencia,
red flags/viabilidad no existían todavía). 6 hallazgos, todos implementados
y verificados; 0 críticos.

### 1. El aviso "Siguiente paso" era estático -- contradecía al propio botón deshabilitado de la misma pantalla

En "Experiencia" y "Personal", `<div class="saved-note">Siguiente paso: ve
a...</div>` estaba escrito directo en el HTML, sin ningún `id` ni lógica
condicional -- se mostraba SIEMPRE, incluso con la página recién cargada y
sin ningún archivo/perfil todavía. En "Experiencia" esto quedaba justo
debajo de "Analizar información" (correctamente deshabilitado hasta cargar
ambos archivos) -- dos mensajes contradictorios visibles a la vez: uno dice
"todavía no", el otro "ya puedes irte".

Fix: se les dio `id` (`bt-expeval-siguiente-paso` / `bt-personal-siguiente-paso`)
y `hidden` por defecto. `renderExpEvalSteps()` (que ya calculaba `s3 = !!
expevalResultado` para el paso 4 del stepper) ahora también decide
`siguientePasoEl.hidden = !s3` -- se muestra solo cuando la evaluación
realmente se ejecutó. `renderPersonalList()` hace lo mismo con `!ids.length`
-- se muestra solo con al menos un profesional registrado. Ambas funciones
ya se llamaban desde el bootstrap (`appReady.then(...)`), así que el estado
restaurado desde `localStorage` también queda correcto sin tocar nada más.

### 2. El stepper de "Buscar procesos" decía "3 pasos" pero mostraba 5 círculos sin distinguirlos

"Preparación para analizar un pliego" / "Estos 3 pasos se hacen una sola
vez" encabezaba un stepper de 5 pasos (Experiencia/Análisis/Perfiles/Pliego/
Resultado) con el mismo peso visual para los 5 -- nada indicaba cuáles 3 son
"de una sola vez" (1-3) y cuáles 2 se repiten por cada pliego (4-5).

Fix: el separador entre el paso 3 y el 4 gana una variante `.step-sep-group`
(línea punteada más ancha en vez de la barra sólida de 22px de los demás)
para que se lea como "un tipo de salto distinto" sin agregar texto flotante
que pudiera romper el `flex-wrap` en celular. El subtítulo se reescribió
para ser exacto: "Los pasos 1 a 3 se hacen una sola vez; los pasos 4 y 5 se
repiten con cada pliego que analices (marcados con el separador punteado)".

### 3. El paso 3 del stepper se llamaba solo "Perfiles" -- ambiguo con "Perfil de la empresa"

"Perfiles" (paso 3) y la sección "Perfil de la empresa" (RUP/K, algo
completamente distinto) comparten la misma palabra -- el mensaje de
bloqueo de abajo sí aclaraba "perfil profesional en 'Personal'", pero la
etiqueta corta del círculo por sí sola podía mandar a alguien a la sección
equivocada. Fix: la etiqueta del paso 3 pasa a decir "Personal" a secas --
el mismo nombre exacto que ya usa el ítem de la sidebar, cero ambigüedad
nueva que inventar.

### 4. El Dashboard no tenía tarjeta de acceso rápido a "Personal" ni a "Competencia"

`.quick-grid` en "Inicio" solo tenía 4 tarjetas (Buscar procesos/Perfil de
la empresa/Experiencia/Evaluación) aunque la sidebar ya tiene 7 secciones
desde hace varias fases -- alguien que solo mira el Dashboard podía no
enterarse de que "Personal" (paso obligatorio para desbloquear "Analizar
pliego") o "Competencia" existen. Fix: 2 tarjetas nuevas, mismo componente
`.quick-card[data-view]` (el listener ya es genérico por `data-view`, cero
JS nuevo) y reutilizando los mismos íconos SVG que ya tienen esos ítems en
la sidebar -- ningún ícono nuevo que diseñar. `.quick-grid` ya era
`grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`, así que 6
tarjetas en vez de 4 reflowan solas sin tocar CSS.

### 5. "Competencia" tenía dos botones distintos, los dos literalmente "Buscar"

"Buscar empresa" (ficha completa) y "Buscar socios (consorcios)" son dos
formularios de búsqueda distintos en la misma vista, pero sus botones
(`#bt-comp-buscar` / `#bt-socios-buscar`) decían ambos solo "Buscar" --
solo el encabezado de cada bloque los distinguía. Fix: "Buscar empresa" /
"Buscar socios". Se verificó que ningún JS reescribe el `textContent` de
esos botones en ningún estado de carga (solo togglean `.disabled`, mismo
patrón que ya se había encontrado roto una vez con botones en mayúscula --
ver "Cosas aprendidas por las malas" -- así que se confirmó explícitamente
antes de dar el cambio por bueno).

### 6. "Capacidad K residual (texto libre)" no avisaba que solo funciona en pesos

El label decía "texto libre" sin más -- pero la sección de abajo
("Capacidad contractual estimada") solo puede calcular algo si ese campo
está en pesos (avisa "no se puede calcular si está en SMMLV o vacía", ver
Fase 13). "Texto libre" sonaba a "cualquier formato sirve igual". Fix:
label extendido a "Capacidad K residual (texto libre; en pesos si quieres
que se calcule tu capacidad disponible más abajo)" -- no se tocó el modelo
de datos (sigue siendo un string libre), solo se adelantó la advertencia
al momento de escribir, no después de guardar.

**Verificado**: 50/50 tests de humo (ninguno de estos 6 cambios toca lógica
de negocio, solo HTML/CSS/JS de interfaz -- no se esperaban tests nuevos, y
no los hubo). Probado en navegador real de punta a punta, estado limpio
(sin cuenta, `localStorage` vacío -- confirmado que el propio bootstrap
crea un perfil de empresa vacío por defecto, comportamiento real, no un
resto de pruebas anteriores): las 6 tarjetas del Dashboard confirmadas por
`quick-card-title`; el aviso de "Experiencia"/"Personal" confirmado oculto
en vacío y visible tras completar (se registró un profesional real de
punta a punta -- clic en "+ Nuevo profesional", que crea el `id` activo,
ANTES de escribir el nombre y guardar, ver `savePersonal()`: sin ese primer
clic no hay `personalActivoId` y guardar no hace nada en silencio, un
detalle real del flujo que hay que respetar al probarlo, no un bug); el
separador punteado y la etiqueta "Personal" confirmados visualmente en
captura de pantalla; los botones "Buscar empresa"/"Buscar socios" y el
label de K residual confirmados por texto real del DOM.

## Sección "Competencia" eliminada por completo (Fases 9, 11 y 12)

El usuario pidió eliminar la sección "Competencia" -- ficha de empresa
(Fase 11), buscar socios/consorcios (Fase 9) y seguimiento de empresas
(Fase 12), las tres vivían juntas en esa vista. Se quitó todo, sin dejar
nada a medias: el ítem de la sidebar, la tarjeta rápida del Dashboard, el
panel "Actividad de empresas seguidas" del Dashboard, la sección completa
(`view-competencia`), las funciones exclusivas de las tres sub-funciones,
la clave de `localStorage`/sincronización `empresas_seguidas`, el CSS de
las barras (`.comp-bar-*`), y las referencias en `tests/smoke.mjs`.

**La trampa real de este borrado, evitada a propósito**: `prepararBusquedaPorNombre()`
se había factorizado en su momento (Fase 11) precisamente para que
`buscarFichaEmpresa` (Competencia) y `buscarAdjudicaciones` ("Ver
adjudicaciones de esta entidad", dentro de **Evaluación**, no Competencia)
compartieran el mismo criterio de coincidencia de nombre. Borrar a ciegas
todo lo que mencionara "Competencia" o SECOP I+II por nombre habría podido
arrastrarse `prepararBusquedaPorNombre`/`buscarAdjudicaciones`/
`fetchSecopDataset`/`descuentoComparable`/`SECOP_I_DATASET` -- todas
código real de **Evaluación**, no de Competencia, solo ubicadas cerca en
el archivo. Antes de tocar una sola línea se hizo un mapeo completo función
por función (exclusiva vs. compartida) con un agente de exploración, y se
verificó con grep que `agruparContratos` (la única duda real) no tiene
ningún llamador fuera de la ficha de empresa. Al terminar,
`prepararBusquedaPorNombre` queda con un solo llamador (`buscarAdjudicaciones`)
y su comentario se actualizó para ya no mencionar la función eliminada.

**Qué se eliminó, en JS**: el bloque completo "SEGUIMIENTO DE EMPRESAS"
(`empresasSeguidas`, `seguirEmpresa`, `dejarDeSeguirEmpresa`,
`revisarEmpresaSeguida`, `revisarTodasLasEmpresasSeguidas`,
`verActividadEmpresa`, `renderEmpresasSeguidasList`, `renderDashSeguimiento`,
`badgeSeguimiento`); el bloque "INTELIGENCIA COMPETITIVA: FICHA DE EMPRESA"
(`buscarFichaEmpresa`, `agruparContratos`, `agregarFichaEmpresa`,
`renderFichaEmpresaHtml`); el bloque "BUSCAR SOCIOS (CONSORCIOS)"
(`esPerfilPropio`, `buscarSociosPorSector`, `agruparPorEmpresa`,
`renderSociosHtml`, `runBuscarSocios`, `verFichaDeSocio`); las 12
constantes `const compXxxEl = document.getElementById(...)`; el listener
de wiring completo (`compBuscarBtn`, `sociosBuscarBtn`, `seguimientoListEl`,
etc.); `renderDashSeguimiento()` dentro de `actualizarDashboard()`;
`renderEmpresasSeguidasList()`/`revisarTodasLasEmpresasSeguidas()` del
bootstrap `appReady.then(...)`; `loadEmpresasSeguidas()` del
`Promise.allSettled` inicial; `'competencia'` de `VISTAS` y de
`SYNCED_KEYS`; el `if (nombre === 'competencia') ...` dentro de
`mostrarVista()`.

**Qué se preservó explícitamente** (la lista de "no tocar" del mapeo
previo): `prepararBusquedaPorNombre`, `buscarAdjudicaciones`,
`SECOP_I_DATASET`, `fetchSecopDataset`/`fetchAllForDataset`,
`descuentoComparable`, y todos los utilitarios genéricos (`normalize`,
`matchesTerm`, `matchesGeo`, `findField`, etc.) -- todos siguen siendo
código vivo de "Ver adjudicaciones de esta entidad"/"Sugerencia de oferta
económica" en Evaluación. También se preservó el párrafo de ayuda sobre
SECOP I vs SECOP II (sigue siendo relevante para "Buscar procesos" por sí
solo) -- solo se le quitó `" competencia"` de su atributo
`data-help-view`, no se borró el párrafo.

**Comentarios corregidos, no solo código**: dos comentarios que
justificaban decisiones de diseño citando funciones ahora eliminadas como
referencia (`prepararBusquedaPorNombre`, `fetchSecopDataset`) se
reescribieron para no dejar una referencia colgante a código que ya no
existe. Los comentarios de CSS/HTML que mencionaban "7 secciones"/"7
nombres" (el conteo de ítems del nav antes de este borrado) se
actualizaron a 6, o se generalizaron para no depender de un número exacto
-- ninguno de estos era funcional (el nav móvil se basa en el DOM real,
no en un conteo hardcodeado), pero el proyecto ya se había topado antes
con comentarios de conteo desactualizados (ver Fase 11, "cada ítem de nav
nuevo hay que volver a medir").

**Verificado**: 50/50 tests de humo (se quitaron del REQUIRED las 15
funciones exclusivas de Competencia; se conservaron `prepararBusquedaPorNombre`,
`generarCartaTexto`, `generarHojaDeVidaTexto` -- compartidas o no
relacionadas, solo co-ubicadas en el mismo array). Probado en navegador
real de punta a punta: consola limpia (0 errores) al cargar la página; el
nav y las tarjetas rápidas del Dashboard muestran 5 secciones (sin
Competencia); `document.getElementById('bt-nav-competencia')` devuelve
`null`; y -- la prueba que de verdad importaba -- "Ver adjudicaciones de
esta entidad" en Evaluación se probó de punta a punta contra un proceso
real cargado desde los datos de ejemplo: trajo adjudicaciones reales de
SECOP I y SECOP II (incluida una con "vs base: n/c" real), confirmando
que `buscarAdjudicaciones`/`prepararBusquedaPorNombre` siguen funcionando
exactamente igual después del borrado.

**Celular, mismo patrón que la navegación móvil (ver esa sección)**: se
repitió aparte la prueba a 375px real de las pantallas tocadas en esta
ronda (dropdown de nav con 6 ítems, tarjetas rápidas del Dashboard,
stepper con el separador punteado, label largo de K residual) -- 0px de
desbordamiento en todas. Solo Chromium emulado, nunca Safari/WebKit real
(la herramienta no puede correrlo). El usuario probó el sitio en
producción con su propio iPhone y confirmó que funciona bien.

## Auditoría UX/UI, tercera pasada (primer uso, con flujos completados de punta a punta)

El usuario pidió otra auditoría de primer uso, esta vez sobre la app ya sin
"Competencia" y con los fixes de la segunda pasada. A diferencia de las dos
rondas anteriores (mayormente inspección de estados vacíos), esta incluyó
completar flujos reales (crear un perfil, subir un archivo del tipo
equivocado) para encontrar problemas que solo aparecen al interactuar, no
solo al mirar. 4 hallazgos, todos implementados.

### 1. El Dashboard no orientaba a alguien genuinamente nuevo

"Inicio" saludaba ("Buenas tardes") y mostraba un resumen de "tu actividad"
enteramente en cero, sin ningún "empieza por aquí" -- las tarjetas de
acceso rápido existen más abajo, pero no sugieren ningún orden. Fix: un
panel "Primeros pasos" nuevo (`#bt-dash-primeros-pasos`), una lista
numerada de 4 pasos (Perfil de la empresa → Experiencia → Personal →
Buscar procesos) que solo se muestra mientras la cuenta esté
`esCuentaVacia()` -- sin perfiles, sin experiencia evaluada, sin personal,
sin historial. En cuanto hay UN dato real guardado, el panel desaparece
solo y no vuelve a competir por espacio con el resto del Dashboard.
Reutiliza el mismo patrón de click delegado por `data-view` que ya usan
`.quick-card`/`.nav-item` (se agregó `.primeros-pasos-item[data-view]` al
mismo `querySelectorAll`), así que no hizo falta wiring nuevo.

### 2. Se creaba automáticamente un perfil fantasma "Mi empresa" -- y el Dashboard lo contaba como dato real

`loadPerfiles()` tenía un bloque de "migración desde el esquema de un solo
perfil" que corría con solo `Object.keys(perfiles).length === 0` -- sin
exigir que de verdad hubiera un `perfil_empresa` viejo que migrar. Una
cuenta genuinamente nueva (nunca tuvo el esquema viejo tampoco) terminaba
igual con un perfil vacío llamado "Mi empresa" ya persistido en
`localStorage` sin que el usuario hiciera nada -- y "Perfiles de empresa:
1" en el Dashboard, dando la falsa impresión de tener algo guardado. Fix:
el bloque de migración ahora exige `if (perfilViejo)` -- una cuenta nueva
de verdad arranca con `perfiles` vacío, igual que "Personal" (que nunca
tuvo este problema, confirmado por separado: su `perfiles_profesionales`
arranca en `null`). `renderPerfilSelect()` gana el mismo estado vacío
("Sin perfiles todavía -- usa '+ Nuevo perfil'") que ya tenía
`renderPersonalSelect()`, para no dejar un `<select>` en blanco sin
explicación. Los perfiles ya guardados por usuarios existentes (incluido
un "Mi empresa" real que alguien haya llenado con datos) no se tocan --
este fix solo cambia qué pasa en una cuenta nueva desde cero.

### 3. "Buscar procesos" mostraba el aviso de preparación ANTES que los filtros

El panel "Preparación para analizar un pliego" (stepper de 5 pasos + aviso
ámbar si falta Experiencia/Personal) vivía arriba de "Filtros de
búsqueda" -- lo primero que veía alguien nuevo al entrar por el acceso más
obvio desde el Dashboard era un bloque grande diciendo que faltaba
completar dos secciones enteras, aunque la búsqueda en sí NUNCA estuvo
bloqueada (solo "Analizar pliego" lo está). Fix: se movió el bloque
completo (`#bt-flujo-panel`, mismos ids, sin tocar el JS que lo alimenta)
a después de "Filtros de búsqueda" -- la tarea principal de la vista
(buscar) se ve primero; la preparación para analizar un pliego específico
sigue ahí, solo que ya no antes de todo lo demás.

### 4. Subir un archivo del tipo equivocado a "Experiencia" no lo decía

El `accept=".xlsx,.xls,.csv,.pdf,.docx"` del `<input type=file>` solo
filtra el diálogo nativo de "elegir archivo" -- un drag-and-drop real
(el método principal de estos dropzones) NO lo respeta en ningún
navegador. Confirmado en la práctica: arrastrar un `.txt` caía sin aviso
en `cargarExcelExperiencia` (cualquier extensión no reconocida como
`.docx`/`.pdf` iba ahí por defecto) y el lector de Excel lo "leía" como
una hoja vacía, mostrando "Se leyó el archivo pero no se reconocieron
filas de contratos" -- como si fuera un Excel mal formateado, no un
archivo del tipo equivocado. Fix: `esTipoDeArchivoAceptado(file)` nueva,
revisada ANTES de despachar a cualquier parser en
`cargarExperienciaArchivo`/`cargarMatrizArchivo` -- si la extensión no es
ninguna de las 5 reconocidas (y no es PDF por `file.type` tampoco), corta
ahí mismo con un mensaje explícito nombrando el archivo real y los tipos
que sí sirven, sin tocar la lógica de lectura en absoluto.

**Verificado**: 50/50 tests de humo (ninguno de los 4 cambios toca lógica
de negocio evaluable -- son UI/flujo, sin tests nuevos, igual que la
segunda pasada). Probado en navegador real de punta a punta con estado
limpio: "Primeros pasos" visible y sus 4 enlaces navegando correctamente;
al crear un perfil real con "+ Nuevo perfil" el panel desaparece solo y
el contador del Dashboard pasa a reflejar el dato real; el selector
"Empresa en edición" confirmado con el nuevo estado vacío;
`localStorage.getItem('bitacora_perfiles_empresa')` confirmado `null` en
una cuenta recién cargada (antes tenía el fantasma "Mi empresa"); el
orden real de los `<h2>` de "Buscar procesos" confirmado como "Filtros de
búsqueda → Preparación para analizar un pliego → Alertas guardadas"; y
subir un `.txt` real (inyectado vía `DataTransfer`, el mismo método que
simula un drag-and-drop real de principio a fin) mostró el mensaje nuevo
exacto, nombrando el archivo.

**Confirmado en iPhone real por el usuario**: mismo patrón que las rondas
anteriores -- solo se pudo probar en Chromium emulado en este entorno,
nunca Safari/WebKit real. El usuario probó el sitio en producción con su
propio iPhone y confirmó que funciona bien.

## Los requisitos de experiencia salen del Pliego/Estudio Previo, no de una matriz subida a mano

Cambio de arquitectura pedido por el usuario en un prompt extenso (20
secciones): hasta ahora "Experiencia" comparaba DOS Excel/PDF/Word subidos
a mano -- la experiencia de la empresa (Fuente A) contra una "matriz de
requisitos" (Fuente B) que alguien preparaba aparte, transcribiendo a mano
lo que el Pliego/Estudio Previo ya decía. El pedido explícito: eliminar la
matriz como fuente de los requisitos -- extraerlos automáticamente del
Pliego de Condiciones y/o Estudio Previo de CADA proceso, con trazabilidad
de documento+página por cada uno, detectar inconsistencias si Pliego y
Estudio Previo se contradicen, y nunca inventar un requisito. Plan completo
(auditoría del código existente + diseño, con `EnterPlanMode`/
`ExitPlanMode`) guardado como referencia del proceso en
`elegant-wandering-dewdrop.md` -- ese mismo archivo contenía antes la
auditoría de coincidencia total/parcial (ya implementada e independiente de
este cambio), reemplazada por este diseño nuevo.

**Dos decisiones de alcance las confirmó el usuario directamente antes de
tocar código**: el Estudio Previo acepta PDF y Word (no solo PDF), y el
código de la matriz manual se elimina POR COMPLETO -- mismo criterio ya
usado al eliminar "Competencia", sin caminos secundarios a medio construir.

### Qué se reutilizó sin tocar (verificado contra el código real antes de diseñar, no descrito de memoria)

- El motor de comparación (`evaluarRequisito`/`evaluarExperienciaCompleta`/
  `agruparAlternativos`, con coincidencia TOTAL de palabras distintivas,
  `condicionNoVerificable`, `condicionTemporal`) sigue **exactamente
  igual** -- recibe un array `requisitos` genérico, nunca le importó de
  dónde salieron. Solo cambió de dónde vienen esos requisitos.
- `construirRequisitoDesdeTexto` (tipo/obligatoriedad/minContratos/
  minValor/minCantidad/palabras distintivas/condiciones) tampoco cambió --
  sigue convirtiendo un trozo de texto en un requisito estructurado, ahora
  alimentada por trozos del Pliego/Estudio Previo en vez de una matriz.
- El patrón "regex sobre el texto completo + `paginaDeOffset` para citar la
  página real" (ya probado con `REGLAS_RED_FLAG`/`detectarRedFlags`) es
  literalmente el mismo mecanismo que localiza las secciones de experiencia.
- Fuente A (experiencia acreditada de la empresa) sigue siendo un dataset
  GLOBAL sin cambios (`expevalContratos`) -- se sube una vez, se reutiliza
  en cualquier proceso. Deliberadamente desacoplada de cualquier perfil de
  empresa (ver punto 12 más arriba), eso no cambió.

### Prerrequisito corregido: el texto del pliego no se guardaba en el camino rápido

Auditando el código antes de diseñar (regla del propio pedido: "no
dupliques, reutiliza") se encontró que `entry.text`/`entry.paginaOffsets`
(el texto extraído por `extractPdfText`) NUNCA se guardaban en `analisis[id]`
en el camino normal (sin OCR) -- solo se guardaba lo YA derivado
(`redFlags`/`exigencias`/`kResidual`). Solo el camino OCR guardaba
`entry.ocrText`. Sin corregir esto, la extracción de requisitos no tendría
texto que leer tras recargar la página en el camino más común. Se agregó
`entry.text`/`entry.paginaOffsets` al handler `.analysis-confirmar-btn`, y
`textoPliegoDe(entry)` (nueva, junto a `paginaDeOffset`) centraliza la
lectura ("`entry.viaOcr ? entry.ocrText : entry.text`") para que ningún
llamador nuevo tenga que saber cuál de los dos campos revisar.

### Localizar y extraer requisitos de texto libre

- **`ANCLAS_EXPERIENCIA`** (junto a `REGLAS_RED_FLAG`): las ~17 frases
  ancla del pedido del usuario ("experiencia general", "experiencia
  específica", "requisitos de experiencia", "número mínimo de contratos",
  "códigos UNSPSC"...). El regex corre sobre el texto ORIGINAL sin
  normalizar (hace falta preservar los índices reales para
  `paginaDeOffset`) -- **bug real encontrado por los propios tests antes de
  cualquier prueba en navegador**: comparar contra texto normalizado
  (`normHeader`, que quita tildes) fallaba en silencio contra un pliego
  real, que SIEMPRE trae "específica" con tilde -- cero anclas detectadas,
  cero requisitos, nunca CUMPLE. Corregido con `patronAncla()`: cada vocal
  de la frase ancla se vuelve tolerante a tilde (`a`→`[aá]`, etc.) en vez de
  normalizar el texto (que colapsa espacios y desplazaría los índices).
- **`localizarSeccionesExperiencia(text, paginaOffsets)`**: encuentra
  zonas del texto que mencionan experiencia, citando la página real de cada
  ancla. **Segundo bug real encontrado por los tests**: tratar CADA ancla
  como el inicio de una zona nueva fragmentaba el contenido cuando varias
  anclas caen cerca (ej. un encabezado "Requisitos de experiencia:"
  seguido, a pocas palabras, por "Experiencia específica..." del primer
  ítem) -- la segunda ancla recortaba a la primera justo antes de su
  contenido real, dejando un fragmento fantasma sin sustancia
  ("Requisitos de experiencia: 1.", sin el texto que sigue). Corregido
  agrupando anclas separadas por menos de `GAP_MAX_CLUSTER_EXPERIENCIA`
  (800 caracteres, valor inicial sin validar contra un Pliego real) en una
  sola zona -- anclas genuinamente lejanas (ej. mención en el índice, otra
  20 páginas después) sí siguen generando zonas separadas.
- **`MARCADOR_REQUISITO_LISTA`** (constante compartida, extraída de
  `segmentarTextoEnRequisitos`) + **`segmentarConOffsets(texto)`** (nueva,
  hermana de `segmentarTextoEnRequisitos`): misma heurística de marcador de
  lista (1./a)/viñeta), pero preservando el índice de cada trozo dentro del
  texto original -- necesario para resolver cada requisito a su página real.
  `segmentarTextoEnRequisitos` en sí queda sin llamador en producción
  (la matriz que la usaba se eliminó) pero se conserva -- es pequeña,
  sigue bien testeada, y comparte exactamente el mismo heurístico.
- **`extraerRequisitosDePliego(text, paginaOffsets, fuenteLabel)`**: por
  cada zona, segmenta y llama `construirRequisitoDesdeTexto` SIN
  modificarla -- solo le agrega `requisito.fuente`/`.pagina`/
  `.anclaDetectada` como propiedades extra sobre el objeto que ya devuelve
  (wrapper, no cambio de firma). Descarta trozos cuyo rango de offsets se
  solapa >50% con uno ya aceptado (salvaguarda defensiva; con zonas
  agrupadas por cluster los rangos no deberían solaparse nunca en la
  práctica, pero no cuesta nada dejarla). Cero anclas → `{requisitos: [],
  zonas: []}`, nunca inventa un requisito.

### Inconsistencias entre Pliego y Estudio Previo (punto 11 del pedido)

`detectarInconsistenciasPliegoEP(reqsPliego, reqsEP)`: empareja dos
requisitos de documentos distintos SOLO si tienen el mismo `tipo` (nunca si
alguno es "no-clasificado"), ≥2 palabras distintivas compartidas, y
Jaccard ≥0.6 sobre `palabrasDistintivas` -- deliberadamente conservador
(mismo principio que `agruparAlternativos`: mejor no emparejar que inventar
una relación que no existe). Marca conflicto SOLO cuando AMBOS lados traen
un número Y difieren (`minContratos`/`minValor` con misma unidad/
`minCantidad`) -- un lado sin el dato NUNCA es un conflicto, el silencio no
es evidencia de desacuerdo. El mensaje siempre dice "⚠ POSIBLE
INCONSISTENCIA -- requiere revisión del consultor" y nunca elige un lado
como el correcto.

### Estudio Previo: nuevo upload, por proceso (no global)

Vive dentro de `.analysis-slot`, junto al análisis del pliego ya hecho --
solo aparece una vez que ese proceso puntual ya se analizó.
`cargarEstudioPrevioArchivo`/`PDF`/`Docx` reutilizan `extractPdfText`/
`ocrPdfPages`/`mammoth.extractRawText` tal cual (mismo patrón "ofrecer OCR
si <100 caracteres" que ya usa "Analizar pliego"), gateados por
`esTipoDeArchivoAceptado` antes de despachar. Un `.docx` no trae páginas
reales -- `estudioPrevioPaginaOffsets = []`, y `paginaDeOffset([], idx)`
ya devuelve `null` sin inventar una página. Nuevos campos en `entry`:
`estudioPrevioFileName/Text/PaginaOffsets/ViaOcr/Ts`.

### Disparo: botón explícito, no automático junto a los red flags

`evaluarExperienciaDeProceso(id, slot)` -- extrae requisitos del Pliego (+
Estudio Previo si ya se cargó), detecta inconsistencias, corre
`evaluarExperienciaCompleta` (SIN CAMBIOS) contra la experiencia global de
la empresa, guarda en `entry`, re-renderiza. Se decidió un botón explícito
("🔎 Evaluar cumplimiento de experiencia") en vez de correrlo automático
junto a `redFlags`/`viabilidad` (que sí corren solos): el Estudio Previo
suele subirse aparte/después del pliego mismo, y la extracción de texto
libre es justo el tipo de cosa que este proyecto ya trata con un paso de
revisión explícito antes de confiar (precedente: el panel de la matriz PDF,
ya eliminada, empezaba abierto por defecto). Re-ejecutable en cualquier
momento ("↻ Volver a evaluar experiencia"), igual que "Analizar pliego" ya
lo es. Un resultado basado solo en el Pliego (sin Estudio Previo) es válido
-- el panel de resultado lo etiqueta explícito ("basado solo en el Pliego
de Condiciones") para no aparentar más completitud de la que hay.

### Storage: todo dentro de `analisis[id]`, cero claves nuevas de localStorage

Nuevos campos por entrada: `text`/`paginaOffsets` (prerrequisito),
`estudioPrevio*`, `requisitosExperiencia` (Pliego + EP combinados, cada uno
con `fuente`/`pagina`), `experienciaZonasPliego` (no usado hoy, reservado),
`inconsistenciasPliegoEP`, `experienciaResultado` (resultado de
`evaluarExperienciaCompleta`, por proceso). Todo viaja dentro de
`analisis_pliegos` vía el `saveAnalisis()` que ya existía -- cero claves
nuevas en `SYNCED_KEYS`. `expevalRequisitos`/`expevalResultado` (los
globales viejos de la matriz) se eliminaron del código; el dato viejo que
algún usuario ya tuviera en `localStorage` bajo `experiencia_evaluacion`
simplemente se ignora (no-op, `loadExpEval()` ya solo lee `contratos`/
`meta` de ese blob) -- no es una migración destructiva.

### Compuerta de flujo y semáforo go/no-go, ahora por proceso

`estadoFlujoPliego()` perdió `experienciaAnalizada` de su cálculo de
`listo` -- corrige una circularidad real que este cambio introducía: antes
"Analizar pliego" exigía que YA existiera una evaluación de experiencia,
pero esa evaluación ahora solo puede existir DESPUÉS de analizar el pliego
de ese proceso puntual. El único prerrequisito de Experiencia que queda es
tener la Fuente A cargada. El stepper de 5 pasos de "Buscar procesos"
(`#bt-flujo-steps`/`renderFlujoStepper`) bajó a 4 (se fusionó "Análisis" de
experiencia, que ya no es un paso global aparte, con "Experiencia").

`experienciaGateDetalle(entry)` ganó el parámetro `entry` -- lee
`entry.experienciaResultado` en vez del `expevalResultado` global. Sin
pliego analizado, o analizado pero sin evaluar experiencia todavía →
`estado: 'nd'` ("Analiza el pliego de este proceso..."), nunca `'fail'`.
Cambio de una línea en `evaluarProceso` (`experienciaGateDetalle()` →
`experienciaGateDetalle(entry)` -- `entry` ya estaba en el scope de esa
función, confirmado leyendo el código antes de asumirlo).
`analysisScoreAdjustment(entry)` (pesa el puntaje de "Buscar procesos" por
cuánta experiencia/RUP/K coincide) también pasó de leer el global a leer
`entry.experienciaResultado` -- mismo motivo.

### Qué se eliminó por completo (matriz manual, confirmado con el usuario)

Dropzone + panel de ejemplo de "Cargar matriz" en `view-experiencia`, sus
`id`/DOM refs, y toda la cadena `cargarExcelMatriz`/`cargarMatrizPDF`/
`cargarMatrizDocx`/`cargarMatrizArchivo` → `parsearMatrizExperiencia`/
`parsearMatrizExperienciaPDF` -- cero llamadores les quedaban. También
`ETIQUETAS_REQUISITO`/`CAMPOS_ESENCIALES_REQUISITO`/
`renderRequisitosDetectadosTexto` (solo servían al panel de revisión de la
matriz, ya eliminado). **Se conservan explícitamente** (documentado en el
plan aprobado, para no arrastrarlos "porque parecían co-ubicados"):
`construirRequisitoDesdeTexto`, `segmentarTextoEnRequisitos`,
`parsearRequisitosDeFilas`/`DICC_REQUISITO` -- reutilizables, pequeños, y
`parsearRequisitosDeFilas` en particular sigue testeada (evalúa una tabla
de Word contra el motor) aunque hoy no tenga llamador de producción.

**`tests/smoke.mjs` actualizado en la misma pasada, no después**: el helper
`evaluar()` y el "Caso 7" usaban `parsearMatrizExperiencia(workbook)` --
como esa función era solo `parsearRequisitosDeFilas(leerHojaComoFilas(
workbook))`, se compone igual en el test sin depender de la función
eliminada (mismo resultado, cero riesgo de que las ~20 pruebas del motor de
comparación perdieran cobertura). Los 2 tests que probaban
`parsearMatrizExperienciaPDF` específicamente se reescribieron componiendo
`segmentarTextoEnRequisitos` + `construirRequisitoDesdeTexto` a mano (el
mismo par que hacía el wrapper eliminado). Se agregaron 12 tests nuevos
para el motor de extracción (anclas, agrupamiento de zonas cercanas,
`extraerRequisitosDePliego`, las 4 variantes de `detectarInconsistenciasPliegoEP`,
regresión de `evaluarExperienciaCompleta` con requisitos "taggeados",
`textoPliegoDe`) -- 62/62 en verde.

**Verificado de punta a punta con documentos reales** (mismo patrón
`fpdf2`/`openpyxl` temporales ya usado en este proyecto, desinstalados
después): un Pliego PDF sintético de 2 páginas ("Requisitos de
experiencia: 1. ...puentes vehiculares, mínimo 3 contratos... 2.
...experiencia general en obras civiles...") + un Estudio Previo PDF de 2
páginas con el MISMO requisito de puentes pero "mínimo 2 contratos"
(inconsistencia deliberada) + un Excel de 3 contratos reales de puentes
vehiculares, inyectados en el flujo real vía `DataTransfer` (gate de
Personal completado registrando un profesional real primero). Resultado:
3 requisitos identificados (1 general, 2 específica), la inconsistencia
detectada citando p. 2 de AMBOS documentos sin resolverla, el requisito de
puentes en CUMPLE con evidencia real (3 contratos, fila por fila), el de
obras civiles en NO DETERMINABLE (sin contrato relacionado), global
REQUIERE REVISIÓN -- confirmado también que el dato persiste tras recargar
la página (`entry.text`/`requisitosExperiencia`/`experienciaResultado`
todos presentes en `localStorage`) y que un SEGUNDO proceso sin analizar
en la misma sesión queda sin ningún dato de experiencia (el gate es por
proceso, no global). Dashboard actualizado correctamente ("1 proceso con
experiencia evaluada -- 0 CUMPLE"). Sin overflow en 375px. 0 errores de
consola en todo el flujo.

**Confirmado en iPhone real por el usuario**: mismo patrón que las rondas
anteriores -- solo se pudo probar en Chromium emulado en este entorno,
nunca Safari/WebKit real. El usuario probó el sitio en producción con su
propio iPhone y confirmó que funciona bien.

## Extracción de requisitos: probada contra pliegos reales, no solo sintéticos

El usuario preguntó explícitamente si la comparación de experiencia seguía
funcionando y si era "por coincidencias o de forma más segura" -- y luego
pidió probar la extracción contra pliegos reales suyos (no los PDF
sintéticos con los que se había probado hasta ahora). Compartió 3
documentos reales: un Estudio Previo de Cáchira (escaneado, sin texto
extraíble -- activaría el flujo de OCR ya existente, no se probó más a
fondo), los Estudios Previos de Zapatoca (LP-005-2026, 42 páginas) y un
Pliego de Condiciones real de Norte de Santander (Documento Tipo de
Colombia Compra Eficiente, 73 páginas, LP-SV-03249-2026).

**Método**: se extrajo el texto página por página con `pypdf` (instalado
temporalmente, mismo patrón ya usado con `fpdf2`/`openpyxl` en rondas
anteriores) replicando el mismo formato `{text, paginaOffsets}` que
produce `extractPdfText`, y se corrió `localizarSeccionesExperiencia`/
`extraerRequisitosDePliego` reales (extraídas del propio `index.html`,
mismo mecanismo que ya usa `tests/smoke.mjs`) contra ese texto -- no una
simulación, el código real ejecutándose sobre documentos reales.

**Resultado del primer intento: mal, con evidencia concreta.** Contra el
Estudio Previo de Zapatoca se extrajeron 69 "requisitos"; contra el Pliego
de Norte de Santander, 45. La gran mayoría eran ruido -- índices
financieros ("RENTABILIDAD DEL PATRIMONIO"), obligaciones generales del
contratista ("Disponer del personal idóneo..."), reglas legales sobre
consorcios, encabezados de página repetidos ("Código: CCE-EICP-GI-01
Página: 26 de 73"). Causa raíz: la zona alrededor de cada ancla era
demasiado ancha (hasta 6.000 caracteres) y **cualquier** trozo con
marcador de lista propio (1./A./B...) dentro de esa zona se aceptaba como
requisito, sin revisar si el trozo mismo hablaba de experiencia.

**Segundo hallazgo, más de fondo**: los pliegos oficiales reales (sobre
todo el "Documento Tipo" de Colombia Compra Eficiente) presentan la cifra
EXACTA de experiencia exigida como una **tabla** ("Matriz 1 – Experiencia"),
no como prosa numerada -- confirmado buscando "SMMLV" en el texto real:
"Este porcentaje de experiencia se tomará sobre el 'valor mínimo a
certificar... de conformidad con el numeral 3.5.8'" (una referencia a otra
sección, no la cifra misma). `extractPdfText` concatena el texto de la
página sin conservar filas/columnas (misma limitación ya conocida y
resuelta aparte para "Experiencia del proponente" vía
`extraerFilasPorPosicion`, que no se usa aquí) -- así que esos valores
tabulares pueden quedar genuinamente fuera de alcance de un extractor de
texto plano, no es solo cuestión de afinar umbrales.

**Corrección implementada, en dos partes:**

1. **`pareceRequisitoDeExperienciaReal(req)`** (nueva, junto a
   `extraerRequisitosDePliego`): un trozo solo se acepta como requisito
   real si el trozo MISMO (no la zona que lo contiene) menciona
   "experien..." Y trae algo verificable (`minContratos`/`minValor`/
   `minCantidad`/`condicionNoVerificable`/`condicionTemporal` no nulo).
   Deliberadamente más conservador que antes: mejor no extraer un
   requisito ambiguo que inventar uno que en realidad es ruido
   procedimental. Bajó los falsos positivos de 69 y 45 a 0 y 1
   respectivamente en los documentos reales.
2. **`REGEX_MENCION_TABLA_EXPERIENCIA` / `posiblesTablasNoLeidas`**: cuando
   una zona menciona una tabla/matriz de experiencia (ej. "Matriz 1 –
   Experiencia") pero no produjo ningún requisito aceptado, se marca
   explícitamente para revisión manual citando la página real -- en vez de
   forzar una extracción que saldría mal, o peor, quedarse callado. Se
   agregó también como ANCLA propia (`PATRON_MATRIZ_EXPERIENCIA`,
   compartida entre `REGEX_ANCLAS_EXPERIENCIA` y
   `REGEX_MENCION_TABLA_EXPERIENCIA`) -- sin esto, una mención de "Matriz N
   – Experiencia" sin otra ancla genérica cerca no generaba zona alguna, y
   el aviso nunca llegaba a dispararse. Se muestra en un panel nuevo
   ("POSIBLE TABLA DE EXPERIENCIA NO LEÍDA") dentro de "Experiencia
   requerida", combinando Pliego + Estudio Previo y deduplicando por
   fuente+página.

**Tercer bug real, encontrado por el propio requisito genuino que SÍ
sobrevivió el filtro**: el único requisito real extraído del Pliego de
Norte de Santander decía "...con mínimo uno (1) y máximo cinco (5)
contratos" -- el regex de `minContratos` en `construirRequisitoDesdeTexto`
exigía un dígito inmediatamente después de "mínimo" (`mínimo 3 contratos`),
y no reconocía la convención de redacción legal colombiana de número en
letra CON el dígito entre paréntesis (misma convención que
`condicionTemporalDelRequisito` ya maneja para "últimos diez (10) años",
pero el regex de `minContratos` nunca se había actualizado para esto).
Se agregó un tercer patrón de respaldo (`mínimo [palabra] (N)`, con un
lookahead que exige "contrato(s)" dentro de los siguientes 40 caracteres
para no confundirlo con otro "mínimo palabra (N)" ajeno, ej. "mínimo tres
(3) años de constituidas").

**Verificado**: 67/67 tests de humo (5 nuevos: `pareceRequisitoDeExperienciaReal`
rechazando ruido con marcador propio y rechazando una cláusula
procedimental que sí menciona "experiencia" pero sin ningún número,
aceptando un requisito genuino; una zona real con ruido MEZCLADO junto a
un requisito genuino, confirmando que el ruido se descarta y el genuino
sobrevive intacto; una mención de tabla sin ningún requisito extraíble
marcada para revisión manual con la página correcta). Vuelto a correr
contra los 2 pliegos reales tras el fix: Zapatoca sigue en 0 requisitos
(honesto -- ese Estudio Previo en particular defiere la cifra exacta al
Pliego, que no se tenía) sin ningún falso positivo; Norte de Santander
bajó de 45 a 1 requisito genuino (`minContratos: 1` correctamente
extraído tras el fix del regex) más 7 páginas reales marcadas como
"posible tabla no leída" (1, 3, 23, 25, 28, 29, 30) señalando exactamente
dónde está la matriz real. Probado además de punta a punta en el
navegador real con el propio PDF de 73 páginas de Norte de Santander
(leídas 40/73, el tope por defecto de `extractPdfText`) inyectado vía
`DataTransfer` -- 0 errores de consola, resultado REQUIERE REVISIÓN
honesto (2 requisitos, ambos NO DETERMINABLE por falta de contrato
relacionado en el Excel de prueba) con el panel de "posible tabla" listando
las 7 páginas reales para revisión manual.

**Limitación que queda documentada, no resuelta en esta pasada**: cuando
un requisito genuino sobrevive el filtro pero su propio trozo de texto no
alcanza a incluir la cifra real (porque quedó en el trozo siguiente, ya
sea por el marcador de lista o por la nueva ancla de "Matriz N –
Experiencia" cortando justo ahí), `minValor` puede tomar un número grande
pero incorrecto de más adelante en el mismo trozo ancho (confirmado en la
prueba real: un `40000 SMMLV` que no corresponde a ese requisito
puntual). No genera un CUMPLE falso (el requisito de todos modos terminó
NO DETERMINABLE por falta de contrato relacionado), pero el valor
mostrado en la justificación puede no ser confiable -- reconstruir la
tabla real (filas/columnas por coordenada, como ya hace
`extraerFilasPorPosicion` para "Experiencia del proponente") queda fuera
de alcance de esta pasada; el panel de "posible tabla no leída" es la
mitigación actual. Se le preguntó al usuario si quería que se
implementara esa reconstrucción ahora -- respondió que no, queda como
limitación conocida.

**Confirmado en iPhone real por el usuario**: mismo patrón que las rondas
anteriores -- solo se pudo probar en Chromium emulado en este entorno,
nunca Safari/WebKit real. El usuario probó el sitio en producción con su
propio iPhone y confirmó que funciona bien.

## Auditoría UX/UI: confianza de un ingeniero civil en el análisis

El usuario pidió auditar la app "desde un contexto UX/UI para un ingeniero
civil que va a usar la aplicación para buscar licitaciones... y que confía
en los análisis de la página para saber a cuáles presentarse y si cumple"
-- mismo método ya establecido (recorrido real en navegador, estado
limpio, completando flujos de punta a punta con datos inyectados vía
`DataTransfer`, no lectura de código), pero esta vez el foco explícito fue
la CONFIANZA en el resultado, no solo la navegación. 2 hallazgos críticos,
1 importante, 2 menores -- todos implementados.

### 1. (Crítico) Dos "veredictos" de capacidad financiera que se contradecían en la misma pantalla

`resumenPerfilHtml` (dentro del análisis de un pliego) mostraba "Capacidad
K / financiera: 0/3" y "· de esa, K residual: 0/1" -- una coincidencia de
texto LITERAL entre lo que el usuario escribió en su perfil
(`compararConPerfil`) y el texto crudo del pliego. Para cifras financieras
esa comparación es casi tautológicamente 0 (el pliego declara SU propio
mínimo exigido, nunca la cifra exacta que el proponente declaró en su
perfil) -- confirmado con un perfil real que SÍ cumplía el mínimo del
pliego: la tabla de gates decía "Capacidad K residual: Cumple ✓" y, unas
líneas más abajo, el mismo bloque decía "K residual: 0/1". Dos señales
contradictorias sobre lo mismo, en la misma tarjeta.

Fix: se quitaron las líneas de "Capacidad K / financiera"/"K residual" de
`resumenPerfilHtml` y del informe `.txt` descargable
(`informeAnalisisTexto`) -- el cálculo interno de `compararConPerfil`
sigue existiendo (`analysisScoreAdjustment` todavía lo usa para el ajuste
de prioridad de la tarjeta), solo se dejó de MOSTRAR como si fuera un
veredicto de cumplimiento, porque el "RESUMEN DE COMPATIBILIDAD"
(`evaluarProceso`, gates con umbrales reales extraídos del pliego) ya
resuelve esto correctamente. Se conservó "RUP / clasificador" -- ahí sí es
razonable que un código UNSPSC del perfil aparezca literal en el pliego.

### 2. (Crítico) "Evaluación" no reflejaba un pliego que YA se había analizado

Se analiza el pliego de un proceso en "Buscar procesos" (resultado
completo, correcto). Se va a "Evaluación", se elige el MISMO proceso, y
decía "Evaluación preliminar, sin pliego analizado" -- como si nada se
hubiera hecho. Causa raíz: `runEvaluacion()` prefería `s.evaluacion` (un
veredicto cacheado en el último `render()`/búsqueda de la lista) en vez de
recalcular con el `entry` actual -- ese caché queda obsoleto en cuanto se
analiza un pliego DESPUÉS de esa búsqueda, porque analizar solo redibuja
la tarjeta puntual, no vuelve a correr `render()` para toda la lista. Ya
estaba parcialmente documentado como limitación aceptada para cuando se
EDITA un perfil (ver "Nota sobre re-evaluar tras editar el perfil" más
arriba), pero no se había notado que también rompía la vista "Evaluación"
para un pliego recién analizado -- una inconsistencia mucho más visible y
directamente contraria a lo que el usuario pidió auditar.

Fix: `runEvaluacion()` y el botón "Descargar evaluación (.txt)" ahora
recalculan SIEMPRE con `evaluarMejor()` en vez de preferir el caché --
este panel evalúa un solo proceso a la vez por clic explícito del
usuario, así que recalcular es barato. El render de la LISTA completa
(`render()`, línea ~6020) sigue cacheando `s.evaluacion` a propósito, por
costo real de recorrer cientos de filas -- esa limitación documentada
sigue en pie y no se tocó.

### 3. (Importante) Texto desactualizado sobre una "matriz de requisitos" que ya no existe

Tres textos visibles (paso 2 de "Primeros pasos" en el Dashboard, la
tarjeta rápida "Experiencia" del Dashboard, y una nota en "Perfil de la
empresa") seguían describiendo el flujo eliminado ("sube la experiencia...
y evalúala contra una matriz de requisitos" / "Excel del proponente +
matriz de requisitos") -- residuo textual del cambio de arquitectura
documentado más arriba ("Los requisitos de experiencia salen del
Pliego/Estudio Previo..."). Reescritos para reflejar el flujo actual (la
comparación es automática contra el Pliego/Estudio Previo de cada
proceso, no contra una matriz preparada aparte).

### 4. (Menor) Números sin separador de miles en la fila "Capacidad K residual"

"Pliego: ≥ 1200000000 COP · tu perfil: 1500000000 COP" -- inconsistente
con el resto del mismo informe, que sí usa `fmtMoney` ("$1.850.000.000").
Nueva función `fmtCifra(n, unidad)` (junto al gate de K residual en
`evaluarProceso`): antepone "$" solo cuando la unidad es COP (una cifra en
SMMLV no debe llevar "$", sería engañoso), y siempre separa por miles con
`toLocaleString('es-CO')`.

### 5. (Menor) Dos "semáforos" en cada tarjeta sin distinguirse entre sí

Cada tarjeta de "Buscar procesos" muestra el sello GO/REVISAR/NO-GO
(cumplimiento) junto a la etiqueta ALTA/MEDIA/BAJA (prioridad por
coincidencia de palabra clave) -- dos escalas de "semáforo" distintas,
sin ninguna aclaración junto a ellas (la explicación solo vivía en el pie
de página general de la vista). Se agregó un `title` explícito a la
etiqueta de prioridad (antes solo lo tenía cuando el análisis del pliego
la ajustaba) aclarando que es un puntaje de búsqueda, no de cumplimiento,
y se afinó el `title` del sello de cumplimiento para empezar con
"Cumplimiento estimado:".

**Verificado**: 67/67 tests de humo (ninguno de estos 5 cambios toca
lógica de negocio evaluable por `extractExperienceEngine` -- son
UI/estado de la app, sin tests nuevos). Probado de punta a punta en
navegador real con datos inyectados en cada paso (perfil con K residual
que SÍ cumple el mínimo del pliego, Excel de experiencia, personal,
pliego PDF sintético con Capacidad K Residual exigida): confirmado que
"Capacidad K residual: Cumple ✓" ya NO tiene un "K residual: 0/1"
contradictorio debajo; confirmado que "Evaluación" para el mismo proceso
ya analizado en "Buscar procesos" ahora muestra el detalle completo
("✅ Capacidad K residual: Pliego: ≥ $1.200.000.000 · tu perfil:
$1.500.000.000 ✓") en vez de "sin pliego analizado"; confirmado el nuevo
formato con separador de miles; confirmados los dos `title` nuevos por
JS (`el.title`); confirmado que "matriz de requisitos" ya no aparece en
ningún texto del Dashboard ni de "Perfil de la empresa". Sin overflow en
375px, 0 errores de consola en todo el recorrido.
