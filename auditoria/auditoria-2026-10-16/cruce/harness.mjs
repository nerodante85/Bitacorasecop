#!/usr/bin/env node
// ============================================================================
// Tests de humo — Bitácora SECOP
// ============================================================================
// Sin dependencias externas a propósito: el proyecto no tiene build step ni
// package.json, y esto corre con el Node que ya trae el runner de GitHub
// Actions (ver .github/workflows/smoke.yml) sin necesitar `npm install`.
//
// Objetivo: atrapar ANTES de publicar los tipos de regresión que ya se vieron
// en producción durante el desarrollo de esta app (variables CSS huérfanas,
// texto de estado no restaurado, un `<script>` de terceros que deja de
// coincidir con su hash SRI) — no es una suite de cobertura exhaustiva ni
// reemplaza probar el flujo completo a mano en el navegador antes de un
// cambio grande (ver "Cómo probar cambios sin desplegar" en docs/HISTORIAL.md).
//
// Uso: node tests/smoke.mjs
// ============================================================================

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = '/home/user/Bitacorasecop';
// Reglas compartidas (coincidencia.js): el mismo archivo que carga el navegador y copia daily-digest.
const Coincidencia = (await import(pathToFileURL(path.join(ROOT, 'coincidencia.js')).href)).default;
const Evaluacion = (await import(pathToFileURL(path.join(ROOT, 'evaluacion.js')).href)).default;
const FormatoMaestro = (await import(pathToFileURL(path.join(ROOT, 'formatomaestro.js')).href)).default;
const Magnitudes = (await import(pathToFileURL(path.join(ROOT, 'magnitudes.js')).href)).default;
globalThis.Magnitudes = Magnitudes; // index.html lo carga como script global; el motor extraído lo busca en el scope global
const HTML_PATH = path.join(ROOT, 'index.html');
const html = readFileSync(HTML_PATH, 'utf8');

let failed = 0;
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FALLO ' + name);
    console.log('        ' + (e && e.message ? e.message : String(e)));
    // execFileSync (node --check) no vuelca el error de sintaxis real en
    // `.message` -- queda en stderr/stdout del proceso hijo.
    const extra = (e && e.stderr) ? e.stderr.toString() : (e && e.stdout ? e.stdout.toString() : '');
    if (extra.trim()) console.log('        ' + extra.trim().split('\n').join('\n        '));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'la condición esperada no se cumplió');
}

// Extrae el cuerpo del <script> principal. Se busca la etiqueta EN SU PROPIA
// LÍNEA (no cualquier aparición del texto "<script>") porque el archivo
// menciona literalmente "<script>" dentro de un par de comentarios
// (explicando por qué la CSP necesita 'unsafe-inline') — un regex ingenuo que
// matchee la primera aparición del texto capturaría HTML/CSS como si fuera JS.
function extractMainScript() {
  const open = html.match(/^<script>$/m);
  assert(open, 'no se encontró la apertura de <script> en su propia línea');
  const startIdx = open.index + open[0].length;
  const endIdx = html.indexOf('\n</script>', startIdx);
  assert(endIdx !== -1, 'no se encontró el cierre </script> del script principal');
  return html.slice(startIdx, endIdx);
}


// 1) El <script> principal es JS sintácticamente válido -------------------
async function check_(name, fn){}
await check_('el <script> principal es JS válido (node --check)', () => {
  const body = extractMainScript();
  const tmp = path.join(ROOT, '.smoke-tmp-script.js');
  writeFileSync(tmp, body, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } finally {
    unlinkSync(tmp);
  }
});

// 2) Todo id referenciado por getElementById existe en el archivo ---------
// (incluye tanto el HTML estático como los ids escritos a mano dentro de
// strings de JS que generan HTML dinámico, ej. el botón "Intentar con OCR"
// -- ambos son texto literal del archivo, así que un regex sobre TODO el
// archivo los cubre a los dos por igual.)
await check_('todo getElementById(\'...\') referenciado existe como id="..." en el archivo', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const refs = new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
  assert(refs.size > 0, 'no se encontró ningún getElementById(\'...\') -- ¿cambió el patrón de código?');
  const missing = [...refs].filter(id => !ids.has(id));
  assert(missing.length === 0, 'id(s) referenciados por JS que no existen en el archivo: ' + missing.join(', '));
});

