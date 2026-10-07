# Bitácora SECOP — guía para trabajar en el proyecto

Rastreador de licitaciones SECOP I/II para una constructora en Norte de Santander (Cúcuta). Sitio **estático** (HTML/CSS/JS puro,
sin build), publicado en GitHub Pages: https://nerodante85.github.io/Bitacorasecop/ . Backend opcional en Supabase (cuentas,
sincronización, Edge Functions de IA y correo).

> **Historial completo** (por qué se decidió cada cosa, bugs reales, cómo se verificó): `docs/HISTORIAL.md`. Este archivo es
> solo lo vigente. Los comentarios de código que dicen "ver CLAUDE.md" apuntan a una sección de ese historial: búscala por título
> (`grep -n "^## " docs/HISTORIAL.md`). Otros documentos: `README.md` (producto), `PRODUCT.md`, `DESIGN.md` (sistema visual),
> `auditoria/` (informes y `RELEASE-BLOCKERS.md`).

## Cómo trabajar con el usuario (reglas de colaboración)

- Habla **español**, directo y consultivo (el usuario es gerente de una constructora, no desarrollador).
- **No abras PR sin que lo pidan.** Trabaja en la rama asignada por la sesión; tras un merge, reiníciala desde `main`
  (`git fetch origin main && git checkout -B <rama> origin/main` y push con `--force-with-lease`).
- **Prueba primero**: escribe la prueba, míra que falle, implementa, mira que pase. Para lógica crítica, comprueba por
  **mutación** (rompe el código a propósito y confirma que la prueba falla; luego revierte). Hay una skill: `verificar-por-mutacion`.
- Un cambio que toca el esquema de una Edge Function exige **una extracción real** antes de darlo por bueno (un esquema con más
  de 16 uniones de tipos rompió Anthropic con HTTP 400 sin que los tests lo notaran).
- **Mide, no mires**: overflow con `scrollWidth - clientWidth`, contraste con cálculo, estado con `getComputedStyle`, no solo
  capturas. Skills: `medir-responsive`, `revisar-vista-movil`, `probar-con-archivos-reales`.
- Principio del motor: **ante la duda, NO DETERMINABLE; nunca inventar un CUMPLE** ni un dato.
- Antes de borrar algo "que parece solo de una sección", mapea qué funciones son compartidas (pasó con "Competencia").

## Arquitectura

- Sin build ni framework. `index.html` (~12.500 líneas: HTML + CSS + un `<script>` inline) más scripts planos propios:
  - `lectura.js` (`window.Lectura`): lectura de documentos por tandas con tres lectores (texto, OCR, IA); sin DOM.
  - `evaluacion.js` (`window.Evaluacion.crear(deps)`): motor del veredicto GO / REVISAR / NO-GO; recibe un `ctx` explícito
    `{minV, maxV, perfilesProfesionales, perfiles}`; sin DOM ni globales.
  - `formatomaestro.js` (`window.FormatoMaestro`): importador del Formato Maestro de Experiencia (ver más abajo); sin DOM ni librería de Excel.
  - `coincidencia.js` (`window.Coincidencia`): reglas de coincidencia de procesos. **Una copia idéntica** vive en
    `supabase/functions/daily-digest/coincidencia.js` (una prueba falla si difieren; sincroniza con
    `cp coincidencia.js supabase/functions/daily-digest/`).
  - `vendor/xlsx-0.20.3.full.min.js`: SheetJS auto-alojado. pdf.js 3.11.174 (cdnjs), Tesseract.js 5.1.1 y mammoth.js 1.12.3
    (jsDelivr) y supabase-js 2.116.0 se cargan con **SRI**; si subes una versión, recalcula el hash.
- Otros archivos del sitio: `404.html`, `privacidad.html`, `snapshot.json` (respaldo de procesos si falla la consulta en vivo),
  `sitemap.xml`.
