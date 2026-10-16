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
function extractMainScript() {
  const open = html.match(/^<script>$/m);
  assert(open, 'no se encontró la apertura de <script> en su propia línea');
  const startIdx = open.index + open[0].length;
  const endIdx = html.indexOf('\n</script>', startIdx);
  assert(endIdx !== -1, 'no se encontró el cierre </script> del script principal');
  return html.slice(startIdx, endIdx);
}
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

export const expEngine = extractExperienceEngine();