// 3) Funciones clave del flujo principal siguen existiendo -----------------
// Guarda de "no rompas lo que ya funciona": si una de estas desaparece o se
// renombra sin actualizar a quien la llama, es casi siempre un error real.
await check_('las funciones clave del flujo (experiencia → personal → pliego → resultado) existen', () => {
  const REQUIRED = [
    'escapeHtml', 'mostrarVista', 'runSearch', 'render',
    'estadoFlujoPliego', 'renderFlujoStepper',
    'evaluarProceso', 'evaluarMejor', 'gatePersonalRequerido',
    'resumenCompatibilidad', 'renderCompatibilidadHtml',
    'parsearExcelExperiencia', 'evaluarExperienciaCompleta',
    'loadPdfJs', 'loadTesseractJs', 'loadXlsxLib', 'extractPdfText', 'ocrPdfPages',
    'loadSupabaseJs', 'bootstrapAccountSession', 'openRecoveryPanel', 'handleSetNewPassword',
    'guardarAlertaActual', 'eliminarAlerta', 'evaluarAlerta', 'revisarTodasLasAlertas',
    'verNuevosDeAlerta', 'renderAlertasList', 'renderDashAlertas',
    'descuentoComparable', 'sugerenciaOfertaEconomica', 'renderOfertaSugeridaHtml',
    'calcularSCE', 'capacidadContractualEstimada', 'renderContratosEjecucion', 'renderCapacidadEstimada',
    'agregarContratoEjecucion', 'eliminarContratoEjecucion', 'actualizarCampoContrato',
    'generarCartaTexto', 'generarHojaDeVidaTexto',
    'segmentarTextoEnRequisitos', 'construirRequisitoDesdeTexto',
    'loadMammothJs', 'leerPrimeraTablaHtml', 'parsearExperienciaDeFilas', 'parsearRequisitosDeFilas',
    'valorConfiableDeTexto', 'construirContratoDesdeTexto', 'parsearExperienciaDesdeFilasTexto',
    'extraerFilasPorPosicion', 'cargarExperienciaPDF', 'cargarExperienciaDocx',
    'cargarExperienciaArchivo',
    'condicionCuantitativaSinModelar', 'extraerCantidadConUnidadContable',
    'condicionTemporalDelRequisito', 'evaluarCondicionTemporal', 'agruparAlternativos',
    'paginaDeOffset', 'detectarRedFlags', 'calcularViabilidad', 'rangoViabilidad',
    // Requisitos de experiencia extraídos del Pliego/Estudio Previo (ver
    // elegant-wandering-dewdrop.md) -- reemplazan la matriz manual.
    'textoPliegoDe', 'localizarSeccionesExperiencia', 'segmentarConOffsets',
    'extraerRequisitosDePliego', 'detectarInconsistenciasPliegoEP',
    'cargarEstudioPrevioPDF', 'cargarEstudioPrevioDocx', 'cargarEstudioPrevioArchivo',
    'evaluarExperienciaDeProceso', 'pareceRequisitoDeExperienciaReal',
    // Hacia paridad con LicitIA (ver CLAUDE.md): Fase A (PAA), Fase B (RUT),
    // Fase E (Generador de Propuestas, paquete completo).
    'normalizePAA', 'buscarPAA', 'departamentoPorEntidad',
    'parsearRUT', 'itemsDeCampoRUT', 'limitesColumnaRUT', 'campoTextoRUT', 'campoNumericoRUT',
    'generarAnticorrupcionTexto', 'generarParafiscalesTexto', 'generarFormatoExperienciaTexto', 'generarPaqueteTexto',
    // Requisitos habilitantes con IA (ver CLAUDE.md).
    'verificarFilaIA', 'filaIAaRequisito', 'exigenciasDesdeIA', 'valorContratoEnSmmlv',
  ];
  // Las funciones del motor del veredicto viven en evaluacion.js (no en index.html).
  const fuenteFunciones = html + '\n' + readFileSync(path.join(ROOT, 'evaluacion.js'), 'utf8');
  const missing = REQUIRED.filter(fn => !new RegExp('function\\s+' + fn + '\\s*\\(').test(fuenteFunciones));
  assert(missing.length === 0, 'función(es) esperadas y no encontradas: ' + missing.join(', '));
});