- **Vistas y menú** (reestructuración 2026-10, ver `auditoria/REESTRUCTURACION-2026-10-AUDITORIA-Y-PLAN.md`): el menú son 4 ítems —
  **Buscar procesos · Mis procesos · Empresa · Documentos**— más "Configuración y ayuda" (zona secundaria: cuenta, respaldo, cómo leer un
  resultado). La marca abre **Inicio** (`dashboard`: buscador, 3 accesos, actividad reciente; sin cifras). `analisis` es el detalle de UN proceso
  (sin ítem de menú; `vistaOrigenAnalisis` decide qué ítem queda marcado). `perfil/experiencia/personal` son paneles con pestañas dentro de
  `empresa` (mismos ids de DOM). `ALIAS_VISTAS` (`pipeline→procesos`, `evaluacion→analisis`) mantiene vivas las últimas vistas guardadas.
  `mostrarVista(nombre)` acepta cualquiera de los nombres; el foco pasa al `h1` del contenedor.
- **Mis procesos** reemplaza el pipeline: 5 estados (`ETAPAS_PIPELINE`: por_revisar, en_analisis, viable, no_viable, presentada) en `historial[id].etapa`;
  `migrarHistorialEtapas` lleva las 6 etapas viejas a los 5 estados al cargar (conserva `consorcio`/`resultado` en el dato, sin pantalla).
- **Resultado global** con 4 nombres: `GO · REVISAR · NO-GO · NO DETERMINABLE`. `decidirVeredicto` (3 valores) no cambia; `veredictoGlobal` (evaluacion.js) agrega
  NO DETERMINABLE cuando no hay evidencia de ningún requisito (sin pliego, o solo gates administrativos en verde). Nunca mostrar `veredicto` crudo: usar
  `etiquetaVeredicto(res.mejor.veredictoGlobal)`.
- **Pantalla de análisis** (`resultadoAnalisisHtml`): resultado + explicación → `resumenViabilidad` (5 áreas) → `alertasAnalisis` → matriz
  (`matrizRequisitos`: filas IA o gates del motor) con filtro y panel lateral de evidencia (`abrirEvidencia`). Las 3 funciones puras viven en `evaluacion.js`.
  Una fila IA con cita sin verificar es NO DETERMINABLE; "Analizar pliego" ya no se bloquea por datos de empresa incompletos (sale NO DETERMINABLE y se avisa).
- **Búsqueda natural sin IA**: `interpretarBusqueda` llena los filtros y `#bt-nl-entendi` dice qué entendió; lo que no entiende va a `avisos`. Valor, entidad
  y fecha de cierre **sí filtran** (`cumpleRangoValor`, `coincideEntidad`, `cierraEnDias`); un proceso sin valor no se oculta por el rango.
- **Capacidad Residual (Fase 1, 2026-10)**: en `empresa › Datos`, sección "Capacidad Residual" (`#bt-capacidad-estimada-out` + lista de contratos en ejecución). La K sigue siendo la que la empresa
  **declara** (`kResidual`); la app descuenta el SCE (`calcularSCE`, con porcentaje de participación en consorcio/UT y saldo derivado de valor − ejecutado) y NO recalcula K con la metodología
  completa (CO, E, CT, CF: Fase 2, pendiente de la fuente oficial). Lógica pura en `evaluacion.js` (`validarContratoEjecucion`, `contratosDuplicados`, `resumenCapacidadResidual` con estados
  completa/preliminar/no_calculable, `comparacionCapacidadResidual`). En el análisis, `capacidadResidualAnalisisHtml` muestra exigida vs empresa con fuente y página; la misma regla del gate
  "Capacidad K residual". `extraerKResidualUmbral` devuelve `conflicto` si el documento trae montos distintos (nunca elige uno). Detalle en `auditoria/CAPACIDAD-RESIDUAL-FASE1.md`.
