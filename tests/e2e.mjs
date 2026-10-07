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
  ['bt-hide-nogo', 'bt-hide-closed', 'bt-hide-old', 'bt-only-licitacion', 'bt-hide-discarded'].forEach(i => {
    const e = document.getElementById(i);
    if (e && e.checked) { e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); }
  });
});
// El análisis ya no tiene ítem de menú: se llega a él desde la tarjeta de un proceso (o desde Documentos / Mis procesos).
const abrirAnalisisDelPrimero = async pg => {
  await pg.click('#bt-nav-buscar');
  await pg.locator('#bt-results .row').first().locator('[data-ir-analisis]').click();
  await pg.waitForFunction(() => !document.getElementById('view-analisis').hidden);
};
const dosEmpresas = () => {
  const o = {};
  for (let i = 1; i <= 2; i++) o['p' + i] = { nombre: 'Empresa ' + i, nit: '90000000' + i, k: '5000000000', kResidual: '3000000000', representanteLegal: 'Juan Pérez', representanteCedula: '123', ciudad: 'Cúcuta', direccion: 'Calle 1', telefono: '1', correo: 'a@b.co' };
  return { bitacora_perfiles_empresa: JSON.stringify(o), bitacora_perfiles_activos: JSON.stringify(['p1', 'p2']) };
};

console.log('Bitácora SECOP — pruebas de punta a punta (navegador real, sin red externa)\n');

await check('Buscar → "Analizar pliego →" → Análisis de pliegos: la lista queda limpia, la vista abre el proceso elegido, avisa del respaldo y el foco va al título', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  const fila = await pg.evaluate(() => {
    const r = document.querySelector('#bt-results .row');
    return { id: r.dataset.id, analisis: !!r.querySelector('.analysis-slot, .analysis-fold'), archivo: !!r.querySelector('input[type=file]'), boton: !!r.querySelector('[data-ir-analisis]') };
  });
  assert(!fila.analisis && !fila.archivo, 'la tarjeta de la lista no debe traer análisis ni carga de archivo');
  assert(fila.boton, 'la tarjeta debe traer el botón "Analizar pliego →"');
  await pg.locator('#bt-results .row').first().locator('[data-ir-analisis]').focus();
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => !document.getElementById('view-analisis').hidden);
  assert(await vistaActiva(pg) === 'view-analisis', 'debe abrirse la vista de análisis');
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
  assert(await focoActual(pg) === 'H1:Análisis de pliegos', 'el foco debe pasar al título de la vista (F-05): ' + await focoActual(pg));
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

await navegador.close();
servidor.close();
console.log('\n' + ok + ' ok, ' + fallos + ' fallo(s).');
process.exit(fallos ? 1 : 0);
