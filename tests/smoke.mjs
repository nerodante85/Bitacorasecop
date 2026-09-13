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
    'nlSearchFunctionUrl', 'runBusquedaNatural',
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

console.log('\n' + passed + ' ok, ' + failed + ' fallo(s).');
if (failed > 0) process.exit(1);