- **Formato Maestro de Experiencia** (diseño, 2026-10): plantilla en `plantillas/Formato_Maestro_Experiencia_BitacoraSECOP_v1.xlsx` (sujetos, contratos únicos, participaciones, UNSPSC, cantidades, listas y SMMLV con fórmulas). La app lo **importa** (`formatomaestro.js`, `window.FormatoMaestro`, puro y sin DOM): `cargarExcelExperiencia` lo detecta por las hojas SUJETOS/CONTRATOS/PARTICIPACIONES, pregunta a qué sujeto corresponde la empresa (y si se suman las personas de `CUENTA_PARA`) y entonces `importarFormatoMaestro` guarda los contratos en el motor de experiencia (valor NOMINAL + participación; el motor pondera) y pasa los que están `En ejecución`/`Suspendido` a Capacidad Residual. No usa las columnas calculadas del libro (un archivo recién generado no trae valores de fórmula). Un contrato con varios participantes del mismo destino entra UNA vez (suma de porcentajes); consorcio sin porcentaje entra sin valor. Los Excel antiguos se siguen leyendo como antes. Diseño y auditoría en `auditoria/FORMATO-MAESTRO-EXPERIENCIA-FASE*.md`.
- **Documentos**: `inventarioDocumentos` (puro) lista lo cargado; no guarda archivos nuevos (RUP/RUT/hojas de vida no se conservan como archivo).
- **SECOP I fue retirado por completo** (2026-10, decisión del usuario): ni búsqueda ni adjudicaciones; solo SECOP II. Decisión abierta: texto jurídico de privacidad.
- **Datos**: dataset SECOP II `p6dx-8zbt` (Buscar procesos y adjudicaciones), PAA `9sue-ezhx`. Todo vía Socrata (datos.gov.co) con `X-App-Token`.
- **Persistencia**: `window.storage.get/set` (shim sobre `localStorage` con prefijo `bitacora_`; con cuenta conectada, sincroniza a
  Supabase). Claves sincronizadas (`SYNCED_KEYS`): historial, perfiles_empresa, perfil_activo_id, perfiles_activos,
  perfil_empresa (legado), analisis_pliegos, experiencia_evaluacion, perfiles_profesionales, personal_activo_id, ultima_vista,
  alertas_guardadas, correo_digest_activo, schema_version.
  - `analisis_pliegos` se sincroniza **por elemento** en la tabla `app_state_analisis_items` (no como un blob).
    Cada entrada guarda también `proceso` (resumen: `snapshotDeProceso`) para poder reabrirla sin la búsqueda en pantalla; `procesoPorId(id)` busca en la búsqueda actual y, si no está, lo reconstruye (`procesosAnalizadosFueraDeLista`: resumen propio → `historial[id].snapshot` → "sin datos guardados").
  - El **texto completo** de un pliego (`text`, `ocrText`, `estudioPrevioText`) vive en **IndexedDB** (`bitacora_textos_pliego`),
    no en el blob; es local al navegador.
  - `experiencia_evaluacion` guarda `{porPerfil: {perfilId: {contratos, meta}}}`; `expevalContratos` es el **combinado derivado**
    (`recalcularExpevalActivo()`) de las empresas marcadas para comparar (consorcio/unión temporal = suma de contratos).
- **Supabase** (`supabase/`): `schema.sql`, `migrations/`, `cron.sql`, `config.toml` y 4 Edge Functions:
  `extraer-requisitos` (IA lee el PDF y extrae requisitos con cita), `transcribir-pdf` (IA transcribe páginas escaneadas, tandas de
  8), `daily-digest` (correo diario vía Resend + cron), `eliminar-cuenta`. Reglas comunes: `verify_jwt`, empresa resuelta en el
  servidor, cupo diario reservado en `ai_usage` antes de llamar a Claude, PDFs de Storage borrados al terminar, respuesta en
  streaming con latidos (el gateway corta a ~150 s). `CONTRATO_VERSION` cliente/servidor debe coincidir (hay prueba).
- **CORS (F-09)**: las 3 funciones que llama el navegador (`eliminar-cuenta`, `extraer-requisitos`, `transcribir-pdf`) solo dan permiso
  a `https://nerodante85.github.io` (comparación exacta, nunca `*`); el origen se decide por petición en el envoltorio `Deno.serve`
  → `manejar(req)`. Otro dominio o un servidor local contra el backend real: secret opcional `ALLOWED_ORIGINS` (coma). El auxiliar
  `corsOrigenHeaders` es idéntico en las tres (una prueba lo verifica). Si publicas en un dominio propio y no pones su origen ahí,
  **el navegador bloqueará las llamadas a las funciones** (síntoma: la IA "no responde" y la consola dice CORS).
- **RLS es la única barrera** entre empresas (la app es 100 % cliente). Los secretos (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `CRON_SECRET`, `DEBUG_SECRET`) viven solo como secrets de Supabase, nunca en el repo ni en el chat.
- **CSP** por `<meta>`: `connect-src` fija el host del proyecto Supabase. Si usas un origen nuevo, agrégalo (hay una prueba).

## Flujo del producto

1. **Perfil de la empresa** (RUP/K/K residual, datos legales, contratos en ejecución → capacidad estimada). El perfil **no**
   evalúa experiencia. Autocompleta desde RUP y RUT (PDF oficiales, sin IA; OCR solo de respaldo).
