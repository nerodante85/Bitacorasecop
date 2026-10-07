// Pruebas de punta a punta en un navegador real (F-07, auditoría 2026-10-06).
//
// tests/smoke.mjs comprueba el código (texto, lógica pura); esto comprueba que el flujo FUNCIONA en pantalla:
// Buscar procesos -> "Analizar pliego →" -> Análisis de pliegos, el aviso de datos de respaldo/ejemplo, el foco del
// teclado, el menú móvil, las secciones fusionadas de Evaluación, la descarga de documentos y los análisis guardados.
//
// Es determinista: se sirve el repo por un servidor local y TODA petición externa se aborta, así la app cae al
// snapshot de respaldo (snapshot.json) en vez de consultar SECOP en vivo.
//
// Uso:  node tests/e2e.mjs
// Necesita Playwright (solo para esta prueba; el sitio y smoke.mjs siguen sin dependencias):
//   - CI: `npm install --no-save --no-package-lock playwright-core@1.56.1` y el Chrome del runner (channel 'chrome').
//   - Sandbox: PLAYWRIGHT_NODE_MODULES=/opt/node-tools/node_modules y CHROME_PATH=/opt/pw-browsers/chromium.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.css': 'text/css' };

// ---- Playwright (se busca en varios sitios para no atarse a un entorno) ----------------------------------------
async function cargarPlaywright() {
  const require = createRequire(import.meta.url);
  const rutas = [process.env.PLAYWRIGHT_NODE_MODULES, join(RAIZ, 'node_modules'), '/opt/node-tools/node_modules'].filter(Boolean);
  for (const nombre of ['playwright-core', 'playwright']) {
    try { return require(require.resolve(nombre, { paths: rutas })); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró Playwright. En CI: npm install --no-save --no-package-lock playwright-core@1.56.1');
}
async function lanzar(pw) {
  if (process.env.CHROME_PATH) return pw.chromium.launch({ executablePath: process.env.CHROME_PATH });
  try { return await pw.chromium.launch({ channel: 'chrome' }); } catch (e) { /* sin Chrome del sistema */ }
  return pw.chromium.launch();
}

// ---- servidor estático local -----------------------------------------------------------------------------------
const servidor = http.createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const archivo = join(RAIZ, ruta === '/' ? 'index.html' : ruta);
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream' });
    res.end(cuerpo);
  } catch (e) { res.writeHead(404); res.end('no encontrado'); }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

const pw = await cargarPlaywright();
const navegador = await lanzar(pw);

// ---- mini marco de pruebas (mismo estilo que smoke.mjs) --------------------------------------------------------
let ok = 0, fallos = 0;
async function check(nombre, fn) {
  try { await fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { fallos++; console.log('  FALLO ' + nombre + '\n        ' + (e && e.message ? e.message : e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'aserción falsa'); }

// Abre la app en un contexto nuevo, sin red externa, con localStorage sembrado ANTES de que corra la página.
async function abrir({ viewport = { width: 1280, height: 900 }, sembrar = {}, hasTouch = false } = {}) {
  const ctx = await navegador.newContext({ viewport, hasTouch, acceptDownloads: true });
  await ctx.route('**/*', ruta => ruta.request().url().startsWith(BASE) ? ruta.continue() : ruta.abort());
  await ctx.addInitScript(({ items }) => {
    try {
      if (!localStorage.getItem('__sembrado')) {
        Object.keys(items).forEach(k => localStorage.setItem(k, items[k]));
        localStorage.setItem('__sembrado', '1');
      }
    } catch (e) { /* nada */ }
  }, { items: sembrar });
  const pg = await ctx.newPage();
  pg.errores = [];
  pg.on('pageerror', e => pg.errores.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.goto(BASE + '/index.html');
  // La app consulta SECOP (abortado), cae al snapshot y dibuja la lista.
  await pg.waitForFunction(() => document.querySelectorAll('#bt-results .row').length > 0, null, { timeout: 20000 });
  return { ctx, pg };
}
const vistaActiva = pg => pg.evaluate(() => { const v = [...document.querySelectorAll('#bitacora-root .view')].find(x => !x.hidden); return v ? v.id : null; });
const focoActual = pg => pg.evaluate(() => { const a = document.activeElement; return a.tagName + (a.tagName === 'H1' ? ':' + a.textContent.trim() : ''); });
const sinDesborde = pg => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const quitarFiltros = pg => pg.evaluate(() => {
  ['bt-hide-closed', 'bt-hide-old', 'bt-only-licitacion', 'bt-hide-discarded'].forEach(i => {
    const e = document.getElementById(i);
    if (e && e.checked) { e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); }
  });
});
// El análisis ya no se abre desde Buscar procesos: se guarda el proceso y se abre desde Mis procesos.
const abrirAnalisisDelPrimero = async pg => {
  await pg.click('#bt-nav-buscar');
  const fila = pg.locator('#bt-results .row').first();
  const id = await fila.getAttribute('data-id');
  if (await fila.locator('[data-agregar-pipeline]').count()) await fila.locator('[data-agregar-pipeline]').click();
  await pg.click('#bt-nav-procesos');
  await pg.locator('#view-procesos [data-pipeline-abrir-id="' + id + '"]').first().click();
  await pg.waitForFunction(() => !document.getElementById('view-analisis').hidden);
};
const dosEmpresas = () => {
  const o = {};
  for (let i = 1; i <= 2; i++) o['p' + i] = { nombre: 'Empresa ' + i, nit: '90000000' + i, k: '5000000000', kResidual: '3000000000', representanteLegal: 'Juan Pérez', representanteCedula: '123', ciudad: 'Cúcuta', direccion: 'Calle 1', telefono: '1', correo: 'a@b.co' };
  return { bitacora_perfiles_empresa: JSON.stringify(o), bitacora_perfiles_activos: JSON.stringify(['p1', 'p2']) };
};

console.log('Bitácora SECOP — pruebas de punta a punta (navegador real, sin red externa)\n');

await check('Buscar procesos solo busca y muestra la ficha (sin análisis); Guardar → Mis procesos → Abrir lleva al análisis, avisa del respaldo y el foco va al título', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  const fila = await pg.evaluate(() => {
    const r = document.querySelector('#bt-results .row');
    const campos = [...r.querySelectorAll('.ficha dt')].map(x => x.textContent.trim());
    return { id: r.dataset.id, analisis: !!r.querySelector('.analysis-slot, .analysis-fold'), archivo: !!r.querySelector('input[type=file]'),
      botonAnalisis: !!r.querySelector('[data-ir-analisis]'), sello: !!r.querySelector('.tarjeta-veredicto, .tag.priority, .eval-chip'), campos,
      guardar: !!r.querySelector('[data-agregar-pipeline], [data-ir-pipeline]'), nogo: !!document.getElementById('bt-hide-nogo'), csv: !!document.getElementById('bt-export-csv') };
  });
  assert(!fila.analisis && !fila.archivo, 'la tarjeta de la lista no debe traer análisis ni carga de archivo');
  assert(!fila.botonAnalisis && !fila.sello, 'Buscar procesos no debe ofrecer análisis, sello GO/REVISAR ni prioridad');
  assert(!fila.nogo && !fila.csv, 'no deben quedar controles de análisis (Ocultar NO-GO, exportar alta prioridad)');
  assert(['Cuantía', 'Ubicación', 'Cierre'].every(c => fila.campos.includes(c)), 'la ficha debe traer los datos clave del proceso: ' + fila.campos.join(', '));
  assert(fila.guardar, 'la tarjeta debe poder guardarse en Mis procesos');
  await abrirAnalisisDelPrimero(pg);
  const v = await pg.evaluate(() => ({
    sel: document.getElementById('bt-analisis-select').value,
    filaId: (document.querySelector('#bt-analisis-out .row') || {}).dataset && document.querySelector('#bt-analisis-out .row').dataset.id,
    slot: !!document.querySelector('#bt-analisis-out .analysis-slot'),
    archivo: !!document.querySelector('#bt-analisis-out input[data-analyze-id]'),
    aviso: getComputedStyle(document.getElementById('bt-analisis-fuente')).display !== 'none' ? document.getElementById('bt-analisis-fuente').textContent : ''
  }));
  assert(v.sel === fila.id && v.filaId === fila.id, 'el proceso elegido debe quedar seleccionado (' + v.sel + ' vs ' + fila.id + ')');
  assert(v.slot && v.archivo, 'la vista de análisis debe traer el análisis y la carga de pliego');
  assert(/snapshot de respaldo/.test(v.aviso) && /no son datos actuales/.test(v.aviso), 'debe avisar que son datos de respaldo: ' + v.aviso);
  assert(await focoActual(pg) === 'H1:Análisis del proceso', 'el foco debe pasar al título de la vista (F-05): ' + await focoActual(pg));
  // cambiar de proceso en el selector
  const otro = await pg.evaluate(() => { const o = [...document.querySelectorAll('#bt-analisis-select option')]; return o[1].value; });
  await pg.selectOption('#bt-analisis-select', otro);
  assert(await pg.evaluate(() => document.querySelector('#bt-analisis-out .row').dataset.id) === otro, 'al cambiar el selector debe cambiar la tarjeta');
  // volver a la lista con teclado
  await pg.locator('#bt-analisis-panel [data-ir-a="buscar"]').focus();
  await pg.keyboard.press('Enter');
  assert(await vistaActiva(pg) === 'view-buscar', 'debe volver a Buscar procesos');
  assert(await focoActual(pg) === 'H1:Buscar procesos', 'el foco debe pasar al título de Buscar procesos: ' + await focoActual(pg));
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Menú: 4 ítems + Configuración; la marca abre Inicio; Empresa agrupa 3 pestañas; "evaluacion" y "pipeline" guardados abren Análisis y Mis procesos', async () => {
  let { ctx, pg } = await abrir({ sembrar: { bitacora_ultima_vista: 'evaluacion' } });
  const m = await pg.evaluate(() => ({
    items: [...document.querySelectorAll('#bt-nav .nav-item')].map(i => i.textContent.trim()),
    eval: !!document.getElementById('bt-nav-evaluacion') || !!document.getElementById('view-evaluacion') || !!document.querySelector('[data-view="evaluacion"]')
  }));
  assert(JSON.stringify(m.items) === JSON.stringify(['Buscar procesos', 'Mis procesos', 'Empresa', 'Documentos', 'Configuración y ayuda']), 'ítems del menú: ' + m.items.join(', '));
  assert(!m.eval, 'ya no debe existir Evaluación');
  assert(await vistaActiva(pg) === 'view-analisis', 'la vista guardada "evaluacion" debe abrir el análisis: ' + await vistaActiva(pg));
  // un proceso abierto cuenta como parte de la sección desde donde se llegó a él
  assert(await pg.evaluate(() => document.getElementById('bt-nav-buscar').classList.contains('active')), 'abierto el análisis, el ítem activo del menú es Buscar procesos');
  // la marca lleva a Inicio y ningún ítem queda marcado
  await pg.click('#bt-brand-home');
  assert(await vistaActiva(pg) === 'view-dashboard', 'la marca debe abrir Inicio');
  assert(await pg.evaluate(() => document.querySelectorAll('#bt-nav .nav-item.active').length) === 0, 'en Inicio no hay ítem activo');
  // flechas del menú: el foco se queda en el menú y la vista cambia
  await pg.focus('#bt-nav-buscar');
  await pg.keyboard.press('ArrowDown');
  assert((await focoActual(pg)).startsWith('BUTTON') && await vistaActiva(pg) === 'view-procesos', 'las flechas del menú deben conservar el foco en el menú y cambiar de vista');
  await pg.keyboard.press('ArrowDown');
  assert(await vistaActiva(pg) === 'view-empresa', 'Empresa');
  // pestañas de Empresa
  const panel = () => pg.evaluate(() => ['perfil', 'experiencia', 'personal'].filter(v => !document.getElementById('view-' + v).hidden));
  assert(JSON.stringify(await panel()) === '["perfil"]', 'Empresa abre en Datos y registros');
  await pg.click('#bt-empresa-tab-experiencia');
  assert(JSON.stringify(await panel()) === '["experiencia"]' && await vistaActiva(pg) === 'view-empresa', 'pestaña Experiencia');
  await pg.keyboard.press('ArrowRight');
  assert(JSON.stringify(await panel()) === '["personal"]' && (await focoActual(pg)).startsWith('BUTTON'), 'flecha derecha pasa a Personal y deja el foco en la pestaña');
  assert(await pg.evaluate(() => document.getElementById('bt-nav-empresa').classList.contains('active')), 'Empresa sigue marcado en el menú');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
  // nombres viejos guardados
  ({ ctx, pg } = await abrir({ sembrar: { bitacora_ultima_vista: 'pipeline' } }));
  assert(await vistaActiva(pg) === 'view-procesos', '"pipeline" guardado abre Mis procesos: ' + await vistaActiva(pg));
  await ctx.close();
  ({ ctx, pg } = await abrir({ sembrar: { bitacora_ultima_vista: 'experiencia' } }));
  assert(await vistaActiva(pg) === 'view-empresa' && await pg.evaluate(() => !document.getElementById('view-experiencia').hidden), '"experiencia" guardado abre Empresa › Experiencia');
  await ctx.close();
});

await check('Documentos: lista lo cargado por categoría y "Abrir análisis" abre el pliego analizado sin pasar por la búsqueda', async () => {
  const analisis = { 'ps2-E2E-DOC': { id: 'ps2-E2E-DOC', ts: Date.now(), fileName: 'pliego-doc.pdf', pagesRead: 15, numPages: 76, text: 'x', proceso: { entidad: 'Alcaldía E2E', objeto: 'Obra de prueba documentos', modalidad: 'Licitación pública', valor: 1000, fuente: 'II' } } };
  const { ctx, pg } = await abrir({ sembrar: Object.assign(dosEmpresas(), { bitacora_analisis_pliegos: JSON.stringify(analisis) }) });
  await pg.click('#bt-nav-documentos');
  assert(await vistaActiva(pg) === 'view-documentos', 'Documentos');
  const t = await pg.evaluate(() => document.getElementById('bt-docs-out').innerText);
  for (const sec of ['Empresa', 'Experiencia', 'Personal', 'Procesos']) assert(t.includes(sec), 'falta la categoría ' + sec);
  assert(t.includes('pliego-doc.pdf') && /leídas 15 de 76/.test(t) && /Lectura parcial/.test(t), 'el pliego con lectura parcial debe decirlo: ' + t.slice(-300));
  await pg.locator('#bt-docs-out [data-abrir-proceso]').first().click();
  assert(await vistaActiva(pg) === 'view-analisis', 'Abrir análisis');
  assert(await pg.evaluate(() => document.getElementById('bt-analisis-select').value) === 'ps2-E2E-DOC', 'debe quedar elegido el proceso guardado');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Celular (375 y 320 px): los ítems del menú miden 44 px y las vistas no desbordan', async () => {
  for (const ancho of [375, 320]) {
    const { ctx, pg } = await abrir({ viewport: { width: ancho, height: 700 }, hasTouch: true });
    await pg.click('#bt-nav-toggle');
    const alturas = await pg.evaluate(() => [...document.querySelectorAll('#bt-nav .nav-item')].map(i => Math.round(i.getBoundingClientRect().height)));
    assert(alturas.length === 5 && alturas.every(h => h >= 44), 'ítems del menú a ' + ancho + ' px: ' + alturas.join(','));
    await pg.click('#bt-nav-empresa');
    assert(await vistaActiva(pg) === 'view-empresa', 'el menú móvil debe abrir Empresa');
    assert(await focoActual(pg) === 'H1:Empresa', 'tras elegir una sección del menú móvil el foco va al título: ' + await focoActual(pg));
    assert(await sinDesborde(pg) <= 0, 'desborde horizontal en Empresa a ' + ancho + ' px');
    const tabs = await pg.evaluate(() => [...document.querySelectorAll('#bt-empresa-tabs .subtab')].map(t => Math.round(t.getBoundingClientRect().height)));
    assert(tabs.length === 3 && tabs.every(h => h >= 44), 'pestañas de Empresa a ' + ancho + ' px: ' + tabs.join(','));
    for (const [nav, vista] of [['procesos', 'view-procesos'], ['documentos', 'view-documentos'], ['ajustes', 'view-ajustes'], ['buscar', 'view-buscar']]) {
      await pg.click('#bt-nav-toggle');
      await pg.click('#bt-nav-' + nav);
      assert(await vistaActiva(pg) === vista, 'menú móvil -> ' + vista);
      assert(await sinDesborde(pg) <= 0, 'desborde horizontal en ' + vista + ' a ' + ancho + ' px');
    }
    assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
    await ctx.close();
  }
});

await check('Evaluación fusionada: con dos empresas el análisis trae la recomendación, el veredicto por empresa, el contexto de la entidad y descarga carta e informe', async () => {
  const { ctx, pg } = await abrir({ sembrar: dosEmpresas() });
  await abrirAnalisisDelPrimero(pg);
  await pg.waitForFunction(() => document.querySelectorAll('#bt-analisis-out .fold-title').length > 0);
  const t = await pg.evaluate(() => [...document.querySelectorAll('#bt-analisis-out .fold-title')].map(e => e.textContent));
  assert(t.includes('Recomendación y comparación por empresa') && t.includes('Contexto de la entidad: adjudicaciones y oferta'), 'secciones fusionadas ausentes: ' + t.join(' | '));
  await pg.evaluate(() => document.querySelectorAll('#bt-analisis-out details').forEach(d => { d.open = true; }));
  const n = await pg.evaluate(() => ({ carta: document.querySelectorAll('#bt-analisis-out .eval-carta-btn').length, paquete: document.querySelectorAll('#bt-analisis-out .eval-paquete-btn').length, informe: document.querySelectorAll('#bt-analisis-out .eval-informe-btn').length, adj: document.querySelectorAll('#bt-analisis-out .eval-adj-btn').length }));
  assert(n.carta === 2 && n.paquete === 2 && n.informe === 1 && n.adj === 1, 'botones por empresa/informe/adjudicaciones: ' + JSON.stringify(n));
  const [carta] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.locator('#bt-analisis-out .eval-carta-btn').nth(1).click()]);
  assert(/^carta-presentacion-empresa-2-/.test(carta.suggestedFilename()), 'carta de la empresa 2: ' + carta.suggestedFilename());
  const [informe] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.locator('#bt-analisis-out .eval-informe-btn').click()]);
  assert(/^evaluacion-/.test(informe.suggestedFilename()), 'informe: ' + informe.suggestedFilename());
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('F-04: un análisis guardado se reabre aunque su proceso ya no salga en la búsqueda (con resumen, y "sin datos guardados")', async () => {
  const ahora = Date.now();
  const analisis = {
    'ps2-E2E-CON-RESUMEN': { id: 'ps2-E2E-CON-RESUMEN', ts: ahora, fileName: 'pliego-a.pdf', pagesRead: 5, numPages: 5, text: 'x', proceso: { entidad: 'Alcaldía E2E', objeto: 'Obra de prueba e2e', modalidad: 'Licitación pública', valor: 1000, fuente: 'II', referencia: 'E2E-1', modo: 'vivo', ts: ahora } },
    'ps2-E2E-SIN-DATOS': { id: 'ps2-E2E-SIN-DATOS', ts: ahora - 1000, fileName: 'pliego-b.pdf', pagesRead: 3, numPages: 3, text: 'x' }
  };
  const { ctx, pg } = await abrir({ sembrar: { bitacora_analisis_pliegos: JSON.stringify(analisis) } });
  await abrirAnalisisDelPrimero(pg);
  const grupos = await pg.evaluate(() => [...document.querySelectorAll('#bt-analisis-select optgroup')].map(g => g.label));
  assert(grupos.some(g => /Analizados antes/.test(g)), 'debe existir el grupo "Analizados antes": ' + grupos.join(' | '));
  await pg.selectOption('#bt-analisis-select', 'ps2-E2E-CON-RESUMEN');
  const a = await pg.evaluate(() => ({ ent: document.querySelector('#bt-analisis-out .row-ent').textContent, notas: [...document.querySelectorAll('#bt-analisis-out .saved-note')].map(n => n.textContent).join(' | '), fold: !!document.querySelector('#bt-analisis-out .analysis-fold') }));
  assert(a.ent === 'Alcaldía E2E' && /búsqueda anterior/.test(a.notas) && a.fold, 'proceso guardado con resumen: ' + JSON.stringify(a));
  await pg.selectOption('#bt-analisis-select', 'ps2-E2E-SIN-DATOS');
  const b = await pg.evaluate(() => ({ ent: document.querySelector('#bt-analisis-out .row-ent').textContent, notas: [...document.querySelectorAll('#bt-analisis-out .saved-note')].map(n => n.textContent).join(' | ') }));
  assert(b.ent === 'Proceso sin datos guardados' && /no los datos del proceso/.test(b.notas), 'proceso sin datos: ' + JSON.stringify(b));
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Datos de ejemplo: "Análisis de pliegos" avisa que son ficticios y no deja generar la carta', async () => {
  const { ctx, pg } = await abrir({ sembrar: dosEmpresas() });
  await pg.click('#bt-nav-buscar');
  await quitarFiltros(pg);
  await pg.click('#bt-demo');
  await pg.waitForFunction(() => /ejemplo/i.test(document.getElementById('bt-demo-banner').textContent) && getComputedStyle(document.getElementById('bt-demo-banner')).display !== 'none');
  await abrirAnalisisDelPrimero(pg);
  await pg.waitForFunction(() => document.querySelectorAll('#bt-analisis-out .row').length > 0);
  const aviso = await pg.evaluate(() => getComputedStyle(document.getElementById('bt-analisis-fuente')).display !== 'none' ? document.getElementById('bt-analisis-fuente').textContent : '');
  assert(/datos de ejemplo \(ficticios\)/.test(aviso), 'aviso de datos de ejemplo: ' + aviso);
  await pg.evaluate(() => document.querySelectorAll('#bt-analisis-out details').forEach(d => { d.open = true; }));
  let descargo = false;
  pg.once('download', () => { descargo = true; });
  await pg.locator('#bt-analisis-out .eval-carta-btn').first().click();
  await pg.waitForTimeout(600);
  assert(!descargo, 'con datos de ejemplo no debe generarse la carta');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Inicio: la frase de búsqueda llena los filtros de Buscar, dice qué entendió y el rango de valor filtra de verdad', async () => {
  const { ctx, pg } = await abrir();
  assert(await vistaActiva(pg) === 'view-dashboard', 'se abre en Inicio');
  const cifras = await pg.evaluate(() => document.querySelectorAll('#view-dashboard .stat-card, #view-dashboard canvas, #view-dashboard svg.chart').length);
  assert(cifras === 0, 'Inicio no debe tener tarjetas de cifras ni gráficos');
  await pg.fill('#bt-inicio-q', 'Construcción en Norte de Santander entre $200 millones y $900 millones');
  await pg.click('#bt-inicio-buscar');
  await pg.waitForFunction(() => !document.getElementById('view-buscar').hidden);
  await pg.waitForFunction(() => /Entend/.test(document.getElementById('bt-nl-entendi').textContent));
  const f = await pg.evaluate(() => ({ geo: document.getElementById('bt-geo').value, min: document.getElementById('bt-min').value, max: document.getElementById('bt-max').value, kw: document.getElementById('bt-kw').value, texto: document.getElementById('bt-nl-entendi').textContent }));
  assert(f.geo === 'Norte de Santander' && f.min === '200000000' && f.max === '900000000' && f.kw === 'construcción', 'filtros llenos: ' + JSON.stringify(f));
  assert(/Especialidades: construcción/.test(f.texto) && /Departamento: Norte de Santander/.test(f.texto) && /Valor: desde/.test(f.texto), 'dice qué entendió: ' + f.texto);
  await pg.waitForFunction(() => document.querySelectorAll('#bt-results .row, #bt-results .empty').length > 0);
  const valores = await pg.evaluate(() => [...document.querySelectorAll('#bt-results .row')].map(r => { const m = [...r.querySelectorAll('.row-meta span')].find(x => /Valor base/.test(x.textContent)); return m ? m.textContent.replace(/[^0-9]/g, '') : ''; }));
  assert(valores.every(v => v === '' || (Number(v) >= 200e6 && Number(v) <= 900e6)), 'con el rango puesto no debe haber procesos fuera de él: ' + valores.join(','));
  // lo que no se entiende se avisa
  await pg.fill('#bt-nl', 'puentes por 2.000 millones');
  await pg.click('#bt-search');
  await pg.waitForFunction(() => /No entend/.test(document.getElementById('bt-nl-entendi').textContent));
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Mis procesos: 5 estados; un pipeline guardado con etapas viejas se migra; Guardar desde Buscar y cambiar de estado funcionan', async () => {
  const ahora = Date.now();
  const hist = {
    'VIEJO-1': { etapa: 'por_evaluar', etapaTs: ahora, snapshot: { entidad: 'Alcaldía Vieja', objeto: 'Obra vieja uno', valor: 1000, fuente: 'II' } },
    'VIEJO-2': { etapa: 'resultado', resultado: 'adjudicado', etapaTs: ahora, snapshot: { entidad: 'Gobernación Vieja', objeto: 'Obra vieja dos', valor: 2000, fuente: 'II' } }
  };
  const { ctx, pg } = await abrir({ sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.click('#bt-nav-procesos');
  const g = await pg.evaluate(() => [...document.querySelectorAll('#bt-pipeline-board .pipeline-grupo h2')].map(h => h.textContent.trim().replace(/\s+/g, ' ')));
  assert(JSON.stringify(g) === '["Por revisar 1","Presentada 1"]', 'etapas migradas: ' + JSON.stringify(g));
  const opc = await pg.evaluate(() => [...document.querySelectorAll('#bt-pipeline-board select')][0].options.length);
  assert(opc === 5, 'el selector de estado tiene 5 opciones: ' + opc);
  await pg.selectOption('#bt-pipeline-board [data-pipeline-mover-select-id="VIEJO-1"]', 'viable');
  const g2 = await pg.evaluate(() => [...document.querySelectorAll('#bt-pipeline-board .pipeline-grupo h2')].map(h => h.textContent.trim().replace(/\s+/g, ' ')));
  assert(JSON.stringify(g2) === '["Viable 1","Presentada 1"]', 'cambio de estado: ' + JSON.stringify(g2));
  const guardado = await pg.evaluate(() => JSON.parse(localStorage.getItem('bitacora_historial'))['VIEJO-1'].etapa);
  assert(guardado === 'viable', 'el estado queda guardado: ' + guardado);
  // Guardar desde Buscar
  await pg.click('#bt-nav-buscar');
  const id = await pg.evaluate(() => document.querySelector('#bt-results .row').dataset.id);
  await pg.locator('#bt-results .row').first().locator('[data-agregar-pipeline]').click();
  await pg.click('#bt-nav-procesos');
  const g3 = await pg.evaluate(() => [...document.querySelectorAll('#bt-pipeline-board .pipeline-grupo h2')].map(h => h.textContent.trim().replace(/\s+/g, ' ')));
  assert(g3[0] === 'Por revisar 1', 'el proceso guardado entra en "Por revisar": ' + JSON.stringify(g3));
  await pg.locator('#bt-pipeline-board [data-pipeline-quitar-id="' + id + '"]').click();
  assert(await pg.evaluate(() => document.querySelectorAll('#bt-pipeline-board [data-pipeline-quitar-id]').length) === 2, 'quitar lo saca de Mis procesos');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

// Análisis sembrado (sin llamar a la IA real): un pliego de 3 páginas con requisitos ya extraídos y verificados.
const paginasAn = ['Pagina uno: introduccion general del proceso de contratacion.', 'El indice de liquidez debe ser mayor o igual a 1,5 para los proponentes.', 'La capacidad residual minima exigida es de $5.000.000.000 para este proceso.'];
const textoAn = paginasAn.join('');
const offsetsAn = (() => { let n = 0; return paginasAn.map((t, i) => ({ pagina: i + 1, hasta: (n += t.length) })); })();
const fila = (o) => Object.assign({ naturaleza: 'habilitante', documento: 'Pliego de Condiciones', verificada: true, confianza: 'alta' }, o);
const analisisSembrado = (extra = {}) => ({
  'E2E-AN': Object.assign({
    id: 'E2E-AN', ts: Date.now(), fileName: 'pliego-e2e.pdf', pagesRead: 3, numPages: 3, text: textoAn, paginaOffsets: offsetsAn,
    proceso: { entidad: 'Alcaldía E2E', objeto: 'Obra de prueba del análisis', modalidad: 'Licitación pública Obra Publica', valor: 4000000000, closingRaw: new Date(Date.now() + 20 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa A', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100,
    exigenciasIA: { liquidez: { valor: 1.5, raw: 'El indice de liquidez debe ser mayor o igual a 1,5', porcentaje: false, estricto: false }, kResidual: { valor: 5000000000, unidad: 'COP', raw: 'La capacidad residual minima exigida es de $5.000.000.000' } },
    requisitosIA: { avisos: [], filas: [
      fila({ categoria: 'capacidad_financiera', indicador: 'liquidez', operador: '>=', valor_indicador: 1.5, descripcion: 'Índice de liquidez', pagina: 2, cita_textual: 'El indice de liquidez debe ser mayor o igual a 1,5' }),
      fila({ categoria: 'k_residual', descripcion: 'Capacidad residual', valor_minimo_numero: 5000000000, valor_minimo_unidad: 'COP', pagina: 3, cita_textual: 'La capacidad residual minima exigida es de $5.000.000.000' }),
      fila({ categoria: 'garantias', descripcion: 'Garantía de cumplimiento', pagina: 3, cita_textual: 'garantia de cumplimiento del 10%' }),
      fila({ categoria: 'personal', descripcion: 'Director de obra', pagina: 3, verificada: false, motivoVerificacion: 'la cita no aparece en el PDF', cita_textual: 'Director de obra con 10 anos' })
    ] }
  }, extra)
});
const empresaAn = () => ({ bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa A', nit: '900', k: 'Liquidez = 2,0\nEndeudamiento = 0,4', kResidual: 'K residual = 3.000.000.000', rup: '' } }), bitacora_perfiles_activos: JSON.stringify(['p1']) });
const abrirAnalisisSembrado = async (pg) => {
  await pg.click('#bt-nav-documentos');
  await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-AN"]').click();
  await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .resultado-nombre'));
};

await check('Análisis: arranca con el resultado y su explicación, resume la viabilidad en 5 áreas, avisa lo importante y la matriz se filtra', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const orden = await pg.evaluate(() => { const o = document.querySelector('#bt-analisis-out .analysis-resumen'); return [...o.children].map(c => c.className.split(' ')[0] || c.tagName); });
  assert(orden[0] === 'resultado-global', 'el análisis comienza con el resultado: ' + orden.join(','));
  const hero = await pg.evaluate(() => ({ nombre: document.querySelector('.resultado-nombre').textContent, expl: document.querySelector('.resultado-expl').textContent, meta: document.querySelector('.resultado-meta').textContent }));
  assert(hero.nombre === 'NO-GO' && /requisito\(s\) crítico\(s\)/.test(hero.expl) && /Capacidad K residual/.test(hero.expl), 'resultado y explicación: ' + JSON.stringify(hero));
  const areas = await pg.evaluate(() => [...document.querySelectorAll('.viabilidad-tabla tbody tr')].map(tr => [tr.children[0].textContent, tr.children[1].textContent.replace(/^[^A-Z]*/, '').trim()]));
  assert(areas.map(a => a[0]).join('|') === 'Experiencia|Capacidad financiera|Capacidad residual|Personal|Garantías', 'áreas: ' + JSON.stringify(areas));
  const est = Object.fromEntries(areas);
  assert(est['Capacidad residual'] === 'NO CUMPLE' && est['Garantías'] === 'NO DETERMINABLE' && est['Experiencia'] === 'NO DETERMINABLE', 'estados de las áreas: ' + JSON.stringify(est));
  const al = await pg.evaluate(() => [...document.querySelectorAll('.alertas-analisis .alerta-item')].map(a => a.className.replace('alerta-item ', '') + ':' + a.textContent));
  assert(al[0].startsWith('critica:') && /Capacidad K residual/.test(al[0]), 'la primera alerta es crítica: ' + al[0]);
  assert(al.some(a => a.startsWith('revisar:') && /cita sin verificar|sin verificar/i.test(a)), 'avisa la cita sin verificar: ' + al.join(' | '));
  // matriz: columnas, los 4 resultados y el filtro
  const cols = await pg.evaluate(() => [...document.querySelectorAll('.matriz-tabla thead th')].map(t => t.textContent));
  assert(cols.join('|') === 'Requisito|Exigencia|Empresa|Resultado|Evidencia', 'columnas de la matriz: ' + cols.join('|'));
  const res = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.matriz-tabla tbody tr')].map(tr => [tr.children[0].textContent.split(':')[0], tr.dataset.resultado])));
  assert(res['Capacidad financiera'] === 'CUMPLE' && res['K residual'] === 'NO CUMPLE' && res['Garantías'] === 'REVISAR' && res['Personal'] === 'NO DETERMINABLE', 'resultados por fila (la cita sin verificar jamás da CUMPLE): ' + JSON.stringify(res));
  const visibles = () => pg.evaluate(() => [...document.querySelectorAll('.matriz-tabla tbody tr')].filter(t => !t.hidden).length);
  const total = await visibles();
  await pg.locator('[data-matriz-filtro="NO CUMPLE"]').click();
  assert(await visibles() === 1 && await pg.evaluate(() => document.querySelector('[data-matriz-filtro="NO CUMPLE"]').getAttribute('aria-pressed')) === 'true', 'el filtro deja solo los NO CUMPLE');
  await pg.locator('[data-matriz-filtro="CUMPLE"]').click();
  assert(await visibles() === 1, 'filtro CUMPLE');
  await pg.locator('[data-matriz-filtro=""]').click();
  assert(await visibles() === total, 'Todos');
  // la cita sin verificar jamás se rotula CUMPLE aunque su exigencia "cuadre"
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Evidencia: el panel lateral muestra requisito, exigencia, fuente, página, cita textual y dato de la empresa; abre la página del documento; Escape lo cierra y devuelve el foco', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const boton = pg.locator('.matriz-tabla tbody tr', { hasText: 'Índice de liquidez' }).locator('[data-ev-fila]');
  await boton.focus();
  await boton.press('Enter');
  await pg.waitForFunction(() => !document.getElementById('bt-evidencia-backdrop').hidden);
  const t = await pg.evaluate(() => ({ rol: document.getElementById('bt-evidencia-panel').getAttribute('role'), texto: document.getElementById('bt-evidencia-panel').innerText, foco: document.activeElement.id, vista: !document.getElementById('view-analisis').hidden }));
  assert(t.rol === 'dialog' && t.vista, 'es un panel (diálogo) y no se sale de la pantalla de análisis');
  for (const campo of ['Requisito', 'Exigencia', 'Fuente', 'Página', 'Cita textual', 'Información de la empresa', 'Resultado']) assert(t.texto.includes(campo), 'falta el campo "' + campo + '"');
  assert(/Pliego de Condiciones/.test(t.texto) && /2/.test(t.texto) && /índice de liquidez debe ser mayor o igual a 1,5|indice de liquidez debe ser mayor o igual a 1,5/i.test(t.texto) && /se encontró en el texto del PDF/.test(t.texto), 'contenido de la evidencia: ' + t.texto.slice(0, 500));
  assert(/CUMPLE/.test(t.texto), 'resultado con texto');
  assert(t.foco === 'bt-evidencia-cerrar', 'el foco pasa al panel: ' + t.foco);
  await pg.click('[data-ev-pagina]');
  const pagina = await pg.evaluate(() => { const c = document.getElementById('bt-evidencia-pagina'); return { visible: !c.hidden, texto: c.textContent, marca: (c.querySelector('mark') || {}).textContent || '' }; });
  assert(pagina.visible && /Pagina|indice de liquidez/i.test(pagina.texto) && /liquidez/i.test(pagina.marca), 'la página del documento se muestra con la cita resaltada: ' + JSON.stringify(pagina).slice(0, 300));
  await pg.keyboard.press('Escape');
  assert(await pg.evaluate(() => document.getElementById('bt-evidencia-backdrop').hidden), 'Escape cierra el panel');
  assert(await pg.evaluate(() => document.activeElement.hasAttribute('data-ev-fila')), 'el foco vuelve al botón "Ver evidencia"');
  // fila sin verificar: lo dice
  const sinVer = pg.locator('.matriz-tabla tbody tr', { hasText: 'Director de obra' }).locator('[data-ev-fila]');
  await sinVer.click();
  const t2 = await pg.evaluate(() => document.getElementById('bt-evidencia-panel').innerText);
  assert(/Cita sin verificar/.test(t2) && /NO DETERMINABLE/.test(t2) && /no cuenta para decidir/i.test(t2) && /No se compara con los datos de tu empresa/.test(t2), 'una cita sin verificar se declara: ' + t2.slice(0, 600));
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Transparencia: un pliego leído en parte (15 de 76 páginas) nunca se presenta como análisis completo', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado({ pagesRead: 15, numPages: 76 })) }) });
  await abrirAnalisisSembrado(pg);
  const d = await pg.evaluate(() => ({ alertas: [...document.querySelectorAll('.alertas-analisis .alerta-item')].map(a => a.textContent), meta: [...document.querySelectorAll('.resultado-meta')].map(x => x.textContent).join(' '), texto: document.getElementById('bt-analisis-out').innerText }));
  assert(d.alertas.some(a => /El análisis es parcial: se leyeron 15 de 76/.test(a)), 'alerta de análisis parcial: ' + d.alertas.join(' | '));
  assert(/Leído: 15\/76 págs \(parcial\)/.test(d.meta), 'cobertura junto al resultado: ' + d.meta);
  assert(!/analizado completamente|análisis completo/i.test(d.texto), 'nunca se dice "analizado completamente" con lectura parcial');
  assert(await pg.evaluate(() => document.querySelector('.resultado-nombre').textContent) !== 'GO', 'con lectura parcial nunca hay GO');
  await ctx.close();
});

await check('Sin pliego: el proceso se abre con NO DETERMINABLE (no hay evidencia) y sin datos de empresa el análisis lo dice', async () => {
  const { ctx, pg } = await abrir({ sembrar: empresaAn() });
  await abrirAnalisisDelPrimero(pg);
  await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .resultado-nombre'));
  const v = await pg.evaluate(() => ({ nombre: document.querySelector('#bt-analisis-out .resultado-nombre').textContent, expl: document.querySelector('#bt-analisis-out .resultado-expl').textContent, botones: [...document.querySelectorAll('#bt-analisis-out .row-actions button, #bt-analisis-out .row-actions a')].map(b => b.textContent.trim()) }));
  assert(['NO DETERMINABLE', 'NO-GO'].includes(v.nombre) && v.nombre !== 'GO', 'sin pliego nunca es GO ni REVISAR "de avance": ' + v.nombre);
  if (v.nombre === 'NO DETERMINABLE') assert(/no hay evidencia|sin él/i.test(v.expl), 'explica por qué: ' + v.expl);
  assert(v.botones[0] === 'Analizar proceso', 'la acción principal es "Analizar proceso": ' + v.botones.join(' | '));
  assert(v.botones.some(b => b === 'Guardar' || /^✓ Guardado/.test(b)) && v.botones.includes('Ver en SECOP'), 'Guardar y Ver en SECOP: ' + v.botones.join(' | '));
  await ctx.close();
});

await check('Capacidad Residual (análisis): muestra lo que exige el proceso, lo que tiene la empresa, el resultado y la fuente con su página; nunca los mezcla', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const b = await pg.evaluate(() => { const c = document.querySelector('#bt-analisis-out .cr-comparacion'); return c ? { cajas: [...c.children].map(x => x.textContent.replace(/\s+/g, ' ').trim()), nota: c.parentElement.textContent } : null; });
  assert(b && b.cajas.length === 3, 'debe existir el bloque de comparación');
  assert(/Requerida por el proceso.*\$5\.000\.000\.000/.test(b.cajas[0]), 'requerida: ' + b.cajas[0]);
  assert(/Capacidad de tu empresa.*\$3\.000\.000\.000/.test(b.cajas[1]), 'empresa: ' + b.cajas[1]);
  assert(/NO CUMPLE/.test(b.cajas[2]), 'resultado: ' + b.cajas[2]);
  assert(/es menor que la exigida en \$2\.000\.000\.000/.test(b.nota), 'faltante: ' + b.nota);
  assert(/Fuente: Pliego de Condiciones · Página: 3/.test(b.nota), 'fuente y página: ' + b.nota);
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Capacidad Residual (análisis): si la empresa supera la exigida, aparentemente cumple y muestra el margen; sin K exigida dice que no la identificó y no inventa una', async () => {
  const rico = Object.assign(empresaAn(), { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa A', nit: '900', k: 'Liquidez = 2,0\nEndeudamiento = 0,4', kResidual: 'K residual = 8.000.000.000', rup: '' } }) });
  let { ctx, pg } = await abrir({ sembrar: Object.assign(rico, { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const t = await pg.evaluate(() => document.querySelector('#bt-analisis-out .cr-comparacion').parentElement.textContent.replace(/\s+/g, ' '));
  assert(/APARENTEMENTE CUMPLE/.test(t) && /supera la exigida por el proceso en \$3\.000\.000\.000/.test(t), 'cumple con margen: ' + t);
  await ctx.close();
  const sinK = analisisSembrado({ exigenciasIA: {}, requisitosIA: { avisos: [], filas: [] } });
  ({ ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(sinK) }) }));
  await abrirAnalisisSembrado(pg);
  const t2 = await pg.evaluate(() => document.querySelector('#bt-analisis-out .cr-comparacion').parentElement.textContent.replace(/\s+/g, ' '));
  assert(/No se identificó de forma confiable un requisito de Capacidad Residual K/.test(t2) && !/APARENTEMENTE CUMPLE/.test(t2), 'sin K exigida: ' + t2);
  await ctx.close();
});

await check('Capacidad Residual (empresa): estado de confianza, contrato en consorcio con participación, validaciones y "cómo se calculó"', async () => {
  const sem = { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa A', nit: '900', k: '', kResidual: 'K residual = 12.000.000.000', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']) };
  const { ctx, pg } = await abrir({ sembrar: sem });
  await pg.click('#bt-nav-empresa');
  const hero = () => pg.evaluate(() => { const h = document.querySelector('#bt-capacidad-estimada-out .cr-hero'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; });
  let h = await hero();
  assert(/Tu Capacidad Residual\s*\$12\.000\.000\.000/.test(h) && /Información completa/.test(h), 'sin contratos y con K: ' + h);
  await pg.click('#bt-contrato-nuevo');
  const f = (campo, v) => pg.fill('#bt-contratos-ejecucion-list [data-contrato-campo="' + campo + '"]', v);
  await f('nombre', 'Vía Cúcuta'); await f('valorInicial', '1.000.000.000'); await f('valorActual', '1.000.000.000'); await f('valorEjecutado', '400.000.000'); await f('saldo', '600.000.000');
  const fin = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
  await pg.fill('#bt-contratos-ejecucion-list [data-contrato-campo="fechaFin"]', fin);
  h = await hero();
  assert(/\$11\.400\.000\.000/.test(h), 'K - saldo: ' + h);
  await pg.check('#bt-contratos-ejecucion-list [data-contrato-campo="consorcio"]');
  h = await hero();
  assert(/Cálculo preliminar/.test(h), 'consorcio sin participación -> preliminar: ' + h);
  assert(await pg.evaluate(() => /participación/i.test(document.querySelector('#bt-capacidad-estimada-out .cr-alertas').textContent)), 'avisa la participación no registrada');
  await pg.fill('#bt-contratos-ejecucion-list [data-contrato-campo="participacion"]', '40');
  h = await hero();
  assert(/\$11\.760\.000\.000/.test(h), 'al 40 %: 12.000 - 240 = 11.760 millones: ' + h);
  await pg.fill('#bt-contratos-ejecucion-list [data-contrato-campo="participacion"]', '150');
  assert(await pg.evaluate(() => /entre 0 y 100/.test(document.querySelector('#bt-capacidad-estimada-out .cr-alertas').textContent)), 'participación > 100 es un error visible');
  await pg.fill('#bt-contratos-ejecucion-list [data-contrato-campo="participacion"]', '40');
  await pg.locator('#bt-capacidad-estimada-out summary').click();
  const det = await pg.evaluate(() => document.querySelector('#bt-capacidad-estimada-out details').textContent.replace(/\s+/g, ' '));
  assert(/K residual declarado\s*\$12\.000\.000\.000/.test(det) && /Participación/.test(det) && /40 %/.test(det), 'detalle del cálculo: ' + det);
  assert(await pg.evaluate(() => /Última actualización: \d{2}\/\d{2}\/\d{4}/.test(document.querySelector('#bt-capacidad-estimada-out .cr-hero').textContent)), 'muestra la última actualización');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Formato Maestro: se detecta al cargar el libro, sugiere el sujeto por el nombre de la empresa, importa los contratos y manda los que están en ejecución a Capacidad Residual', async () => {
  const sem = { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Constructora Ejemplo S.A.S.', nit: '900', k: '', kResidual: 'K residual = 5.000.000.000', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']) };
  const { ctx, pg } = await abrir({ sembrar: sem });
  await pg.click('#bt-nav-empresa'); await pg.click('#bt-empresa-tab-experiencia');
  const archivo = join(RAIZ, 'plantillas', 'Formato_Maestro_Experiencia_BitacoraSECOP_v1.xlsx');
  await pg.setInputFiles('#bt-expeval-exp-file', archivo);
  await pg.waitForSelector('#bt-fm-panel:not([hidden])');
  const p = await pg.evaluate(() => ({ sujeto: document.getElementById('bt-fm-sujeto').selectedOptions[0].textContent, vinc: document.getElementById('bt-fm-vinculadas').checked, prev: document.getElementById('bt-fm-preview').textContent, estado: document.getElementById('bt-expeval-exp-status').textContent }));
  assert(/CONSTRUCTORA EJEMPLO/.test(p.sujeto), 'sugiere el sujeto por nombre: ' + p.sujeto);
  assert(/2 contrato\(s\): 2 para acreditar experiencia y 0 en ejecución/.test(p.prev), 'vista previa (con la persona vinculada): ' + p.prev);
  assert(/Formato Maestro leído/.test(p.estado), 'estado: ' + p.estado);
  // quitar a las personas vinculadas no cambia el número de contratos, pero sí la participación del primero
  await pg.click('#bt-fm-importar');
  await pg.waitForFunction(() => document.getElementById('bt-fm-panel').hidden === true);
  const rev = await pg.evaluate(() => ({ estado: document.getElementById('bt-expeval-exp-status').textContent, filas: [...document.querySelectorAll('#bt-expeval-review .expeval-table tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())), aviso: (document.querySelector('#bt-expeval-review .account-notice') || {}).textContent }));
  assert(/2 contrato\(s\) importado\(s\) del Formato Maestro/.test(rev.estado), 'estado tras importar: ' + rev.estado);
  assert(rev.filas.length === 2 && rev.filas[0][1] === 'C-0001' && /100/.test(rev.filas[0][5]), 'tabla de revisión: ' + JSON.stringify(rev.filas));
  // el motor guarda los contratos importados para esta empresa
  const guardados = await pg.evaluate(() => { const d = JSON.parse(localStorage.getItem('bitacora_experiencia_evaluacion') || '{}'); const c = (((d.porPerfil || {}).p1 || {}).contratos || {}); return { fuente: c.fuente, n: (c.contratos || []).length, valor: c.contratos && c.contratos[0] && c.contratos[0].valor }; });
  assert(guardados.fuente === 'formato-maestro' && guardados.n === 2 && guardados.valor === 163147838, 'guardado: ' + JSON.stringify(guardados));
  // ahora el sujeto con un contrato en ejecución -> Capacidad Residual
  await pg.setInputFiles('#bt-expeval-exp-file', archivo);
  await pg.waitForSelector('#bt-fm-panel:not([hidden])');
  await pg.selectOption('#bt-fm-sujeto', 'S-003');
  assert(/1 contrato\(s\): 0 para acreditar experiencia y 1 en ejecución/.test(await pg.textContent('#bt-fm-preview')), 'vista previa del sujeto con contrato en ejecución');
  await pg.click('#bt-fm-importar');
  await pg.waitForFunction(() => /1 contrato\(s\) en ejecución agregado\(s\) a Capacidad Residual/.test(document.getElementById('bt-expeval-exp-status').textContent));
  await pg.click('#bt-empresa-tab-perfil');
  const cr = await pg.evaluate(() => ({ numeros: [...document.querySelectorAll('#bt-contratos-ejecucion-list [data-contrato-campo="numero"]')].map(i => i.value), hero: (document.querySelector('#bt-capacidad-estimada-out .cr-hero') || {}).textContent }));
  assert(cr.numeros.indexOf('GG-4215-2020') !== -1, 'el contrato en ejecución llegó a Capacidad Residual: ' + JSON.stringify(cr));
  // importar de nuevo no duplica
  await pg.click('#bt-empresa-tab-experiencia');
  await pg.setInputFiles('#bt-expeval-exp-file', archivo);
  await pg.waitForSelector('#bt-fm-panel:not([hidden])');
  await pg.selectOption('#bt-fm-sujeto', 'S-003');
  await pg.click('#bt-fm-importar');
  await pg.waitForFunction(() => document.getElementById('bt-fm-panel').hidden === true);
  assert(await pg.evaluate(() => document.querySelectorAll('#bt-contratos-ejecucion-list .contrato-row').length) === 1, 're-importar no duplica el contrato en ejecución');
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await navegador.close();
servidor.close();
console.log('\n' + ok + ' ok, ' + fallos + ' fallo(s).');
process.exit(fallos ? 1 : 0);
