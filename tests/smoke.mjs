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
    'parsearExcelExperiencia', 'parsearMatrizExperiencia', 'evaluarExperienciaCompleta',
    'loadPdfJs', 'loadTesseractJs', 'loadXlsxLib', 'extractPdfText', 'ocrPdfPages',
    'loadSupabaseJs', 'bootstrapAccountSession',
    'guardarAlertaActual', 'eliminarAlerta', 'evaluarAlerta', 'revisarTodasLasAlertas',
    'verNuevosDeAlerta', 'renderAlertasList', 'renderDashAlertas',
    'descuentoComparable', 'sugerenciaOfertaEconomica', 'renderOfertaSugeridaHtml',
    'prepararBusquedaPorNombre', 'buscarFichaEmpresa', 'agregarFichaEmpresa', 'renderFichaEmpresaHtml',
    'seguirEmpresa', 'dejarDeSeguirEmpresa', 'revisarEmpresaSeguida', 'revisarTodasLasEmpresasSeguidas',
    'verActividadEmpresa', 'renderEmpresasSeguidasList', 'renderDashSeguimiento',
    'calcularSCE', 'capacidadContractualEstimada', 'renderContratosEjecucion', 'renderCapacidadEstimada',
    'agregarContratoEjecucion', 'eliminarContratoEjecucion', 'actualizarCampoContrato',
    'esPerfilPropio', 'buscarSociosPorSector', 'agruparPorEmpresa', 'renderSociosHtml',
    'runBuscarSocios', 'verFichaDeSocio', 'generarCartaTexto', 'generarHojaDeVidaTexto',
    'segmentarTextoEnRequisitos', 'parsearMatrizExperienciaPDF', 'construirRequisitoDesdeTexto',
    'cargarMatrizPDF', 'cargarMatrizArchivo',
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

// 5) El SRI de los 4 scripts de terceros sigue coincidiendo con el CDN -----
// Requiere red (GitHub Actions la tiene). Si algún día se sube de versión
// pdf.js/xlsx/Tesseract.js/supabase-js sin recalcular el hash, este test lo
// detecta ANTES de que un usuario real se quede con esa librería sin cargar
// (la CSP + SRI la bloquean en silencio, ver commit que las agregó).
await check('el SRI embebido de pdf.js/xlsx/Tesseract.js/supabase-js coincide con el archivo real del CDN', async () => {
  const scriptBody = extractMainScript();
  const pairs = [...scriptBody.matchAll(
    /\.src\s*=\s*'(https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^']+)';[\s\S]*?\.integrity\s*=\s*'(sha384-[^']+)';/g
  )].map(m => ({ url: m[1], integrity: m[2] }));
  assert(pairs.length === 4, 'se esperaban 4 scripts CDN con integrity (pdf.js, xlsx, Tesseract.js, supabase-js), se encontraron ' + pairs.length);
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
// parsearMatrizExperiencia, evaluarExperienciaCompleta) contra Excel
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
    '\nreturn { parsearExcelExperiencia, parsearMatrizExperiencia, evaluarExperienciaCompleta, segmentarTextoEnRequisitos, parsearMatrizExperienciaPDF };';
  const fakeWindow = { XLSX: { utils: { sheet_to_json: (sheet) => sheet } } };
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
  assert(typeof expEngine.parsearMatrizExperiencia === 'function', 'parsearMatrizExperiencia no quedó expuesta');
  assert(typeof expEngine.evaluarExperienciaCompleta === 'function', 'evaluarExperienciaCompleta no quedó expuesta');
});

function evaluar(matrizHeaders, matrizRows, expHeaders, expRows) {
  assert(expEngine, 'el motor no se pudo extraer (ver check anterior) -- no se puede continuar con este caso');
  const contratos = expEngine.parsearExcelExperiencia(fakeWorkbook(expHeaders, expRows));
  const requisitos = expEngine.parsearMatrizExperiencia(fakeWorkbook(matrizHeaders, matrizRows));
  return Object.assign({ contratos, requisitos }, expEngine.evaluarExperienciaCompleta(contratos.contratos, requisitos.requisitos));
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
  const requisitos = expEngine.parsearMatrizExperiencia(fakeWorkbook(
    ['Descripción del requisito', 'Cantidad mínima de contratos', 'Caracter'],
    [['Experiencia específica en mantenimiento de redes de alcantarillado', '1', 'Obligatorio']]
  ));
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
  const parsed = expEngine.parsearMatrizExperienciaPDF(texto);
  assert(parsed.fuente === 'pdf', 'se esperaba fuente "pdf"');
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

console.log('\n' + passed + ' ok, ' + failed + ' fallo(s).');
if (failed > 0) process.exit(1);