2. **Experiencia**: Excel/PDF/Word de contratos **por empresa** (Excel: lee todas las hojas; prefiere la columna de valor
   ajustado por participación). **Los requisitos salen del Pliego/Estudio Previo de cada proceso**, no de una matriz manual.
3. **Personal**: perfiles profesionales (gate de "Analizar pliego" junto con Experiencia).
4. **Buscar procesos** → por tarjeta: "Analizar pliego (PDF)" o "Analizar Estudio Previo" (cuando no hay pliego). Dos pasos:
   cargar y luego analizar. Lectura de texto, OCR o IA (por tandas, con "seguir leyendo").
5. **Tarjeta de análisis**: resumen arriba (veredicto, contadores, razones, botones de carta/paquete) y secciones plegables
   (`seccionPlegable`): alertas, experiencia requerida, requisitos habilitantes (IA), cronograma y riesgos (IA), detalle del
   veredicto, coincidencia con perfiles, lectura y avisos. Se abren solas solo si piden acción.
6. **Veredicto** (`evaluarProceso`): gates → GO solo si todo está en verde y hay pliego leído; cualquier gate `nd`/`revisar`
   da REVISAR; un `fail` da NO-GO. Lectura parcial siempre se avisa.
7. Extras: Alertas guardadas (+ correo diario), PAA, Pipeline Kanban (reutiliza `historial`), sugerencia de oferta económica,
   adjudicaciones de la entidad (SECOP II), documentos de propuesta (carta, hojas de vida, paquete) como **plantillas
   orientativas**.

### IA: la IA extrae, el motor decide
- "Extraer requisitos con IA" devuelve filas con cita y página; el navegador **verifica la cita contra el texto real** del PDF.
  Una fila sin verificar o de confianza baja **jamás** produce CUMPLE/NO CUMPLE (queda NO DETERMINABLE hasta que el usuario
  la confirme). Para pliegos largos se recortan las páginas relevantes y se mandan **todas las no leídas**; tope de 100 páginas.
- Comparación SMMLV ↔ pesos solo con regla explícita del pliego y año conocido; si no, NO DETERMINABLE.
- Experiencia: coincidencia **total** de palabras distintivas (la parcial nunca decide CUMPLE); condiciones cuantitativas o
  temporales no modeladas bloquean el CUMPLE automático; un contrato en ejecución no acredita; alternativos (OR) se agrupan.
- El Radar de Afinidad IA y la búsqueda en lenguaje natural se construyeron y se **descartaron por costo/valor**: no los
  reconstruyas sin releer `docs/HISTORIAL.md`.

## Diseño de interfaz (tema "Taller", oscuro con acento ámbar)

- Sistema de **tokens** en `#bitacora-root { ... }` (`--brand-*`, `--accent`, `--bg`, `--surface`, `--text*`, estados
  `--success/--danger/--warning` con fondo tintado, `--on-status`, radios 8/12/14). Cambiar el aspecto = redefinir los valores.
- Fuentes: Outfit (UI y títulos), JetBrains Mono (`.mono`), Space Grotesk solo en el wordmark. Logo: monograma B (paleta propia).
- Los **colores de estado nunca cambian con la marca**; sobre relleno de estado va texto oscuro (`--on-status`), no blanco.
- Reglas aprendidas: contraste AA (hay pruebas que lo calculan desde los tokens); nada bajo 12 px; área táctil de 44 px en
  celular; sin radios de píldora; `[hidden]` pierde contra un `display` de autor (agrega `[hidden]{display:none}`); un grid sin
  `minmax(0,1fr)` o un `nowrap` ensanchan la página; `overflow-wrap:anywhere` en textos de SECOP; no uses `text-transform` en
  clases con texto dinámico; busca variables CSS huérfanas y fuentes viejas dentro de los strings de JS tras cada cambio de tema.
- Reutiliza clases existentes (`.titleblock`, `.row`, `.tag`, `.analysis-*`, `.expeval-*`, `.stat-card`, `.info-tip`,
  `.analysis-fold`) antes de crear CSS nuevo. Si cambias el texto de un botón, busca dónde el JS reescribe su `textContent`.