// 4) Todo host https:// mencionado en el código aparece en la CSP ----------
// No verifica la directiva EXACTA (script-src vs connect-src, etc.), solo
// que el host no esté totalmente ausente de la política -- el olvido más
// común y más dañino es agregar un fetch()/script.src a un dominio nuevo y
// no tocar la CSP en absoluto, lo que rompe esa función en silencio para
// cualquier usuario real (la CSP la bloquea sin que la app muestre un error
// propio, solo un mensaje suelto en la consola del navegador).
await check_('todo host https:// usado en el código aparece en la política CSP', () => {
  // Excepción deliberada: hosts que solo aparecen como destino de un <a href>
  // (el usuario navega ahí con un clic -- eso NO está sujeto a script-src/
  // connect-src/etc., ninguna directiva de esta CSP restringe una navegación
  // de nivel superior) o como dato de ejemplo dentro del snapshot embebido.
  // Si alguno de estos pasara a usarse alguna vez en fetch()/script.src, hay
  // que sacarlo de esta lista Y agregarlo a la CSP real -- recién ahí este
  // test dejaría de ignorarlo automáticamente.
  const NAVIGATION_ONLY_HOSTS = new Set([
    'community.secop.gov.co',    // enlaces "Abrir expediente"/"Buscar en SECOP II" + dato de ejemplo urlproceso
        'dev.socrata.com',           // mencionado solo en un comentario (cómo conseguir un App Token), no se usa en ningún fetch()
  ]);
  const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert(cspMatch, 'no se encontró el <meta> de Content-Security-Policy');
  const csp = cspMatch[1].toLowerCase();
  // Comodines tipo https://*.supabase.co (para el proyecto de Supabase de
  // cada quien, cuyo subdominio no es un literal fijo en el código) -- un
  // `includes()` de texto plano no los entiende, así que se extraen aparte y
  // se matchean por sufijo. Ej: '*.supabase.co' cubre 'xyz.supabase.co'.
  const wildcardSuffixes = [...csp.matchAll(/https:\/\/\*\.([a-z0-9.-]+)/g)].map(m => m[1]);
  const scriptBody = extractMainScript();
  const hosts = new Set(
    [...scriptBody.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase())
  );
  assert(hosts.size > 0, 'no se encontró ningún host https:// en el script -- ¿cambió el patrón de código?');
  const missing = [...hosts].filter(h =>
    !csp.includes(h) &&
    !NAVIGATION_ONLY_HOSTS.has(h) &&
    !wildcardSuffixes.some(suffix => h === suffix || h.endsWith('.' + suffix))
  );
  assert(missing.length === 0, 'host(s) usados en el código pero ausentes de la CSP: ' + missing.join(', '));
});

// 5) El SRI de los 4 scripts de terceros CDN sigue coincidiendo con el CDN -----
// Requiere red (GitHub Actions la tiene). Si algún día se sube de versión
// pdf.js/Tesseract.js/supabase-js/mammoth.js sin recalcular el hash,
// este test lo detecta ANTES de que un usuario real se quede con esa
// librería sin cargar (la CSP + SRI la bloquean en silencio, ver commit
// que las agregó). xlsx (SheetJS) dejó de ser un script CDN (SEG-006): se
// copió al repositorio en vendor/ porque las versiones parcheadas solo se
// distribuyen desde cdn.sheetjs.com, sin un hash SRI verificable de un
// tercero -- se verifica aparte, más abajo (test 6), que el propio archivo
// exista y que index.html/pages.yml lo referencien.
await check_('el SRI embebido de pdf.js/Tesseract.js/supabase-js/mammoth.js coincide con el archivo real del CDN', async () => {
  const scriptBody = extractMainScript();
  const pairs = [...scriptBody.matchAll(
    /\.src\s*=\s*'(https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^']+)';[\s\S]*?\.integrity\s*=\s*'(sha384-[^']+)';/g
  )].map(m => ({ url: m[1], integrity: m[2] }));
  assert(pairs.length === 4, 'se esperaban 4 scripts CDN con integrity (pdf.js, Tesseract.js, supabase-js, mammoth.js), se encontraron ' + pairs.length);
  for (const { url, integrity } of pairs) {
    const res = await fetch(url);
    assert(res.ok, 'HTTP ' + res.status + ' al descargar ' + url);
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = 'sha384-' + createHash('sha384').update(buf).digest('base64');
    assert(
      hash === integrity,
      'el hash real de ' + url + ' (' + hash + ') no coincide con el integrity embebido (' + integrity +
      ') -- si se subió de versión a propósito, hay que recalcular el hash; si no, algo cambió bajo esa URL pinneada.'
    );
  }
});

