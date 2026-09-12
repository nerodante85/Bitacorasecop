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
  3. **Actual: "Teal y coral"** — el usuario pidió algo "más moderno y
     divertido sin perder el toque profesional" y se le ofrecieron 4
     paletas para elegir (vía pregunta con opciones); escogió esta.
  Mapeo de la paleta actual: `--teal-800 #115E59` (sidebar/marca),
  `--teal-600 #0D9488` (`--accent`: botón lleno, enlaces, foco, títulos de
  página), `--teal-soft #CCFBF1` (`--accent-soft`, glow de foco),
  `--coral #FB7185` (acento de energía — SOLO en el ítem de navegación
  activo y el degradado del logo, nunca en texto largo ni en badges de
  estado), fondo cálido `--warm-paper #FAF7F2` en vez del gris frío
  anterior, bordes/texto en grises cálidos (`--warm-mist/-smoke/-ash/-slate/-charcoal`).
  Títulos de tarjeta (`.row-ent`, `.titleblock-head h2`, `.quick-card-title`,
  etc.) en `--teal-800`, cuerpo de texto en `--warm-charcoal`. Radios un poco
  más suaves que en la paleta Wiza (`--radius-md:10px`, `--radius-lg:14px`,
  `--radius-sm:8px` para botones/inputs) — un toque más redondeado ayuda a
  la sensación "divertida" pedida. Plus Jakarta Sans se conserva para
  `.view-header h1` (no era parte de lo que cambió esta vez).
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

- Navegación por sidebar con 5 secciones: Inicio (dashboard con resumen y
  actividad reciente), Buscar procesos, Perfil de la empresa, Experiencia y
  Evaluación (ver "Diseño de interfaz" arriba).
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