- Cada ítem nuevo de navegación obliga a volver a medir el menú en celular.
- `mostrarVista(nombre, { enfocar:false })`: si el foco se perdió al cambiar de vista (cuerpo, vista oculta o control que dejó de verse), pasa al `h1` de la vista nueva (`tabindex=-1`); nunca se mueve si sigue en un control visible (las flechas del menú dependen de eso) y la carga inicial no lo roba.

## Cosas aprendidas por las malas (no las repitas)

**SECOP / Socrata**
- Socrata trata varias palabras en `$q` como AND: una consulta por palabra clave. Sin `$order` no hay orden garantizado
  (`fecha_de_publicacion_del DESC`, con reintento sin orden). El dataset se refresca **una vez al día**.
- Palabras clave por **raíz de 6 letras** (pavimento ≈ pavimentación). El departamento se compara **solo** contra `departamento`
  (nunca el registro completo ni `ciudad`: "Santander" traía Córdoba y Cauca). El municipio sí es tolerante por palabras.
- Fechas fuera de 2015–2035 se descartan. Los enlaces a `community.secop.gov.co` llevan `isFromPublicArea=True&isModal=False`
  (aun así puede pedir login: se muestra la Referencia como respaldo).
- Los filtros de fábrica no deben esconder procesos: Especialidades y Cobertura nacen **vacíos**; "Solo Licitación Pública" nace
  desmarcado; "Número de proceso" ignora los demás filtros (y se avisa).
- Con `$limit` se avisa si hay más resultados. SECOP I se retiró (no se consulta).

**Documentos**
- RUP: códigos UNSPSC como `NN NN NN NN : DESCRIPCIÓN`; indicadores `ETIQUETA : valor` con pdf.js; el RUP **no** trae capacidad
  residual (se llena a mano); se priorizan segmentos de obra y se acotan ~90 códigos.
- RUT: formulario de casillas; se lee **por posición (x, y)** anclando por texto de etiqueta, con límites de columna encadenados.
- OCR: Tesseract v5 desde jsDelivr (cdnjs no sirve el paquete completo); detecta rotación probando 4 ángulos solo en la primera
  página y la reutiliza (`rotacionConocida`). Un PDF escaneado de pliego se lee mejor con la IA (`transcribir-pdf`, 8 páginas/tanda).
- Excel de experiencia: leer **todas** las hojas; descartar filas vacías; panel "Revisar interpretación".
- Excel de experiencia: las fechas son **números de serie** con formato m/d/yy; el texto ("12/2/94") es ambiguo → `fechasDeHojaAISO` las convierte a ISO leyendo con `cellNF:true`. "En Ejecución" en la columna de terminación marca `enEjecucion` (no acredita). Probado con 4 Excel reales (antes 0 de ~300 contratos con fecha). Si la columna de valor preferida es la "actualizada/según %" y una fila la trae vacía, esa fila usa "VALOR CONTRATO" como respaldo (`valorNominal`, sin dar por ajustado el %), solo en filas con objeto o contratante.
- Un PDF con contraseña da mensaje claro (`mensajeErrorPdf`). Un `<input accept>` no filtra el arrastrar y soltar:
  valida la extensión (`esTipoDeArchivoAceptado`).

**Código**
- El 0 es un valor real: no uses `!v` (rompió `fmtMoney`, `parseValorUnidad`, el valor de la obra).
- `Object.assign({}, PERFIL_VACIO, p)` copia arrays por referencia: no pongas arrays en `PERFIL_VACIO`.
- `toggleStatus` y `quitarDePipeline` deben borrar solo lo suyo del mismo registro de `historial`.
- Al quitar una sección "que ya se muestra en otro lado", comprueba que ese otro lado existe en **todos** los casos.
- Una sola fuente de verdad para conteos mostrados dos veces (el "6 vs 7" del veredicto).
- Los `<details>` de una tarjeta se cierran al re-renderizarla; no re-renderices al marcar una casilla de confirmación.

## Probar

- `node tests/smoke.mjs` (Node 22, sin dependencias): sintaxis del script, ids, funciones clave, CSP, SRI de los CDN (necesita red:
  **falla en local si no hay salida a internet; en CI debe pasar**), el motor de experiencia/veredicto ejecutado de verdad con
  Excel sintéticos, lectura, red flags, IA, Edge Functions (lógica pura), accesibilidad, contraste y tarjeta. Extrae funciones de
  `index.html` por anclas de texto; si renombras una función, actualiza la lista.