// 5b) SEG-006: xlsx (SheetJS) se auto-aloja en vendor/ -- el archivo que index.html referencia
// debe existir de verdad en el repo, y el workflow de despliegue debe copiarlo al sitio
// publicado (si no, la app funcionaría en local pero "Cargar experiencia" fallaría en
// producción con un 404 silencioso -- el mismo tipo de bug que el test 4/5 ya atrapan para
// los scripts CDN, pero esos no cubren un archivo propio).
await check_('SEG-006: el xlsx auto-alojado en vendor/ existe, index.html lo referencia por su nombre exacto, y pages.yml lo copia al sitio publicado', () => {
  const scriptBody = extractMainScript();
  const m = scriptBody.match(/script\.src\s*=\s*'vendor\/(xlsx-[^']+\.js)'/);
  assert(m, 'no se encontró la referencia a vendor/xlsx-*.js en loadXlsxLib()');
  const nombreArchivo = m[1];
  const rutaVendor = path.join(ROOT, 'vendor', nombreArchivo);
  assert(existsSync(rutaVendor), 'index.html referencia "' + nombreArchivo + '" pero no existe en vendor/');
  const pagesYml = readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert(/cp\s+vendor\/\*\.js\s+_site\/vendor\//.test(pagesYml), 'pages.yml debe copiar vendor/*.js al sitio publicado, o el archivo nunca llega a producción');
});

