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
// cambio grande (ver "Cómo probar cambios sin desplegar" en CLAUDE.md).
//
// Uso: node tests/smoke.mjs
// ============================================================================

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
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

console.log('Bitácora SECOP — tests de humo\n');

// 1) El <script> principal es JS sintácticamente válido -------------------
await check('el <script> principal es JS válido (node --check)', () => {
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
await check('todo getElementById(\'...\') referenciado existe como id="..." en el archivo', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const refs = new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
  assert(refs.size > 0, 'no se encontró ningún getElementById(\'...\') -- ¿cambió el patrón de código?');
  const missing = [...refs].filter(id => !ids.has(id));
  assert(missing.length === 0, 'id(s) referenciados por JS que no existen en el archivo: ' + missing.join(', '));
});

// 3) Funciones clave del flujo principal siguen existiendo -----------------
// Guarda de "no rompas lo que ya funciona": si una de estas desaparece o se
// renombra sin actualizar a quien la llama, es casi siempre un error real.
await check('las funciones clave del flujo (experiencia → personal → pliego → resultado) existen', () => {
  const REQUIRED = [
    'escapeHtml', 'mostrarVista', 'runSearch', 'render',
    'estadoFlujoPliego', 'mensajeFlujoFaltante', 'renderFlujoStepper',
    'evaluarProceso', 'evaluarMejor', 'gatePersonalRequerido',
    'resumenCompatibilidad', 'renderCompatibilidadHtml',
    'parsearExcelExperiencia', 'evaluarExperienciaCompleta',
    'loadPdfJs', 'loadTesseractJs', 'loadXlsxLib', 'extractPdfText', 'ocrPdfPages',
    'loadSupabaseJs', 'bootstrapAccountSession', 'openRecoveryPanel', 'handleSetNewPassword',
    'guardarAlertaActual', 'eliminarAlerta', 'evaluarAlerta', 'revisarTodasLasAlertas',
    'verNuevosDeAlerta', 'renderAlertasList', 'renderDashAlertas',
    'descuentoComparable', 'sugerenciaOfertaEconomica', 'renderOfertaSugeridaHtml',
    'prepararBusquedaPorNombre',
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
    'paginaDeOffset', 'detectarRedFlags', 'calcularViabilidad',
    // Requisitos de experiencia extraídos del Pliego/Estudio Previo (ver
    // elegant-wandering-dewdrop.md) -- reemplazan la matriz manual.
    'textoPliegoDe', 'localizarSeccionesExperiencia', 'segmentarConOffsets',
    'extraerRequisitosDePliego', 'detectarInconsistenciasPliegoEP',
    'cargarEstudioPrevioPDF', 'cargarEstudioPrevioDocx', 'cargarEstudioPrevioArchivo',
    'evaluarExperienciaDeProceso',
  ];
  const missing = REQUIRED.filter(fn => !new RegExp('function\\s+' + fn + '\\s*\\(').test(html));
  assert(missing.length === 0, 'función(es) esperadas y no encontradas: ' + missing.join(', '));
});

// 4) Todo host https:// mencionado en el código aparece en la CSP ----------
// No verifica la directiva EXACTA (script-src vs connect-src, etc.), solo
// que el host no esté totalmente ausente de la política -- el olvido más
// común y más dañino es agregar un fetch()/script.src a un dominio nuevo y
// no tocar la CSP en absoluto, lo que rompe esa función en silencio para
// cualquier usuario real (la CSP la bloquea sin que la app muestre un error
// propio, solo un mensaje suelto en la consola del navegador).
await check('todo host https:// usado en el código aparece en la política CSP', () => {
  // Excepción deliberada: hosts que solo aparecen como destino de un <a href>
  // (el usuario navega ahí con un clic -- eso NO está sujeto a script-src/
  // connect-src/etc., ninguna directiva de esta CSP restringe una navegación
  // de nivel superior) o como dato de ejemplo dentro del snapshot embebido.
  // Si alguno de estos pasara a usarse alguna vez en fetch()/script.src, hay
  // que sacarlo de esta lista Y agregarlo a la CSP real -- recién ahí este
  // test dejaría de ignorarlo automáticamente.
  const NAVIGATION_ONLY_HOSTS = new Set([
    'community.secop.gov.co',    // enlaces "Abrir expediente"/"Buscar en SECOP II" + dato de ejemplo urlproceso
    'www.colombiacompra.gov.co', // enlace de respaldo "Buscar en SECOP I"
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

// 5) El SRI de los 5 scripts de terceros sigue coincidiendo con el CDN -----
// Requiere red (GitHub Actions la tiene). Si algún día se sube de versión
// pdf.js/xlsx/Tesseract.js/supabase-js/mammoth.js sin recalcular el hash,
// este test lo detecta ANTES de que un usuario real se quede con esa
// librería sin cargar (la CSP + SRI la bloquean en silencio, ver commit
// que las agregó).
await check('el SRI embebido de pdf.js/xlsx/Tesseract.js/supabase-js/mammoth.js coincide con el archivo real del CDN', async () => {
  const scriptBody = extractMainScript();
  const pairs = [...scriptBody.matchAll(
    /\.src\s*=\s*'(https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^']+)';[\s\S]*?\.integrity\s*=\s*'(sha384-[^']+)';/g
  )].map(m => ({ url: m[1], integrity: m[2] }));
  assert(pairs.length === 5, 'se esperaban 5 scripts CDN con integrity (pdf.js, xlsx, Tesseract.js, supabase-js, mammoth.js), se encontraron ' + pairs.length);
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

  const startB = 'function parseNumCO(s){';
  const endB = 'function extraerExigencias(text){';
  const iB0 = scriptBody.indexOf(startB);
  const iB1 = scriptBody.indexOf(endB, iB0);
  assert(iB0 !== -1 && iB1 !== -1 && iB1 > iB0,
    'no se encontraron las anclas del bloque parseNumCO..parseValorUnidad -- ¿se movió o renombró algo?');
  const blockB = scriptBody.slice(iB0, iB1);

  const source = blockA + '\n' + blockB +
    '\nreturn { parsearExcelExperiencia, evaluarExperienciaCompleta, segmentarTextoEnRequisitos, segmentarConOffsets, leerHojaComoFilas, leerPrimeraTablaHtml, parsearExperienciaDeFilas, parsearRequisitosDeFilas, valorConfiableDeTexto, construirContratoDesdeTexto, parsearExperienciaDesdeFilasTexto, construirRequisitoDesdeTexto, condicionCuantitativaSinModelar, extraerCantidadConUnidadContable, condicionTemporalDelRequisito, evaluarCondicionTemporal, agruparAlternativos, detectarRedFlags, calcularViabilidad, paginaDeOffset, REGLAS_RED_FLAG, textoPliegoDe, localizarSeccionesExperiencia, extraerRequisitosDePliego, detectarInconsistenciasPliegoEP };';
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
  const factory = new Function('window', source);
  return factory(fakeWindow);
}

// headers + filas -> "workbook" falso con la misma forma que espera
// leerHojaComoFilas (workbook.SheetNames[0], workbook.Sheets[nombre]), donde
// la "hoja" ya es el array de filas que sheet_to_json({header:1}) devolvería.
function fakeWorkbook(headers, rows) {
  return { SheetNames: ['Hoja1'], Sheets: { Hoja1: [headers, ...rows] } };
}

let expEngine = null;

await check('motor de "Evaluación de experiencia": se extrae y ejecuta en aislamiento (sin DOM)', () => {
  expEngine = extractExperienceEngine();
  assert(typeof expEngine.parsearExcelExperiencia === 'function', 'parsearExcelExperiencia no quedó expuesta');
  assert(typeof expEngine.parsearRequisitosDeFilas === 'function', 'parsearRequisitosDeFilas no quedó expuesta');
  assert(typeof expEngine.evaluarExperienciaCompleta === 'function', 'evaluarExperienciaCompleta no quedó expuesta');
  assert(typeof expEngine.extraerRequisitosDePliego === 'function', 'extraerRequisitosDePliego no quedó expuesta');
});

// parsearMatrizExperiencia (la matriz manual, eliminada -- ver
// elegant-wandering-dewdrop.md) era solo parsearRequisitosDeFilas(
// leerHojaComoFilas(workbook)) -- se compone igual acá para seguir
// probando evaluarExperienciaCompleta/evaluarRequisito/agruparAlternativos
// (motor SIN CAMBIOS) con fixtures tipo Excel, sin depender de la función
// eliminada.
function evaluar(matrizHeaders, matrizRows, expHeaders, expRows, hoy) {
  assert(expEngine, 'el motor no se pudo extraer (ver check anterior) -- no se puede continuar con este caso');
  const contratos = expEngine.parsearExcelExperiencia(fakeWorkbook(expHeaders, expRows));
  const requisitos = expEngine.parsearRequisitosDeFilas(expEngine.leerHojaComoFilas(fakeWorkbook(matrizHeaders, matrizRows)));
  return Object.assign({ contratos, requisitos }, expEngine.evaluarExperienciaCompleta(contratos.contratos, requisitos.requisitos, hoy));
}

await check('Caso 1 (cumple todos los requisitos obligatorios) -> CUMPLE', () => {
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [['Experiencia específica en construcción de puentes vehiculares', '1', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía de Cúcuta', '500000000']]
  );
  assert(ev.resultados[0].resultado === 'CUMPLE', 'se esperaba CUMPLE, fue ' + ev.resultados[0].resultado);
  assert(ev.resultadoGlobal === 'CUMPLE', 'resultado global: se esperaba CUMPLE, fue ' + ev.resultadoGlobal);
});

await check('Caso 2 (no cumple un requisito obligatorio) -> NO CUMPLE', () => {
  // Solo 1 contrato relevante encontrado, la matriz exige mínimo 2 -- hay
  // coincidencia de objeto (por eso NO es NO DETERMINABLE) pero no alcanza el
  // mínimo numérico exigido.
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [['Experiencia específica en pavimentación de vías urbanas', '2', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Pavimentación de vías urbanas en el municipio de Los Patios', 'Alcaldía de Los Patios', '300000000']]
  );
  assert(ev.resultados[0].resultado === 'NO CUMPLE', 'se esperaba NO CUMPLE, fue ' + ev.resultados[0].resultado);
  assert(ev.resultadoGlobal === 'NO CUMPLE', 'resultado global: se esperaba NO CUMPLE, fue ' + ev.resultadoGlobal);
});

await check('Caso 3 (información insuficiente, sin ningún contrato relacionado) -> NO DETERMINABLE', () => {
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [['Experiencia específica en construcción de plantas de tratamiento de aguas residuales', '1', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Suministro de mobiliario escolar para instituciones educativas', 'Secretaría de Educación', '80000000']]
  );
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE, fue ' + ev.resultados[0].resultado);
  // La regla más importante del prompt maestro (sección 6): NO DETERMINABLE
  // nunca debe convertirse en NO CUMPLE por sí solo.
  assert(ev.resultadoGlobal !== 'NO CUMPLE', 'un único requisito NO DETERMINABLE no debería arrastrar el global a NO CUMPLE, fue ' + ev.resultadoGlobal);
});

await check('Caso 4 (información ambigua -- ejemplo textual de la sección 13 del prompt maestro) -> NO DETERMINABLE', () => {
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [['Experiencia específica en construcción de puentes peatonales', '1', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción y adecuación de infraestructura municipal', 'Alcaldía de Cúcuta', '200000000']]
  );
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE, fue ' + ev.resultados[0].resultado);
  assert(/gen[ée]ric/i.test(ev.resultados[0].justificacion), 'la justificación debería explicar la ambigüedad (solo palabras genéricas compartidas), fue: ' + ev.resultados[0].justificacion);
});

await check('Caso 5 (varios contratos que conjuntamente acreditan experiencia, acumulable) -> CUMPLE', () => {
  const ev = evaluar(
    ['Requisito', 'Valor mínimo', 'Acumulable', 'Obligatoriedad'],
    [['Experiencia específica en interventoría de obras de acueducto', '1000', 'Sí, acumulable', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [
      ['Interventoría de obras de acueducto rural fase 1', 'Empresa de Acueducto', '600'],
      ['Interventoría de obras de acueducto urbano fase 2', 'Empresa de Acueducto', '700'],
    ]
  );
  // Ningún contrato individual llega a 1000 (600 y 700) -- solo la SUMA
  // (1300) alcanza el mínimo. Si el motor comparara por mejor valor
  // individual en vez de sumar, este caso fallaría.
  assert(ev.resultados[0].resultado === 'CUMPLE', 'se esperaba CUMPLE (por acumulación), fue ' + ev.resultados[0].resultado);
});

await check('Caso 6 (palabra clave genérica compartida pero el contrato NO satisface el requisito) -> NO DETERMINABLE, nunca CUMPLE', () => {
  // Mismo ejemplo de la sección 12 del prompt maestro: "construcción" solo no
  // basta para que "construcción de un edificio administrativo" cumpla
  // "construcción de vías terciarias".
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [['Experiencia específica en construcción de vías terciarias', '1', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de un edificio administrativo municipal', 'Alcaldía', '150000000']]
  );
  assert(ev.resultados[0].resultado !== 'CUMPLE', 'un falso positivo por palabra genérica NUNCA debe marcar CUMPLE, fue ' + ev.resultados[0].resultado);
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE, fue ' + ev.resultados[0].resultado);
});

await check('Caso 7 (Excel con columnas/encabezados distintos a los habituales) -> las columnas igual se detectan y evalúan bien', () => {
  const contratos = expEngine.parsearExcelExperiencia(fakeWorkbook(
    ['Descripción del contrato', 'Entidad', 'Valor ejecutado', 'Fecha de inicio', 'Fecha de terminación'],
    [['Mantenimiento de redes de alcantarillado sanitario y pluvial', 'EMPAS S.A. E.S.P.', '420000000', '01/03/2022', '15/11/2022']]
  ));
  const requisitos = expEngine.parsearRequisitosDeFilas(expEngine.leerHojaComoFilas(fakeWorkbook(
    ['Descripción del requisito', 'Cantidad mínima de contratos', 'Caracter'],
    [['Experiencia específica en mantenimiento de redes de alcantarillado', '1', 'Obligatorio']]
  )));
  assert(contratos.cols.objeto != null, '"Descripción del contrato" no se reconoció como columna de objeto');
  assert(contratos.cols.contratante != null, '"Entidad" no se reconoció como columna de contratante');
  assert(contratos.cols.valor != null, '"Valor ejecutado" no se reconoció como columna de valor');
  assert(requisitos.cols.criterio != null, '"Descripción del requisito" no se reconoció como columna de criterio');
  assert(requisitos.cols.minContratos != null, '"Cantidad mínima de contratos" no se reconoció como columna de mínimo de contratos');
  assert(requisitos.cols.obligatoriedad != null, '"Caracter" no se reconoció como columna de obligatoriedad');
  const ev = expEngine.evaluarExperienciaCompleta(contratos.contratos, requisitos.requisitos);
  assert(ev.resultadoGlobal === 'CUMPLE', 'con columnas reconocidas correctamente se esperaba CUMPLE, fue ' + ev.resultadoGlobal);
});

await check('Caso 8 (la matriz trae varios requisitos de experiencia específica, con distinta obligatoriedad) -> el global solo lo deciden los obligatorios', () => {
  const ev = evaluar(
    ['Requisito', 'Número mínimo de contratos', 'Obligatoriedad'],
    [
      ['Experiencia específica en construcción de escuelas', '1', 'Obligatorio'],
      ['Experiencia específica en construcción de puestos de salud', '1', 'Opcional'],
      ['Experiencia específica en construcción de parques recreativos', '1', 'Complementario'],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de escuelas rurales en el corregimiento', 'Alcaldía', '250000000']]
  );
  assert(ev.resultados.length === 3, 'se esperaban 3 requisitos evaluados, fueron ' + ev.resultados.length);
  assert(ev.totalObligatorios === 1, 'se esperaba 1 requisito obligatorio, fueron ' + ev.totalObligatorios);
  assert(ev.conteo['CUMPLE'] === 1, 'se esperaba 1 CUMPLE (escuelas), fueron ' + ev.conteo['CUMPLE']);
  assert(ev.conteo['NO DETERMINABLE'] === 2, 'se esperaban 2 NO DETERMINABLE (puestos de salud y parques, sin contrato relacionado), fueron ' + ev.conteo['NO DETERMINABLE']);
  // El único obligatorio (escuelas) CUMPLE -- los opcionales/complementarios
  // NO DETERMINABLE no deben arrastrar el resultado global.
  assert(ev.resultadoGlobal === 'CUMPLE', 'el global debería depender solo del obligatorio (CUMPLE), fue ' + ev.resultadoGlobal);
});

// 15-19) Matriz de experiencia cargada en PDF (texto libre, sin columnas) --
// pedido del usuario: "hay veces en que la cargan en pdf y no en excel".
// segmentarTextoEnRequisitos() es un heurístico de formato de lista (corta
// antes de "1.", "a)", "•", etc. seguido de mayúscula), no NLP real -- estos
// tests cubren tanto el camino feliz como las dos trampas reales que ya se
// encontraron escribiéndolo (ver commit): el título del documento colándose
// como falso requisito, y una referencia numérica dentro de una oración
// ("numeral 4 del pliego") partiendo donde no debía.
await check('PDF de matriz: lista numerada -> mismos campos que produciría el Excel equivalente', () => {
  const texto = '1. Experiencia específica en construcción de puentes vehiculares, mínimo 1 contrato, obligatorio. ' +
    '2. Experiencia específica en pavimentación de vías urbanas, mínimo 2 contratos, obligatorio.';
  // parsearMatrizExperienciaPDF (eliminada, ver elegant-wandering-dewdrop.md)
  // era solo segmentarTextoEnRequisitos + construirRequisitoDesdeTexto por
  // trozo -- se compone igual acá, el heurístico de segmentación sigue
  // siendo el mismo (MARCADOR_REQUISITO_LISTA, compartido con
  // segmentarConOffsets, ver los tests de extraerRequisitosDePliego).
  const chunks = expEngine.segmentarTextoEnRequisitos(texto);
  const parsed = { requisitos: chunks.map((c, i) => expEngine.construirRequisitoDesdeTexto(c, i, {})).filter(r => r.criterio) };
  assert(parsed.requisitos.length === 2, 'se esperaban 2 requisitos, fueron ' + parsed.requisitos.length);
  assert(parsed.requisitos[0].minContratos === 1, 'requisito 1: se esperaba minContratos=1, fue ' + parsed.requisitos[0].minContratos);
  assert(parsed.requisitos[1].minContratos === 2, 'requisito 2: se esperaba minContratos=2, fue ' + parsed.requisitos[1].minContratos);
  assert(parsed.requisitos[0].obligatoriedad === 'obligatorio', 'se esperaba obligatoriedad "obligatorio"');
});

await check('PDF de matriz: el título del documento antes del primer ítem NO se cuela como requisito', () => {
  const texto = 'MATRIZ DE REQUISITOS DE EXPERIENCIA DEL PROCESO XYZ-2026. ' +
    '1. Experiencia general en construcción de obras civiles, mínimo 3 contratos. ' +
    '2. Experiencia específica en alcantarillado, mínimo 1 contrato.';
  const chunks = expEngine.segmentarTextoEnRequisitos(texto);
  assert(chunks.length === 2, 'se esperaban 2 trozos (sin el título), fueron ' + chunks.length + ': ' + JSON.stringify(chunks));
  assert(!/MATRIZ DE REQUISITOS/.test(chunks[0]), 'el título del documento no debería aparecer como un requisito');
});

await check('PDF de matriz: una referencia numérica dentro de una oración no parte el texto', () => {
  const texto = '1. Experiencia general: mínimo 3 contratos según el numeral 4 del pliego, valor 1.200.000.000. ' +
    '2. Experiencia específica en vías terciarias, mínimo 1 contrato.';
  const chunks = expEngine.segmentarTextoEnRequisitos(texto);
  assert(chunks.length === 2, 'se esperaban 2 trozos (el "numeral 4" no debería partir nada), fueron ' + chunks.length + ': ' + JSON.stringify(chunks));
});

await check('PDF de matriz: viñetas y letras también se reconocen como marcadores de lista', () => {
  const conVinetas = expEngine.segmentarTextoEnRequisitos('• Experiencia general en obra civil, mínimo 2 contratos. • Experiencia específica en acueducto, mínimo 1 contrato.');
  assert(conVinetas.length === 2, 'viñetas: se esperaban 2 trozos, fueron ' + conVinetas.length);
  const conLetras = expEngine.segmentarTextoEnRequisitos('Requisitos: a) Experiencia general en obra civil, mínimo 3 contratos. b) Experiencia específica en vías, valor mínimo 1.000.000.000.');
  assert(conLetras.length === 2, 'letras: se esperaban 2 trozos, fueron ' + conLetras.length);
});

await check('PDF de matriz: sin ningún formato de lista reconocible -> el texto completo se devuelve como un solo trozo (no se inventa una segmentación)', () => {
  const texto = 'Este documento describe en prosa larga los requisitos de experiencia general y específica sin usar ninguna lista numerada, con letras ni viñetas en todo el párrafo.';
  const chunks = expEngine.segmentarTextoEnRequisitos(texto);
  assert(chunks.length === 1, 'se esperaba 1 solo trozo (todo el texto), fueron ' + chunks.length);
});

// 20) Bug real reportado por el usuario con un PDF real vía OCR: un criterio
// largo/ruidoso (el OCR mete palabras rotas de vez en cuando, ej.
// "hnotecion", "acredraren") generaba una justificación con DECENAS de
// palabras listadas sin límite -- una pared de texto casi ilegible en vez
// de una explicación corta. listaAcotada() debe cortarla.
await check('Justificación de NO DETERMINABLE con un criterio largo/ruidoso (típico de OCR) queda acotada, no es una pared de texto', () => {
  const palabrasRuidosas = ['recreodeportiva', 'cultural', 'educativa', 'cuantias', 'procedimiento',
    'contratacion', 'actividades', 'ampliacion', 'reconstruccion', 'conservacion', 'intervencion',
    'instalacion', 'modificacion', 'optimizacion', 'rehabilitacion', 'remodelacion', 'reposicion',
    'reparacion', 'locativa', 'restauracion', 'restitucion', 'terminacion', 'reforzamiento',
    'hnotecion', 'pomitiruccion', 'acredraren', 'cnatas', 'tenticito', 'neoraneento'];
  const criterioLargo = 'Obras en infraestructura ' + palabrasRuidosas.join(' ') + ' del proceso.';
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [[criterioLargo, 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de infraestructura vial urbana', 'Alcaldía', '100000000']] // comparte "infraestructura" (genérica) pero ninguna palabra distintiva del requisito
  );
  const just = ev.resultados[0].justificacion;
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE, fue ' + ev.resultados[0].resultado);
  const palabrasEnJustificacion = (just.match(/,/g) || []).length + 1;
  assert(palabrasEnJustificacion <= 13, 'la justificación no debería listar más de ~12 palabras sueltas, tiene aprox ' + palabrasEnJustificacion + ': ' + just);
  assert(/y \d+ más/.test(just), 'con 28 palabras ruidosas se esperaba el sufijo "y N más" recortando la lista, justificación: ' + just);
});

// 22-29) Word (.docx) y PDF/texto libre también para "Experiencia del
// proponente" -- pedido del usuario. A diferencia de la matriz, un
// contrato tiene MUCHOS campos (objeto, contratante, valor, 2 fechas,
// duración, cantidad...) -- de texto libre solo se extraen con confianza
// el objeto (el texto completo) y, con señal fuerte, valor y fechas; el
// resto queda null a propósito en vez de adivinado.
await check('leerPrimeraTablaHtml: extrae headers+rows de una tabla HTML (lo que produce mammoth.convertToHtml de un .docx)', () => {
  const html = '<p>Matriz de requisitos</p><table><tr><td>Requisito</td><td>Obligatoriedad</td></tr>' +
    '<tr><td>Experiencia específica en construcción de puentes</td><td>Obligatorio</td></tr>' +
    '<tr><td>Experiencia específica en pavimentación</td><td>Opcional</td></tr></table>';
  const tabla = expEngine.leerPrimeraTablaHtml(html);
  assert(tabla.headers.length === 2, 'se esperaban 2 encabezados, fueron ' + tabla.headers.length);
  assert(tabla.headers[0] === 'Requisito', 'encabezado 0 esperado "Requisito", fue "' + tabla.headers[0] + '"');
  assert(tabla.rows.length === 2, 'se esperaban 2 filas de datos, fueron ' + tabla.rows.length);
  assert(tabla.rows[0][0] === 'Experiencia específica en construcción de puentes', 'fila 0 no coincide: ' + tabla.rows[0][0]);
});

await check('leerPrimeraTablaHtml: sin ninguna tabla en el HTML (documento de texto corrido) devuelve headers/rows vacíos, no inventa una tabla', () => {
  const html = '<p>Este documento no tiene ninguna tabla, solo párrafos.</p><p>Otro párrafo más.</p>';
  const tabla = expEngine.leerPrimeraTablaHtml(html);
  assert(tabla.headers.length === 0 && tabla.rows.length === 0, 'se esperaban headers/rows vacíos sin tabla en el HTML');
});

await check('Tabla de un .docx (vía leerPrimeraTablaHtml) evaluada como matriz -> mismo resultado que el Excel equivalente', () => {
  const tabla = expEngine.leerPrimeraTablaHtml(
    '<table><tr><td>Requisito</td><td>Número mínimo de contratos</td><td>Obligatoriedad</td></tr>' +
    '<tr><td>Experiencia específica en construcción de puentes vehiculares</td><td>1</td><td>Obligatorio</td></tr></table>'
  );
  const requisitos = expEngine.parsearRequisitosDeFilas(tabla);
  assert(requisitos.requisitos.length === 1, 'se esperaba 1 requisito, fueron ' + requisitos.requisitos.length);
  assert(requisitos.requisitos[0].minContratos === 1, 'se esperaba minContratos=1, fue ' + requisitos.requisitos[0].minContratos);
});

await check('valorConfiableDeTexto: un número agrupado en miles (formato colombiano) SÍ se extrae como valor', () => {
  const v = expEngine.valorConfiableDeTexto('Construcción de un puente, valor total 1.200.000.000 pesos');
  assert(v && v.valor === 1200000000, 'se esperaba 1200000000, fue ' + (v && v.valor));
});

await check('valorConfiableDeTexto: un número SIN señal de dinero (ej. un número de contrato/expediente) NO se extrae -- mejor null que un valor inventado', () => {
  const v = expEngine.valorConfiableDeTexto('Contrato No. 2024001234 suscrito con la Alcaldía en el año 2024');
  assert(v === null, 'un número de contrato/año no debería interpretarse como un valor en pesos, se obtuvo: ' + JSON.stringify(v));
});

await check('valorConfiableDeTexto: con símbolo "$" explícito SÍ se extrae aunque el número sea corto', () => {
  const v = expEngine.valorConfiableDeTexto('Contrato por $500000 mensuales');
  assert(v && v.valor === 500000, 'se esperaba 500000, fue ' + (v && v.valor));
});

await check('construirContratoDesdeTexto: extrae objeto/valor/fechas con confianza, deja el resto en null en vez de inventarlo', () => {
  const c = expEngine.construirContratoDesdeTexto(
    'Construcción de puentes vehiculares sobre el río Pamplonita, valor 1.500.000.000, del 01/03/2020 al 15/12/2021', 0
  );
  assert(c.objeto.includes('Construcción de puentes'), 'objeto debería conservar el texto completo');
  assert(c.valor === 1500000000, 'se esperaba valor 1500000000, fue ' + c.valor);
  assert(c.fechaInicio === '2020-03-01', 'se esperaba fechaInicio 2020-03-01, fue ' + c.fechaInicio);
  assert(c.fechaFin === '2021-12-15', 'se esperaba fechaFin 2021-12-15, fue ' + c.fechaFin);
  assert(c.contratante === null && c.duracion === null && c.cantidad === null, 'contratante/duración/cantidad deberían quedar null -- no hay señal confiable para inventarlos de texto libre');
});

await check('Experiencia del proponente de texto libre (PDF/Word sin tabla) evaluada contra un requisito -> CUMPLE con evidencia real', () => {
  const filas = [
    'Construcción de puentes vehiculares sobre el río Pamplonita, valor 1.500.000.000, del 01/03/2020 al 15/12/2021',
    'Interventoría de obras de acueducto rural, valor 300.000.000'
  ];
  const experiencia = expEngine.parsearExperienciaDesdeFilasTexto(filas, 'pdf');
  assert(experiencia.contratos.length === 2, 'se esperaban 2 contratos, fueron ' + experiencia.contratos.length);
  const requisito = expEngine.construirRequisitoDesdeTexto('Experiencia específica en construcción de puentes vehiculares, mínimo 1 contrato, obligatorio.', 0, {});
  const ev = expEngine.evaluarExperienciaCompleta(experiencia.contratos, [requisito]);
  assert(ev.resultadoGlobal === 'CUMPLE', 'se esperaba CUMPLE evaluando contratos de texto libre contra un requisito, fue ' + ev.resultadoGlobal);
});

// 30-31) Auditoría "PREOCUPACIÓN CRÍTICA — MÉTODO DE ANÁLISIS DE
// CUMPLIMIENTO DE EXPERIENCIA" (ver elegant-wandering-dewdrop.md): dos
// riesgos de falso positivo CONFIRMADOS contra el código real antes del
// fix (no hipotéticos) -- quedan como regresión permanente para que
// nunca vuelvan a colarse.
await check('Riesgo A de la auditoría: "vías urbanas" vs "vías rurales" comparte 1 de 2 palabras distintivas -> NO DETERMINABLE, nunca CUMPLE automático', () => {
  // Antes del fix: bastaba compartir "vias" (1 de 2 palabras distintivas)
  // para marcar el contrato "relevante" y, sin un valor/cantidad mínima
  // explícito en el requisito, el resultado era CUMPLE automático -- sin
  // que el sistema notara que "urbanas" vs "rurales" es justo la
  // condición que decide si aplica.
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [['Experiencia en construcción de vías urbanas', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de vías rurales en el corregimiento', 'Alcaldía', '900000000']]
  );
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE (coincidencia parcial -- nunca debe auto-CUMPLIR), fue ' + ev.resultados[0].resultado);
  assert(/urbanas/i.test(ev.resultados[0].justificacion), 'la justificación debería nombrar la palabra distintiva que faltó ("urbanas"), fue: ' + ev.resultados[0].justificacion);
});

await check('Riesgo B de la auditoría: condición cuantitativa NO modelada ("50 metros") bloquea el CUMPLE automático aunque haya coincidencia total de palabras', () => {
  // Antes del fix: "longitud mínima de 50 metros" no encajaba en ningún
  // regex (minContratos/minValor/minCantidad), así que desaparecía en
  // silencio -- con coincidencia total de palabras y sin ningún criterio
  // numérico modelado, el resultado era CUMPLE automático sin haber
  // verificado la longitud en absoluto. El contrato de abajo comparte
  // TODAS las palabras distintivas a propósito (puentes/longitud/metros)
  // para probar específicamente el bloqueo de condicionNoVerificable, no
  // solo una coincidencia parcial accidental.
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [['Experiencia en construcción de puentes con una longitud mínima de 50 metros', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes de longitud de 20 metros en zona rural', 'Alcaldía', '500000000']]
  );
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE (condición de longitud no verificable -- nunca CUMPLE automático), fue ' + ev.resultados[0].resultado);
  assert(/50 metros/i.test(ev.resultados[0].justificacion), 'la justificación debería citar la condición sin verificar ("50 metros"), fue: ' + ev.resultados[0].justificacion);
});

await check('condicionCuantitativaSinModelar: detecta unidades DIMENSIONALES (metros, m2, toneladas...) que no tienen campo estructurado equivalente en el contrato', () => {
  assert(expEngine.condicionCuantitativaSinModelar('longitud mínima de 50 metros') === '50 metros', 'debería detectar "50 metros"');
  assert(expEngine.condicionCuantitativaSinModelar('área mínima de 500 m2') !== null, 'debería detectar un área en m2');
  assert(expEngine.condicionCuantitativaSinModelar('mínimo 3 contratos') === null, 'no debería disparar con una condición ya modelada (contratos)');
});

await check('extraerCantidadConUnidadContable: unidades CONTABLES (viviendas, unidades, aulas...) SÍ se extraen como minCantidad verificable -- no todo número+unidad queda sin modelar', () => {
  const v = expEngine.extraerCantidadConUnidadContable('cantidad mínima de 200 viviendas');
  assert(v && v.valor === 200, 'se esperaba minCantidad=200 (viviendas SÍ es una unidad contable, comparable contra el campo "cantidad" del contrato), fue ' + JSON.stringify(v));
});

await check('Un requisito con condición contable legítima (no dimensional) sigue evaluándose normalmente, no se bloquea de más', () => {
  const r = expEngine.construirRequisitoDesdeTexto('Experiencia en construcción de vivienda, mínimo 100 unidades', 0, {});
  assert(r.minCantidad && r.minCantidad.valor === 100, 'se esperaba minCantidad=100 extraído del texto, fue ' + JSON.stringify(r.minCantidad));
  assert(r.condicionNoVerificable === null, 'una unidad contable (unidades/viviendas) no debería marcarse como condición sin verificar, fue: ' + r.condicionNoVerificable);
});

// 34-38) Validación de fechas del requisito ("Ataca la validación de
// fechas del requisito", pedido explícito del usuario -- estaba
// documentado como pendiente en la auditoría crítica del motor,
// elegant-wandering-dewdrop.md, "Fuera de alcance de esta pasada").
await check('condicionTemporalDelRequisito: extrae "últimos N años" en sus formas usuales (dígito entre paréntesis, dígito suelto, en letras) y no dispara con años sueltos', () => {
  const a = expEngine.condicionTemporalDelRequisito('Experiencia adquirida dentro de los últimos diez (10) años, contados desde la fecha de cierre.');
  assert(a && a.anios === 10, 'se esperaba anios=10 (forma "diez (10)"), fue ' + JSON.stringify(a));
  const b = expEngine.condicionTemporalDelRequisito('Experiencia certificada en los últimos 5 años.');
  assert(b && b.anios === 5, 'se esperaba anios=5 (forma dígito suelto), fue ' + JSON.stringify(b));
  const c = expEngine.condicionTemporalDelRequisito('Se exige experiencia dentro de los últimos quince años.');
  assert(c && c.anios === 15, 'se esperaba anios=15 (forma en letras sin dígito), fue ' + JSON.stringify(c));
  const d = expEngine.condicionTemporalDelRequisito('Se exige un director de obra con mínimo 5 años de experiencia.');
  assert(d === null, '"5 años" SIN la palabra "últimos" (años de experiencia de una persona, no ventana de recencia del contrato) no debería disparar, fue: ' + JSON.stringify(d));
  const e = expEngine.condicionTemporalDelRequisito('Experiencia en construcción de vías urbanas.');
  assert(e === null, 'un requisito sin ninguna condición temporal debería devolver null, fue: ' + JSON.stringify(e));
});

await check('"últimos"/"años" no contaminan palabrasDistintivas (mismo bug que "experiencia"/"obligatorio" ya corregido antes -- un contrato real nunca los usa en su objeto)', () => {
  const r = expEngine.construirRequisitoDesdeTexto('Experiencia específica en construcción de vías urbanas dentro de los últimos diez (10) años', 0, {});
  assert(r.condicionTemporal && r.condicionTemporal.anios === 10, 'se esperaba condicionTemporal.anios=10, fue ' + JSON.stringify(r.condicionTemporal));
  assert(!r.palabrasDistintivas.includes('ultimos') && !r.palabrasDistintivas.includes('anos'),
    '"ultimos"/"anos" no deberían quedar como palabras distintivas, fueron: ' + r.palabrasDistintivas.join(', '));
});

await check('Condición temporal: un contrato con fecha de terminación DENTRO de la ventana exigida no bloquea el CUMPLE', () => {
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [['Experiencia en construcción de vías urbanas dentro de los últimos diez (10) años', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Fecha de terminación'],
    [['Construcción de vías urbanas en el municipio', 'Alcaldía', '15/03/2023']],
    new Date('2024-06-01T00:00:00')
  );
  assert(ev.resultados[0].resultado === 'CUMPLE', 'se esperaba CUMPLE (fecha de terminación 2023 está dentro de los últimos 10 años contados desde 2024), fue ' + ev.resultados[0].resultado + ' -- ' + ev.resultados[0].justificacion);
});

await check('Condición temporal: un contrato con fecha de terminación FUERA de la ventana exigida degrada a NO CUMPLE (evidencia real, no solo "falta verificar")', () => {
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [['Experiencia en construcción de vías urbanas dentro de los últimos diez (10) años', 'Obligatorio']],
    ['Objeto', 'Contratante', 'Fecha de terminación'],
    [['Construcción de vías urbanas en el municipio', 'Alcaldía', '15/03/2005']],
    new Date('2024-06-01T00:00:00')
  );
  assert(ev.resultados[0].resultado === 'NO CUMPLE', 'se esperaba NO CUMPLE (fecha de terminación 2005 quedó fuera de los últimos 10 años contados desde 2024), fue ' + ev.resultados[0].resultado + ' -- ' + ev.resultados[0].justificacion);
  assert(/[uú]ltimos diez \(10\) a[ñn]os/i.test(ev.resultados[0].justificacion), 'la justificación debería citar la condición temporal exigida, fue: ' + ev.resultados[0].justificacion);
});

await check('Condición temporal: un contrato SIN ninguna fecha reconocida queda NO DETERMINABLE (nunca se inventa que cae dentro de la ventana)', () => {
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [['Experiencia en construcción de vías urbanas dentro de los últimos diez (10) años', 'Obligatorio']],
    ['Objeto', 'Contratante'],
    [['Construcción de vías urbanas en el municipio', 'Alcaldía']],
    new Date('2024-06-01T00:00:00')
  );
  assert(ev.resultados[0].resultado === 'NO DETERMINABLE', 'se esperaba NO DETERMINABLE (sin fecha, no se puede confirmar ni descartar la ventana), fue ' + ev.resultados[0].resultado + ' -- ' + ev.resultados[0].justificacion);
});

// 39-43) Requisitos alternativos (OR entre varios) -- limitación pendiente
// desde la auditoría crítica, atacada a pedido explícito del usuario. Dos
// señales de agrupamiento (columna "Grupo" explícita, o racha de filas
// consecutivas ya clasificadas "alternativo"), nunca una tercera inventada.
await check('Grupo alternativo por columna explícita: si UN miembro CUMPLE, el grupo CUMPLE y arrastra el resultado global (sin necesitar ningún "obligatorio" aparte)', () => {
  const ev = evaluar(
    ['Requisito', 'Grupo'],
    [
      ['Experiencia específica en construcción de puentes vehiculares', 'Grupo 1'],
      ['Experiencia específica en construcción de vías urbanas', 'Grupo 1'],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía', '500000000']]
  );
  assert(ev.resultados[0].resultado === 'CUMPLE', 'el primer miembro (puentes) debería CUMPLIR individualmente, fue ' + ev.resultados[0].resultado);
  assert(ev.resultados[1].resultado === 'NO DETERMINABLE', 'el segundo miembro (vías urbanas, sin contrato relacionado) debería quedar NO DETERMINABLE, fue ' + ev.resultados[1].resultado);
  assert(ev.grupos.length === 1, 'se esperaba 1 grupo detectado por columna, fueron ' + ev.grupos.length);
  assert(ev.grupos[0].resultado === 'CUMPLE', 'el grupo debería CUMPLIR (basta con que UN miembro cumpla), fue ' + ev.grupos[0].resultado);
  assert(ev.resultadoGlobal === 'CUMPLE', 'el grupo es el único "obligatorio-equivalente" de la matriz -- el global debería depender de él, fue ' + ev.resultadoGlobal);
});

await check('Grupo alternativo por columna explícita: si TODOS los miembros dan NO CUMPLE, el grupo es NO CUMPLE (evidencia real, no "falta verificar")', () => {
  const ev = evaluar(
    ['Requisito', 'Grupo', 'Número mínimo de contratos'],
    [
      ['Experiencia específica en construcción de puentes vehiculares', 'Grupo 2', '2'],
      ['Experiencia específica en construcción de vías urbanas', 'Grupo 2', '2'],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [
      ['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía', '500000000'],
      ['Construcción de vías urbanas en el municipio de Los Patios', 'Alcaldía', '300000000'],
    ]
  );
  assert(ev.resultados[0].resultado === 'NO CUMPLE' && ev.resultados[1].resultado === 'NO CUMPLE', 'ambos miembros deberían dar NO CUMPLE (1 contrato relevante, exige 2), fueron ' + ev.resultados.map(r => r.resultado).join(', '));
  assert(ev.grupos[0].resultado === 'NO CUMPLE', 'el grupo debería ser NO CUMPLE (todos sus miembros lo son), fue ' + ev.grupos[0].resultado);
  assert(ev.resultadoGlobal === 'NO CUMPLE', 'se esperaba NO CUMPLE global, fue ' + ev.resultadoGlobal);
});

await check('Una fila con columna "Grupo" no se cuenta DOS veces hacia el global (una vez sola y otra vez dentro de su grupo)', () => {
  // Sin la exclusión `&& !r.requisito.grupo` en evaluarExperienciaCompleta,
  // esta fila (obligatoriedad por defecto = "obligatorio", su propio texto
  // no dice "alternativo") quedaría en `obligatorios` Y en un grupo a la
  // vez -- doble conteo hacia el resultado global.
  const ev = evaluar(
    ['Requisito', 'Grupo'],
    [
      ['Experiencia específica en construcción de puentes vehiculares', 'Grupo 3'],
      ['Experiencia específica en construcción de vías urbanas', 'Grupo 3'],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía', '500000000']]
  );
  assert(ev.totalObligatorios === 0, 'ninguna fila agrupada debería contarse individualmente como "obligatorio", fue ' + ev.totalObligatorios);
});

await check('Racha de "alternativo" consecutivos (sin columna "Grupo"): 2 o más filas seguidas forman un grupo automático', () => {
  // headers con 2 columnas a propósito: leerHojaComoFilas exige >=2 celdas
  // no vacías en la fila de encabezados para reconocerla como tal -- una
  // sola columna ("Requisito") no basta y la matriz saldría vacía.
  const ev = evaluar(
    ['Requisito', 'Tipo'],
    [
      ['Experiencia alternativa en construcción de puentes vehiculares', ''],
      ['Experiencia alternativa en construcción de vías urbanas', ''],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía', '500000000']]
  );
  assert(ev.resultados[0].requisito.obligatoriedad === 'alternativo' && ev.resultados[1].requisito.obligatoriedad === 'alternativo', 'ambas filas deberían auto-clasificarse "alternativo" por su propio texto');
  assert(ev.grupos.length === 1, 'se esperaba 1 grupo automático (racha de 2 consecutivos), fueron ' + ev.grupos.length);
  assert(ev.grupos[0].origen === 'consecutivos', 'se esperaba origen "consecutivos", fue ' + ev.grupos[0].origen);
  assert(ev.grupos[0].resultado === 'CUMPLE', 'el grupo debería CUMPLIR (un miembro cumple), fue ' + ev.grupos[0].resultado);
  assert(ev.resultadoGlobal === 'CUMPLE', 'se esperaba CUMPLE global, fue ' + ev.resultadoGlobal);
});

await check('Un "alternativo" SUELTO (sin pareja consecutiva) no forma grupo -- sigue sin arrastrar el global, igual que antes de este cambio', () => {
  const ev = evaluar(
    ['Requisito', 'Obligatoriedad'],
    [
      ['Experiencia específica en construcción de escuelas', 'Obligatorio'],
      ['Experiencia alternativa en construcción de puentes vehiculares', 'Alternativo'],
    ],
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de escuelas rurales en el corregimiento', 'Alcaldía', '250000000']]
  );
  assert(ev.grupos.length === 0, 'un alternativo solo (racha de 1) no debería formar grupo, se detectaron ' + ev.grupos.length);
  assert(ev.totalObligatorios === 1, 'se esperaba 1 obligatorio (escuelas) sin contar el alternativo suelto, fueron ' + ev.totalObligatorios);
  assert(ev.resultadoGlobal === 'CUMPLE', 'el global debería depender solo del obligatorio (escuelas, CUMPLE), fue ' + ev.resultadoGlobal);
});

// 15) Red flags del pliego: garantías por debajo del mínimo legal (Decreto
// 1082 de 2015) -----------------------------------------------------------
// detectarRedFlags NUNCA debe disparar por un % "alto" (el decreto fija
// pisos, no techos) ni inventar un valor cuando no hay un número explícito
// junto a la etiqueta -- solo cuando SÍ hay un número y está por debajo del
// mínimo verificado.
await check('detectarRedFlags: garantía de cumplimiento por debajo del 10% dispara, con la página real del match', () => {
  const texto = 'Cláusula décima. RELLENO. '.repeat(20) +
    'La Garantía de Cumplimiento equivalente al cinco por ciento (5%) del valor del contrato. Fin.';
  const paginaOffsets = [{ pagina: 1, hasta: 300 }, { pagina: 2, hasta: texto.length }];
  const hallazgos = expEngine.detectarRedFlags(texto, paginaOffsets);
  assert(hallazgos.length === 1, 'se esperaba 1 alerta (garantía de cumplimiento al 5%), se detectaron ' + hallazgos.length);
  assert(hallazgos[0].id === 'garantia-cumplimiento-baja', 'id inesperado: ' + hallazgos[0].id);
  assert(hallazgos[0].pagina === 2, 'la alerta debería citar la página 2 (donde está el match real), citó ' + hallazgos[0].pagina);
  assert(/2\.2\.1\.2\.3\.1\.12/.test(hallazgos[0].articulo), 'la cita debería incluir el artículo 2.2.1.2.3.1.12');
});
await check('detectarRedFlags: garantía de cumplimiento en el mínimo legal exacto, o razonablemente por encima, NO dispara ninguna alerta', () => {
  const texto = 'La Garantía de Cumplimiento equivalente al diez por ciento (10%) del valor del contrato.';
  assert(expEngine.detectarRedFlags(texto, []).length === 0, 'un 10% exacto no debería disparar nada (es el mínimo legal, no está por debajo ni es desproporcionado)');
  const texto15 = 'La Garantía de Cumplimiento equivalente al quince por ciento (15%) del valor del contrato.';
  assert(expEngine.detectarRedFlags(texto15, []).length === 0, 'un 15% (por encima del mínimo pero lejos de 3x) es razonable -- no debería disparar la alerta de proporcionalidad');
});
await check('detectarRedFlags: garantía de cumplimiento MUY por encima del mínimo (>=3x) dispara la alerta blanda de proporcionalidad, no la de infracción', () => {
  const texto30 = 'La Garantía de Cumplimiento equivalente al treinta por ciento (30%) del valor del contrato.';
  const hallazgos = expEngine.detectarRedFlags(texto30, []);
  assert(hallazgos.length === 1, 'un 30% (exactamente 3x el mínimo) debería disparar la alerta de proporcionalidad, se detectaron ' + hallazgos.length);
  assert(hallazgos[0].id === 'garantia-cumplimiento-alta', 'id inesperado: ' + hallazgos[0].id);
  assert(hallazgos[0].severidad === 'baja', 'la alerta de proporcionalidad debe ser severidad baja (la más débil), fue ' + hallazgos[0].severidad);
  assert(/Ley 1150/.test(hallazgos[0].articulo), 'debe citar el principio general (Ley 1150, Art. 5), no un artículo del Decreto 1082 con cifra fija');
  assert(!/infracci[oó]n confirmada/i.test(hallazgos[0].mensaje) || /no es necesariamente/i.test(hallazgos[0].mensaje),
    'el mensaje NUNCA debe presentar esto como una infracción confirmada -- solo un criterio de revisión');
});
await check('detectarRedFlags: garantía de seriedad de la oferta y RC extracontractual por debajo del mínimo, ambas a la vez', () => {
  const texto = 'Garantía de Seriedad de la Oferta por el ocho por ciento (8%) del valor de la oferta. ' +
    'La garantía de Responsabilidad Civil Extracontractual amparará hasta ciento cincuenta (150) SMMLV.';
  const hallazgos = expEngine.detectarRedFlags(texto, []);
  const ids = hallazgos.map(h => h.id).sort();
  assert(JSON.stringify(ids) === JSON.stringify(['garantia-seriedad-baja', 'rc-extracontractual-baja']),
    'se esperaban las 2 alertas (seriedad 8% y RC extracontractual 150 SMMLV), se obtuvo: ' + ids.join(', '));
});
await check('detectarRedFlags: mención de "garantía de cumplimiento" SIN número cercano no dispara nada (no se inventa un valor)', () => {
  const texto = 'El proponente debe constituir la Garantía de Cumplimiento a favor de la entidad, según lo defina el comité evaluador más adelante en este documento.';
  assert(expEngine.detectarRedFlags(texto, []).length === 0, 'sin un % explícito junto a la etiqueta, no debería inventarse ninguna alerta');
});
await check('calcularViabilidad: 100 sin alertas, resta fija por severidad, nunca baja de 0', () => {
  assert(expEngine.calcularViabilidad([]) === 100, 'sin alertas la viabilidad debería ser 100');
  assert(expEngine.calcularViabilidad([{ severidad: 'alta' }, { severidad: 'media' }]) === 70,
    '100 - 20 (alta) - 10 (media) debería dar 70');
  const seis = Array.from({ length: 6 }, () => ({ severidad: 'alta' })); // 6 x 20 = 120, más de 100
  assert(expEngine.calcularViabilidad(seis) === 0, 'la viabilidad nunca debería bajar de 0');
});
await check('paginaDeOffset: mapea un índice de carácter a la página real, no a una posición inventada', () => {
  const offsets = [{ pagina: 1, hasta: 100 }, { pagina: 2, hasta: 250 }, { pagina: 3, hasta: 400 }];
  assert(expEngine.paginaDeOffset(offsets, 50) === 1, 'un índice dentro de la página 1 debería mapear a 1');
  assert(expEngine.paginaDeOffset(offsets, 150) === 2, 'un índice dentro de la página 2 debería mapear a 2');
  assert(expEngine.paginaDeOffset(offsets, 399) === 3, 'un índice dentro de la página 3 debería mapear a 3');
  assert(expEngine.paginaDeOffset([], 10) === null, 'sin offsets no debería inventarse una página');
});

// 44-53) Requisitos de experiencia extraídos del Pliego/Estudio Previo (ver
// elegant-wandering-dewdrop.md): reemplazan la matriz manual subida aparte
// -- los requisitos salen directo del texto ya extraído del pliego (mismo
// mecanismo de detectarRedFlags: regex sobre el texto completo +
// paginaDeOffset), con trazabilidad de página y detección de
// inconsistencias entre Pliego y Estudio Previo.
await check('localizarSeccionesExperiencia: encuentra una zona por ancla, con la página real del match', () => {
  const relleno = 'Cláusula décima. RELLENO. '.repeat(20); // empuja el texto real a la página 2
  const texto = relleno + 'La entidad exige experiencia específica en construcción de puentes vehiculares. Fin.';
  const paginaOffsets = [{ pagina: 1, hasta: 300 }, { pagina: 2, hasta: texto.length }];
  const zonas = expEngine.localizarSeccionesExperiencia(texto, paginaOffsets);
  assert(zonas.length === 1, 'se esperaba 1 zona (ancla "experiencia especifica"), se detectaron ' + zonas.length);
  assert(zonas[0].pagina === 2, 'la zona debería citar la página 2 (donde está el match real), citó ' + zonas[0].pagina);
});

await check('localizarSeccionesExperiencia: sin ninguna ancla de experiencia en el texto -> [] (nunca inventa una zona)', () => {
  const texto = 'Este pliego solo habla de plazos de ejecución y garantías, sin mencionar nada de experiencia exigida.';
  assert(expEngine.localizarSeccionesExperiencia(texto, []).length === 0, 'sin anclas no debería detectarse ninguna zona');
});

await check('localizarSeccionesExperiencia: anclas cercanas (encabezado + primer ítem) se agrupan en UNA zona, no fragmentan el contenido', () => {
  // Sin agrupar, "requisitos de experiencia" (ancla 1) recortaría la zona
  // justo antes de "Experiencia específica..." (ancla 2, a pocos
  // caracteres) -- dejando un fragmento fantasma sin contenido real. Ver
  // GAP_MAX_CLUSTER_EXPERIENCIA.
  const texto = 'Capítulo 3. Requisitos de experiencia: experiencia específica en construcción de puentes vehiculares.';
  const zonas = expEngine.localizarSeccionesExperiencia(texto, []);
  assert(zonas.length === 1, 'las 2 anclas cercanas deberían agruparse en 1 zona, se detectaron ' + zonas.length);
  assert(/puentes vehiculares/.test(zonas[0].texto), 'la zona agrupada debería conservar el contenido real, no cortarlo antes: ' + zonas[0].texto);
});

await check('extraerRequisitosDePliego: lista numerada dentro de una zona -> mismos campos que construirRequisitoDesdeTexto directo, con fuente/página', () => {
  const texto = 'Capítulo 3. Requisitos de experiencia: ' +
    '1. Experiencia específica en construcción de puentes vehiculares, mínimo 1 contrato, obligatorio. ' +
    '2. Experiencia específica en pavimentación de vías urbanas, mínimo 2 contratos, obligatorio.';
  const paginaOffsets = [{ pagina: 5, hasta: texto.length }];
  const { requisitos, zonas } = expEngine.extraerRequisitosDePliego(texto, paginaOffsets, 'Pliego de Condiciones');
  assert(zonas.length === 1, 'se esperaba 1 zona (anclas agrupadas), se detectaron ' + zonas.length);
  assert(requisitos.length === 2, 'se esperaban 2 requisitos, fueron ' + requisitos.length);
  assert(requisitos[0].minContratos === 1 && requisitos[1].minContratos === 2,
    'los campos deberían coincidir con lo que produce construirRequisitoDesdeTexto directo, fueron ' + JSON.stringify(requisitos.map(r => r.minContratos)));
  assert(requisitos.every(r => r.fuente === 'Pliego de Condiciones'), 'cada requisito debería llevar la fuente indicada');
  assert(requisitos.every(r => r.pagina === 5), 'cada requisito debería citar la página real, fueron ' + JSON.stringify(requisitos.map(r => r.pagina)));
});

await check('extraerRequisitosDePliego: sin ninguna ancla -> {requisitos: [], zonas: []} (nunca inventa un requisito)', () => {
  const texto = 'Este pliego no menciona experiencia en ninguna parte, solo plazos y garantías.';
  const r = expEngine.extraerRequisitosDePliego(texto, [], 'Pliego de Condiciones');
  assert(r.requisitos.length === 0 && r.zonas.length === 0, 'sin anclas no debería producirse ningún requisito ni zona');
});

function reqConPagina(texto, pagina){
  const r = expEngine.construirRequisitoDesdeTexto(texto, 0, {});
  r.pagina = pagina;
  return r;
}

await check('detectarInconsistenciasPliegoEP: mismo requisito con un número distinto en Pliego y Estudio Previo -> 1 inconsistencia citando ambas páginas', () => {
  const pliego = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 3 contratos, obligatorio.', 12);
  const ep = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 2 contratos, obligatorio.', 4);
  const inc = expEngine.detectarInconsistenciasPliegoEP([pliego], [ep]);
  assert(inc.length === 1, 'se esperaba 1 inconsistencia (3 vs 2 contratos), se detectaron ' + inc.length);
  assert(inc[0].paginaPliego === 12 && inc[0].paginaEP === 4, 'debería citar ambas páginas reales, citó ' + JSON.stringify(inc[0]));
  assert(!/ganador|prevalece|correcto/i.test(inc[0].mensaje), 'el mensaje nunca debe elegir un lado como el correcto');
});

await check('detectarInconsistenciasPliegoEP: un lado sin el número (null) NUNCA es inconsistencia -- el silencio no es evidencia de desacuerdo', () => {
  const pliego = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 3 contratos, obligatorio.', 12);
  const ep = reqConPagina('Experiencia específica en construcción de puentes vehiculares.', 4);
  assert(ep.minContratos === null, 'fixture inválido -- el EP no debería traer minContratos');
  const inc = expEngine.detectarInconsistenciasPliegoEP([pliego], [ep]);
  assert(inc.length === 0, 'un lado sin número no debería marcarse como inconsistencia');
});

await check('detectarInconsistenciasPliegoEP: requisitos sin relación (bajo solapamiento de palabras) no se emparejan, aunque los números difieran', () => {
  const pliego = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 3 contratos, obligatorio.', 12);
  const ep = reqConPagina('Experiencia específica en mantenimiento de redes de alcantarillado pluvial, mínimo 1 contrato, obligatorio.', 4);
  const inc = expEngine.detectarInconsistenciasPliegoEP([pliego], [ep]);
  assert(inc.length === 0, 'requisitos sin palabras distintivas compartidas no deberían emparejarse ni generar una inconsistencia inventada');
});

await check('detectarInconsistenciasPliegoEP: mismo valor exigido en ambos documentos -> no se marca inconsistencia', () => {
  const pliego = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 3 contratos, obligatorio.', 12);
  const ep = reqConPagina('Experiencia específica en construcción de puentes vehiculares, mínimo 3 contratos, obligatorio.', 4);
  assert(expEngine.detectarInconsistenciasPliegoEP([pliego], [ep]).length === 0, 'valores idénticos no deberían dispararla');
});

await check('evaluarExperienciaCompleta: requisitos con fuente/página extra (del Pliego) se comportan igual que un fixture Excel equivalente -- el wrapper no altera el motor', () => {
  const texto = '1. Experiencia específica en construcción de puentes vehiculares, mínimo 1 contrato, obligatorio.';
  const { requisitos } = expEngine.extraerRequisitosDePliego(texto, [{ pagina: 1, hasta: texto.length }], 'Pliego de Condiciones');
  const contratos = expEngine.parsearExcelExperiencia(fakeWorkbook(
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares sobre el río Pamplonita', 'Alcaldía de Cúcuta', '500000000']]
  ));
  const ev = expEngine.evaluarExperienciaCompleta(contratos.contratos, requisitos);
  assert(ev.resultadoGlobal === 'CUMPLE', 'se esperaba CUMPLE (mismo caso que el Caso 1 con Excel), fue ' + ev.resultadoGlobal);
});

await check('evaluarExperienciaCompleta: cero requisitos detectados en el Pliego -> resultado global NO DETERMINABLE explícito, nunca CUMPLE trivial', () => {
  const { requisitos } = expEngine.extraerRequisitosDePliego('Este pliego no menciona experiencia en ninguna parte.', [], 'Pliego de Condiciones');
  const contratos = expEngine.parsearExcelExperiencia(fakeWorkbook(
    ['Objeto', 'Contratante', 'Valor'],
    [['Construcción de puentes vehiculares', 'Alcaldía', '500000000']]
  ));
  const ev = expEngine.evaluarExperienciaCompleta(contratos.contratos, requisitos);
  assert(requisitos.length === 0, 'fixture inválido -- se esperaban 0 requisitos');
  assert(ev.resultadoGlobal === 'REQUIERE REVISIÓN', 'sin requisitos obligatorios evaluables, el global debería pedir revisión (nunca CUMPLE trivial), fue ' + ev.resultadoGlobal);
});

await check('textoPliegoDe: lee ocrText cuando el pliego se leyó vía OCR, y text en el camino normal', () => {
  assert(expEngine.textoPliegoDe({ viaOcr: false, text: 'texto normal', ocrText: 'texto ocr' }) === 'texto normal', 'debería leer entry.text cuando viaOcr es false');
  assert(expEngine.textoPliegoDe({ viaOcr: true, text: 'texto normal', ocrText: 'texto ocr' }) === 'texto ocr', 'debería leer entry.ocrText cuando viaOcr es true');
  assert(expEngine.textoPliegoDe(null) === '', 'sin entry no debería fallar, devuelve string vacío');
});

console.log('\n' + passed + ' ok, ' + failed + ' fallo(s).');
if (failed > 0) process.exit(1);