- `node tests/e2e.mjs` (F-07): flujos reales en un navegador (menú, Inicio → búsqueda natural, Mis procesos, análisis sembrado con matriz y
  panel de evidencia, foco del teclado, menú móvil, descargas, análisis guardados, aviso de datos de ejemplo/respaldo). Sirve el repo en local y **aborta toda red externa** (la app cae al
  snapshot: determinista). Necesita Playwright solo para esto: en CI `npm install --no-save --no-package-lock --ignore-scripts
  playwright-core@1.56.1` + el Chrome del runner; en el sandbox `PLAYWRIGHT_NODE_MODULES=/opt/node-tools/node_modules
  CHROME_PATH=/opt/pw-browsers/chromium node tests/e2e.mjs`. smoke.mjs mira el código; e2e comprueba que el flujo FUNCIONA (con averías
  de comportamiento a propósito, smoke no las vio y e2e sí). Corre en PR (`smoke.yml`) y en main (`pages.yml`, sin bloquear el despliegue
  todavía). Al cambiar un flujo de pantalla, actualiza también e2e.
- Navegador real: `python3 -m http.server 8123` en la raíz y Chromium/Playwright (en el sandbox: `/opt/pw-browsers`,
  `/opt/node-tools/node_modules/playwright`). Archivos se inyectan por `DataTransfer` (skill `probar-con-archivos-reales`).
  Los datos de ejemplo ("Ver datos de ejemplo") requieren desmarcar los filtros restrictivos. Pestaña nueva para mirar la consola
  (el historial es acumulativo). Verifica CSP y la hoja de estilos con `getComputedStyle`.
- El sandbox **no llega** a `nerodante85.github.io` ni a `githubstatus.com` (proxy 403): pide al usuario una captura para
  confirmar lo publicado, y revisa el despliegue por la API de Actions.
- Lo que no se puede probar sin cuenta/crédito (llamadas reales a Claude, correo, login real) se dice explícitamente.

## Despliegue y operación

- `pages.yml`: corre las pruebas y, si la variable `PAGES_POR_ACTIONS=true`, publica `index.html` + scripts propios (sellados
  con `?v=<commit>`) + `vendor/`, `404.html`, `privacidad.html`, `snapshot.json`, `sitemap.xml`. **Un archivo nuevo del sitio
  debe agregarse a la lista de `Preparar el sitio`** o nunca llega a producción.
- `funciones-supabase.yml`: despliega las Edge Functions al cambiar `supabase/functions/**` (secreto `SUPABASE_ACCESS_TOKEN`,
  variable `DEPLOY_FUNCIONES=true`). Tras tocar una función, invócala (p. ej. `daily-digest?debug=1`) para ver que arranca.
- Si GitHub Actions tiene un incidente, los trabajos se cancelan tras ~15 min en cola: revisa githubstatus.com antes de relanzar.
- Pendientes de auditoría y decisiones abiertas: `auditoria/RELEASE-BLOCKERS.md`.

## Limitaciones y decisiones abiertas

- El correo diario solo llega al dueño de la cuenta de Resend hasta verificar un dominio y fijar `DIGEST_FROM_EMAIL`.
- Pliegos muy largos (~70+ páginas con matriz extensa) pueden exceder los ~150 s del plan gratuito de Supabase en la extracción con
  IA; no se paga el plan para esto. pdf.js se queda en 3.x (migrar a 4.x implicaría módulos ES).
- La matriz de experiencia del pliego (tablas) puede no leerse como texto: se avisa "posible tabla no leída" por página.
- Falta completar la política de privacidad: `privacidad.html` es un borrador con campos `[COMPLETAR]` (responsable, contacto,
  transferencia internacional, plazos) y revisión de un abogado; solo la persona responsable puede darlos.
- Los PDFs huérfanos del bucket `pliegos` se barren a diario (más de 24 h) dentro de `daily-digest` (`pliegosVencidos`).
- **No** recortar la verificación de citas a las páginas citadas (evaluado y descartado): leer 300 páginas con pdf.js tarda ~1,4 s y
  bloquea el hilo menos de 70 ms (medido), y esa misma lectura completa alimenta la detección de texto dirigido a la IA (IA-007),
  que necesita ver todas las páginas.
