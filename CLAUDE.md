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
  4. **Actual: "Cobalt & Marigold"**, elegida desde un Artifact con 6
     paletas nuevas -- esta vez no solo con hex sueltos, sino con una
     réplica en miniatura del sidebar/tarjeta/badges reales para cada una
     (`sendPrompt` en el botón "Elegir esta paleta" mandó el mensaje con el
     nombre exacto). Lección: para color, mejor mostrar un preview en
     contexto que describir con palabras -- la ronda anterior eligió a
     ciegas y no le convenció el resultado real.
  Mapeo de la paleta actual: `--cobalt-800 #16234A` (sidebar/marca),
  `--cobalt-600 #2A46B8` (`--accent`: botón lleno, enlaces, foco, títulos de
  página), `--cobalt-soft #E7EBFA` (`--accent-soft`, glow de foco),
  `--marigold #F2A93B` (acento de energía — SOLO en el ítem de navegación
  activo y el degradado del logo, nunca en texto largo ni en badges de
  estado; como es un dorado claro, el texto encima usa `--marigold-ink
  #1A1206`, no blanco, o no hay contraste suficiente), fondo frío
  `--cool-paper #F7F8FC` con bordes/texto en grises azulados
  (`--cool-mist/-smoke/-ash/-slate/-charcoal`). Títulos de tarjeta
  (`.row-ent`, `.titleblock-head h2`, `.quick-card-title`, etc.) en
  `--cobalt-800`, cuerpo de texto en `--cool-charcoal`. Mismos radios que la
  paleta anterior (`--radius-sm:8px`, `--radius-md:10px`, `--radius-lg:14px`)
  y Plus Jakarta Sans en `.view-header h1` -- no eran parte de lo que
  cambió esta vez, solo el color.
  **La misma excepción de siempre**: los colores de estado
  (`--success/--danger/--warning`, CUMPLE/NO CUMPLE/NO DETERMINABLE,
  GO/NO-GO/REVISAR) NUNCA cambian con la paleta de marca — son señal
  funcional de cumplimiento, no decoración.
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
- **Tipografía**: Inter (pesos 400–800) para toda la UI, más Plus Jakarta
  Sans 500 solo para el título de página (ver reskin "Wiza" arriba). Se
  quitaron Barlow Condensed (encabezados condensados) e IBM Plex Mono (para
  todo lo demás) — `.mono` ahora usa una pila de monoespaciadas del sistema,
  sin dependencia externa extra, reservada para códigos/referencias.
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