// 6) Motor de "Evaluación de experiencia": los 8 escenarios obligatorios del
// prompt maestro (sección 17, "Prompt maestro — Módulo de evaluación de
// experiencia del proponente.md") -------------------------------------------
// A diferencia de los checks de arriba (sintaxis, ids, hosts, SRI), esto
// prueba COMPORTAMIENTO real del motor (parsearExcelExperiencia,
// parsearRequisitosDeFilas, evaluarExperienciaCompleta) contra Excel
// sintéticos -- el check 3 de arriba solo verifica que estas funciones
// EXISTAN, no que decidan CUMPLE/NO CUMPLE/NO DETERMINABLE correctamente.
// Sin esto, un cambio futuro podría romper en silencio la lógica más crítica
// de la app (el propio prompt maestro: "un error en esta sección puede
// provocar que una empresa sea incorrectamente considerada CUMPLE o NO
// CUMPLE") sin que ningún test lo atrape.
//
// Cómo se ejecuta sin DOM/navegador: se extrae el bloque de funciones
// (normHeader..evaluarExperienciaCompleta y parseNumCO..parseValorUnidad) del
// <script> principal por anclas de texto (mismo espíritu que extractMainScript
// de arriba) y se corre con `new Function`, inyectando un `window.XLSX` falso
// cuyo `sheet_to_json` simplemente devuelve el array de filas tal cual se le
// pasó -- evita instalar la librería xlsx real solo para testear, y de paso
// prueba que `leerHojaComoFilas`/`detectarColumnas` funcionan con estructuras
// de Excel variadas (Caso 7).
function extractExperienceEngine() {
  const scriptBody = extractMainScript();
  const startA = 'function normHeader(s){';
  const endA = 'const ETIQUETAS_CONTRATO';
  const iA0 = scriptBody.indexOf(startA);
  const iA1 = scriptBody.indexOf(endA, iA0);
  assert(iA0 !== -1 && iA1 !== -1 && iA1 > iA0,
    'no se encontraron las anclas del bloque normHeader..evaluarExperienciaCompleta -- ¿se movió o renombró algo?');
  const blockA = scriptBody.slice(iA0, iA1);

  const startB = 'function parseValorUnidad(s){';
  const endB = 'function analizarTexto(text){';
  const iB0 = scriptBody.indexOf(startB);
  const iB1 = scriptBody.indexOf(endB, iB0);
  assert(iB0 !== -1 && iB1 !== -1 && iB1 > iB0,
    'no se encontraron las anclas del bloque parseValorUnidad..extraerExigencias -- ¿se movió o renombró algo?');
  const blockB = scriptBody.slice(iB0, iB1);

  // Bloque C: cálculo de capacidad contractual (SCE); usa parseNumCO del bloque B.
  const startC = 'function calcularSCE(contratos, hoyMs){';
  const endC = '  // Fila editable por contrato en ejecución';
  const iC0 = scriptBody.indexOf(startC);
  const iC1 = scriptBody.indexOf(endC, iC0);
  assert(iC0 !== -1 && iC1 !== -1 && iC1 > iC0,
    'no se encontraron las anclas del bloque calcularSCE..capacidadContractualEstimada -- ¿se movió o renombró algo?');
  const blockC = scriptBody.slice(iC0, iC1);

  // Bloque D: adjudicaciones y sugerencia de oferta económica (TR-001..TR-003).
  const iD0 = scriptBody.indexOf('function descuentoComparable(a){');
  const iD1 = scriptBody.indexOf('function renderOfertaSugeridaHtml(sug){', iD0);
  assert(iD0 !== -1 && iD1 !== -1 && iD1 > iD0, 'no se encontraron las anclas del bloque descuentoComparable..sugerenciaOfertaEconomica');
  const blockD = scriptBody.slice(iD0, iD1);

  // Las reglas de coincidencia (parseNumCO, normalizeGeo, prepararBusquedaPorNombre...) ya no están en
  // index.html: vienen del módulo compartido coincidencia.js y se exponen como globales.
  Object.assign(globalThis, Coincidencia);

  // Bloque F: generadores de documentos (carta, anexos, paquete) -- DG-001..DG-003. Usan
  // truncate/fmtMoney solo al ejecutarse; se inyectan como globales mínimos.
  const iF0 = scriptBody.indexOf('const MARCA_CONFIRMAR = ');
  const iF1 = scriptBody.indexOf('function generarHojaDeVidaTexto(pp){', iF0);
  assert(iF0 !== -1 && iF1 !== -1 && iF1 > iF0, 'no se encontraron las anclas de los generadores de documentos');
  const blockF = scriptBody.slice(iF0, iF1);
  globalThis.truncate = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };
  globalThis.fmtMoney = v => (v == null ? null : '$' + Number(v).toLocaleString('es-CO'));

  // Bloque G: lectura del RUP (UNSPSC e indicadores financieros) -- QA-001.
  const iG0 = scriptBody.indexOf('function extraerCodigosUNSPSC(texto, permitirBare){');
  const iG1 = scriptBody.indexOf('// Fusiona en una lista separada por comas sin duplicar', iG0);
  assert(iG0 !== -1 && iG1 !== -1 && iG1 > iG0, 'no se encontraron las anclas de parsearRUP');
  const blockG = scriptBody.slice(iG0, iG1);

  // Bloque H: gate de experiencia (lectura simple del resultado ya evaluado) -- QA-001.
  const iH0 = scriptBody.indexOf('function experienciaGateDetalle(entry){');
  const iH1 = scriptBody.indexOf('const REQUISITO_CATEGORIAS', iH0);
  assert(iH0 !== -1 && iH1 !== -1 && iH1 > iH0, 'no se encontraron las anclas de experienciaGateDetalle');
  const blockH = scriptBody.slice(iH0, iH1);

  // Bloque I: evaluarProceso completo (GO/NO-GO) y sus gates auxiliares -- QA-001. Usa
  // getInputs() (lee inputs del DOM en la app real) y perfilesProfesionales (estado global
  // mutable) -- ambos se inyectan como globales mínimos más abajo, mismo patrón que el resto
  // de shims de esta función.
  // El motor del veredicto (evaluarProceso, los gates, decidirVeredicto...) vive en evaluacion.js
  // y se crea más abajo con las piezas extraídas de index.html; aquí solo se extrae matrizCapacidad.
  const iI0 = scriptBody.indexOf('function matrizCapacidad(p){');
  const iI1 = scriptBody.indexOf('// El motor del veredicto GO/NO-GO vive en evaluacion.js', iI0);
  assert(iI0 !== -1 && iI1 !== -1 && iI1 > iI0, 'no se encontraron las anclas de matrizCapacidad');
  const blockI = scriptBody.slice(iI0, iI1);

  // Bloque J: lectura del RUT por posición (x,y) de los items de pdf.js -- QA-001. Mismo
  // patrón que parsearRUP (bloque G), pero por coordenadas en vez de solo texto plano.
  const iJ0 = scriptBody.indexOf('function pareceEtiquetaRUT(s){');
  const iJ1 = scriptBody.indexOf('function aplicarRUTaCampos(data){', iJ0);
  assert(iJ0 !== -1 && iJ1 !== -1 && iJ1 > iJ0, 'no se encontraron las anclas del bloque parsearRUT');
  const blockJ = scriptBody.slice(iJ0, iJ1);

  // Bloque K: aplica una extracción de requisitos con IA ya guardada al entry (conflictos,
  // exigencias, experiencia) -- QA-001. Usa expevalContratos (estado global mutable), se
  // inyecta como global más abajo.
  const iK0 = scriptBody.indexOf('function aplicarRequisitosIAaEntry(entry){');
  const iK1 = scriptBody.indexOf('function conservarCamposAuxiliares(entryNuevo, entryPrevio){', iK0);
  assert(iK0 !== -1 && iK1 !== -1 && iK1 > iK0, 'no se encontraron las anclas de aplicarRequisitosIAaEntry');
  const blockK = scriptBody.slice(iK0, iK1);

  // Bloque L: recalcularExpevalActivo -- combina la experiencia de cada perfil marcado para
  // comparar (consorcios/uniones temporales) en un solo expevalContratos/expevalMeta, "sumando
  // contratos" (regla de consorcio acordada). Usa perfiles/expevalPorPerfil (estado global,
  // inyectado por los setters más abajo) y perfilesParaComparar (bloque M).
  const iL0 = scriptBody.indexOf('function recalcularExpevalActivo(){');
  const iL1 = scriptBody.indexOf('// Perfiles PROFESIONALES (personal/equipo de trabajo)', iL0);
  assert(iL0 !== -1 && iL1 !== -1 && iL1 > iL0, 'no se encontraron las anclas de recalcularExpevalActivo');
  const blockL = scriptBody.slice(iL0, iL1);

  // Bloque M: perfilesParaComparar -- la lista de perfiles marcados para comparar, que
  // recalcularExpevalActivo (bloque L) usa para decidir qué empresas combinar.
  const iM0 = scriptBody.indexOf('function perfilesParaComparar(){');
  const iM1 = scriptBody.indexOf('function compararConPerfiles(text, hallazgos){', iM0);
  assert(iM0 !== -1 && iM1 !== -1 && iM1 > iM0, 'no se encontraron las anclas de perfilesParaComparar');
  const blockM = scriptBody.slice(iM0, iM1);

  // Bloque O: resumenEjecutivo (texto de una línea del veredicto; solo usa su argumento).
  const iO0 = scriptBody.indexOf('function resumenEjecutivo(res){');
  const iO1 = scriptBody.indexOf('// Participación en consorcio/unión temporal detectada en el pliego.', iO0);
  assert(iO0 !== -1 && iO1 !== -1 && iO1 > iO0, 'no se encontraron las anclas de resumenEjecutivo');
  const blockO = scriptBody.slice(iO0, iO1);

  // Bloque P: validaciones de entrada puras (años de experiencia, rango de valor).
  const iP0 = scriptBody.indexOf('function validarAnosExperiencia(txt){');
  const iP1 = scriptBody.indexOf('async function savePersonal(){', iP0);
  assert(iP0 !== -1 && iP1 !== -1 && iP1 > iP0, 'no se encontraron las anclas de validarAnosExperiencia/avisoRangoValor');
  const blockP = scriptBody.slice(iP0, iP1);

  // Bloque N: pipeline comercial (tablero Kanban) -- siguienteEtapa/etapaAnterior son puras y
  // fáciles de probar en aislamiento; ETAPAS_PIPELINE es la fuente única del orden de columnas.
  const iN0 = scriptBody.indexOf('const ETAPAS_PIPELINE = [');
  const iN1 = scriptBody.indexOf('function agregarAPipeline(id, item){', iN0);
  assert(iN0 !== -1 && iN1 !== -1 && iN1 > iN0, 'no se encontraron las anclas de ETAPAS_PIPELINE/siguienteEtapa/etapaAnterior');
  const blockN = scriptBody.slice(iN0, iN1);

  const source = blockA + '\n' + blockB + '\n' + blockC + '\n' + blockD + '\n' + blockF + '\n' + blockG +
    '\n' + blockH + '\n' + blockI + '\n' + blockJ + '\n' + blockK + '\n' + blockL + '\n' + blockM + '\n' + blockN + '\n' + blockO + '\n' + blockP +
    '\nreturn { fichaHabilitante, cruceFichaEmpresa, tramosDeSumatoria, unoPctPresupuestoDeTexto, unirItemsDePdf, parsearExcelExperiencia, paginasRelevantesParaIA, paginasCitadasSinVerificar, agruparEnTandas, verificarFilaConTextos, reverificarRequisitosIA, validarAnosExperiencia, avisoRangoValor, cumpleRangoValor, coincideEntidad, cierraEnDias, resumenEjecutivo, siguienteEtapa, etapaAnterior, resumenPipeline, ETAPAS_PIPELINE, migrarEtapa, migrarHistorialEtapas, descripcionVeredicto, claseVeredicto, evaluarExperienciaCompleta, segmentarTextoEnRequisitos, segmentarConOffsets, leerHojaComoFilas, leerHojaPorNombre, leerTodasLasHojasComoFilas, preferirColumnaValorActualizado, leerPrimeraTablaHtml, parsearExperienciaDeFilas, parsearRequisitosDeFilas, valorConfiableDeTexto, construirContratoDesdeTexto, parsearExperienciaDesdeFilasTexto, construirRequisitoDesdeTexto, condicionCuantitativaSinModelar, extraerCantidadConUnidadContable, condicionTemporalDelRequisito, evaluarCondicionTemporal, agruparAlternativos, detectarRedFlags, detectarInconsistenciasInternas, alertasDelPliego, extraerExigencias, calcularViabilidad, rangoViabilidad, paginaDeOffset, REGLAS_RED_FLAG, textoPliegoDe, parsearExperienciasRUP, encabezadoRUP, proponerCruceRup, aplicarCruceRup, claveContratoCruce, reglaConversionSmmlvDePliego, limpiarRepetidosDePagina, localizarSeccionesExperiencia, extraerRequisitosDePliego, detectarInconsistenciasPliegoEP, pareceRequisitoDeExperienciaReal, esRequisitoDePersonal, verificarFilaIA, verificarFilasIA, filaIAaRequisito, requisitosDeExperienciaDesdeIA, exigenciasDesdeIA, hallazgosPersonalDesdeIA, codigosUnspscDesdeIA, textoDePaginaPliego, valorContratoEnSmmlv, evaluarRequisito, consultasSecopII, esEstadoNoVigente, parseValorUnidad, minContratosDeTexto, minValorPesosDeTexto, compararIndiceConUmbral, buscarUmbralCerca, leerIndiceDePerfil, depurarContratos, estadoTemporalDeContrato, detectarConflictosFilasIA, motivoBloqueoFilaIA, filaIAHabilitante, filaIAConfiable, extraerKResidualUmbral, textoKResidualDetectado, leerMontoDePerfil, cifrasCandidatas, generarCartaTexto, generarAnticorrupcionTexto, observacionesTexto, generarParafiscalesTexto, generarFormatoExperienciaTexto, generarPaqueteTexto, hashTexto, registroConfirmacion, heredarConfirmaciones, requiereSegundaConfirmacion, detectarInyeccionEnTexto, gatesCompletitudIA, descuentoComparable, sugerenciaOfertaEconomica, deduplicarAdjudicaciones, armarRespaldo, validarRespaldo, evaluarVersionEsquema, coleccionComoMapa, diferenciasColeccion, armarColeccion, leerColeccionRemota, guardarColeccionRemota, reemplazarColeccionRemota, liberarTextoMasAntiguo, safeHref, extraerCodigosUNSPSC, extraerIndicadoresRUP, parsearRUP, crearCacheTtl, pieFuenteDatos, avisoFuenteDatos, snapshotDeProceso, procesosAnalizadosFueraDeLista, etiquetaVeredicto, lineaMotivoVeredicto, textoCoberturaLectura, prepararBusquedaPorNombre, calcularSCE, saldoDeContrato, participacionDeContrato, capacidadContractualEstimada, experienciaGateDetalle, matrizCapacidad, normHeader, palabrasClaveDe, esTokenNumerico, PALABRAS_GENERICAS_OBRA, gatesCompletitudIA, lecturaParcial, pareceEtiquetaRUT, limitesColumnaRUT, itemsDeCampoRUT, campoTextoRUT, campoNumericoRUT, parsearRUT, aplicarRequisitosIAaEntry, recalcularExpevalActivo, perfilesParaComparar, setExpevalContratos: v => { globalThis.expevalContratos = v; }, setPerfiles: v => { globalThis.perfiles = v; }, setPerfilesActivos: v => { globalThis.perfilesActivos = v; }, setPerfilActivoId: v => { globalThis.perfilActivoId = v; }, setExpevalPorPerfil: v => { globalThis.expevalPorPerfil = v; }, getExpevalContratos: () => globalThis.expevalContratos, getExpevalMeta: () => globalThis.expevalMeta };';
  const fakeWindow = { XLSX: { utils: { sheet_to_json: (sheet) => sheet } } };
  // leerPrimeraTablaHtml usa `new DOMParser()` (API de navegador, no existe
  // en Node) -- un shim mínimo que solo entiende <table><tr><td>/<th> es
  // suficiente para probar la función con el HTML que mammoth.convertToHtml
  // realmente produce, sin instalar jsdom solo para esto. `new Function(...)`
  // resuelve identificadores libres contra el scope GLOBAL (no el léxico de
  // este módulo), así que el shim se cuelga de `globalThis`.
  globalThis.DOMParser = class {
    parseFromString(html) {
      const tableMatch = String(html || '').match(/<table[^>]*>([\s\S]*?)<\/table>/i);
      const tableHtml = tableMatch ? tableMatch[1] : null;
      const celdas = (rowHtml) => [...rowHtml.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(m => ({ textContent: m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ') }));
      const trs = tableHtml
        ? [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => ({ querySelectorAll: () => celdas(m[1]) }))
        : [];
      return { querySelector: (sel) => (sel === 'table' && tableHtml) ? { querySelectorAll: () => trs } : null };
    }
  };
  // evaluarProceso (bloque I) ya no lee DOM ni globales: recibe su contexto (CTX_EVAL, más abajo).
  // aplicarRequisitosIAaEntry (bloque K) lee expevalContratos -- los tests lo ajustan con setExpevalContratos.
  // recalcularExpevalActivo (bloque L) / perfilesParaComparar (bloque M) -- "Experiencia por
  // empresa". migrarPerfil no se extrae (no hace falta probarla aquí): un passthrough alcanza,
  // ya que los fixtures de los tests ya traen la forma final que perfilesParaComparar necesita.
  globalThis.migrarPerfil = p => p;
  globalThis.perfiles = {};
  globalThis.perfilesActivos = [];
  globalThis.perfilActivoId = null;
  globalThis.expevalPorPerfil = {};
  globalThis.expevalMeta = null;
  const factory = new Function('window', source);
  const eng = factory(fakeWindow);
  eng.__window = fakeWindow;
  // El motor del veredicto sale de evaluacion.js, con las mismas piezas que le inyecta index.html.
  Object.assign(eng, Evaluacion.crear({
    fmtMoney: globalThis.fmtMoney, truncate: globalThis.truncate, palabrasClaveDe: eng.palabrasClaveDe,
    PALABRAS_GENERICAS_OBRA: eng.PALABRAS_GENERICAS_OBRA, esTokenNumerico: eng.esTokenNumerico, normHeader: eng.normHeader,
    compararIndiceConUmbral: eng.compararIndiceConUmbral, gatesCompletitudIA: eng.gatesCompletitudIA,
    lecturaParcial: eng.lecturaParcial, experienciaGateDetalle: eng.experienciaGateDetalle, matrizCapacidad: eng.matrizCapacidad, parseNumCO: globalThis.parseNumCO,
    saldoDeContrato: eng.saldoDeContrato, participacionDeContrato: eng.participacionDeContrato
  }));
  return eng;
}
export const expEngine = extractExperienceEngine(); export { Evaluacion, Magnitudes }; export function fakeWorkbook(headers, rows){ return { SheetNames: ["Hoja1"], Sheets: { Hoja1: [headers, ...rows] } }; }
