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
  5. **Actual: "Registro Catastral"**, pedida como REDISEÑO COMPLETO (no
     solo color) vía el skill `frontend-design`. Escalón más allá de la
     lección del punto 4: el preview esta vez mostró 3 DIRECCIONES enteras
     (tipografía + color + forma + textura, cada una con su propio nombre y
     mundo de referencia -- Registro Catastral/ledger público, Plano de
     Obra/blueprint técnico, Gaceta/boletín oficial), no solo variaciones
     de paleta sobre el mismo esqueleto tipográfico/de forma. El usuario
     aclaró primero, vía pregunta, que quería "profesional con más
     carácter" (no "bold/poco convencional") antes de construir el
     preview -- evitó gastar el ciclo de diseño en una dirección que se
     alejara demasiado del uso empresarial real de la app.
  Mapeo de la paleta actual: `--forest-800 #2E4F32` (sidebar/marca/títulos
  de tarjeta), `--forest-600 #3D6B3F` (`--accent`: botón lleno, enlaces,
  foco), `--forest-soft #E3EAE0` (`--accent-soft`, glow de foco), `--brass
  #B98A34` (acento de energía — SOLO en el ítem de navegación activo y el
  degradado del logo, nunca en texto largo ni en badges de estado; como es
  un dorado claro, el texto encima usa `--brass-ink #241C0D`, no blanco),
  fondo cálido `--parchment #F3ECDD` con tarjetas en `--paper #FBF8F0` y
  bordes/texto en tonos tierra (`--parch-mist/-tan/-ash`, `--ink-slate`,
  `--ink`). Títulos de tarjeta (`.row-ent`, `.titleblock-head h2`,
  `.quick-card-title`, etc.) en `--forest-800`, cuerpo de texto en `--ink`.
  **Lo que sí cambió esta vez, a diferencia de los reskins anteriores (que
  fueron ~100% color)**:
  - Radios MUCHO más chicos (`--radius-sm:3px/--radius-md:5px/--radius-lg:8px`,
    antes 8/10/14) -- de "tarjeta de SaaS moderno" a "ficha/folio de
    archivo". Los badges/botones-píldora (`.tag`, `.eval-verdict`,
    `.btn-mini`, `.expeval-badge`) tenían `border-radius: 999px` HARDCODEADO
    (no vía token) en 4 lugares -- se cambiaron a `var(--radius-sm)` a mano;
    no bastaba con tocar el bloque de tokens.
  - Tipografía: Fraunces (serif con optical sizing, "tallada a mano" en
    tamaños grandes) reemplaza a Plus Jakarta Sans para encabezados/
    `.display-font`; Public Sans reemplaza a Inter para el cuerpo; Spline
    Sans Mono reemplaza a la pila de monoespaciadas del sistema en `.mono`
    (sin uso real en el HTML actual, pero se mantiene consistente).
  **La misma excepción de siempre**: los colores de estado
  (`--success/--danger/--warning`, CUMPLE/NO CUMPLE/NO DETERMINABLE,
  GO/NO-GO/REVISAR) NUNCA cambian con la paleta de marca — son señal
  funcional de cumplimiento, no decoración. Esta vez había un riesgo real
  de confusión porque la marca AHORA es verde: se eligió `--success
  #1E7A45` (verde más saturado/brillante, "confirmación") deliberadamente
  distinto de `--forest-800 #2E4F32` (verde apagado/oscuro de marca) para
  que un badge "GO"/"CUMPLE" no se lea como decoración de marca.
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
- **Tipografía actual**: Public Sans (pesos 400–700) para toda la UI, más
  Fraunces 700-900 solo para encabezados/`.display-font` (ver "Historial de
  paletas" arriba), y Spline Sans Mono en `.mono`. Antes de "Registro
  Catastral" fue Inter + Plus Jakarta Sans; antes de eso, Barlow Condensed
  (encabezados condensados) + IBM Plex Mono.
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
  `node:crypto`, `fetch` global), sin `npm install`. 5 chequeos, todos por
  análisis estático del propio `index.html` (no simulan clics ni DOM real --
  eso sigue siendo el método de "Cómo probar cambios sin desplegar" de
  arriba, para cambios grandes):
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

## LLM para lenguaje natural: diseñado, NO implementado (pospuesto por el usuario)

El usuario pidió avanzar con esto, se le presentó el diseño completo (por
qué la app NO puede llamar a la API de Anthropic directo desde el navegador
-- a diferencia de la anon key de Supabase o el App Token de Socrata, una
API key de Anthropic es un secreto real y facturable, así que hace falta una
Edge Function de Supabase como intermediario; costo estimado con Claude
Haiku 4.5, ~$0.001 USD por consulta según el pricing oficial verificado en
[claude.com/pricing](https://claude.com/pricing); tabla `llm_usage` sin
policies de RLS -- a propósito, para que ni el dueño de la cuenta pueda
resetear su propio contador de límite diario) y el usuario decidió
posponerlo para después. Si se retoma, el diseño completo (código de la
Edge Function incluido) quedó en el historial de la conversación -- pedirle
al usuario que lo comparta de nuevo o reconstruirlo desde cero con el mismo
criterio (proxy server-side obligatorio, nunca la API key en `index.html`).

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
