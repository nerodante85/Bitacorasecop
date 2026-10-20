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

await check('Copiar código: el botón copia el código SECOP II del proceso y confirma con «Copiado ✓»', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  await pg.evaluate(() => { window.__copiado = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); });
  const antes = await pg.evaluate(() => { const f = document.querySelector('#bt-results .row'); const b = f.querySelector('[data-copiar-codigo]'); return { hay: !!b, codigo: b && b.getAttribute('data-copiar-codigo'), fichaTiene: [...f.querySelectorAll('.ficha dd')].some(d => b && d.textContent.trim() === b.getAttribute('data-copiar-codigo')) }; });
  assert(antes.hay && antes.codigo && antes.fichaTiene, 'la primera tarjeta debe traer el botón con el mismo código de su ficha: ' + JSON.stringify(antes));
  await pg.click('#bt-results .row [data-copiar-codigo]');
  await pg.waitForFunction(() => window.__copiado !== null);
  const r = await pg.evaluate(() => ({ copiado: window.__copiado, txt: document.querySelector('#bt-results .row [data-copiar-codigo]').textContent }));
  assert(r.copiado === antes.codigo, 'debe copiar el código exacto: ' + r.copiado);
  assert(/Copiado/.test(r.txt), 'el botón confirma la copia: ' + r.txt);
});
await check('Compartir resumen: en computador copia el resumen (entidad, objeto, valor, cierre) y confirma con «Resumen copiado ✓»', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  await pg.evaluate(() => { window.__copiado = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); });
  const dat = await pg.evaluate(() => { const f = document.querySelector('#bt-results .row'); return { ent: f.querySelector('.row-ent').textContent.trim(), hay: !!f.querySelector('[data-compartir]') }; });
  assert(dat.hay, 'la tarjeta debe traer el botón Compartir');
  await pg.click('#bt-results .row [data-compartir]');
  await pg.waitForFunction(() => window.__copiado !== null);
  const r = await pg.evaluate(() => ({ copiado: window.__copiado, txt: document.querySelector('#bt-results .row [data-compartir]').textContent }));
  assert(r.copiado.split('\n')[0] === dat.ent, 'la primera línea es la entidad: ' + r.copiado);
  assert(/Cuantía: \$/.test(r.copiado) && /Cierre: /.test(r.copiado), 'lleva valor y cierre: ' + r.copiado);
  assert(/Resumen copiado/.test(r.txt), 'el botón confirma: ' + r.txt);
});
await check('Deshacer al descartar: Descartar saca la tarjeta, avisa con «Deshacer» y deshacer la devuelve igual que estaba', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  const id = await pg.evaluate(() => document.querySelector('#bt-results .row').dataset.id);
  const total = await pg.evaluate(() => document.querySelectorAll('#bt-results .row').length);
  await pg.click('#bt-results .row[data-id="' + id + '"] [data-action="descartar"]');
  const d = await pg.evaluate((id) => { const a = document.getElementById('bt-deshacer'); return { visible: !a.hidden && getComputedStyle(a).display !== 'none', txt: a.textContent, sigue: !!document.querySelector('#bt-results .row[data-id="' + id + '"]:not(.descartado)'), rol: a.getAttribute('role') }; }, id);
  assert(d.visible && /descartado/i.test(d.txt) && /Deshacer/.test(d.txt) && d.rol === 'status', 'aviso accesible con «Deshacer»: ' + JSON.stringify(d));
  assert(!d.sigue, 'la tarjeta descartada ya no aparece como activa');
  await pg.click('#bt-deshacer button');
  const r = await pg.evaluate((id) => ({ fila: !!document.querySelector('#bt-results .row[data-id="' + id + '"]'), desc: !!document.querySelector('#bt-results .row.descartado'), oculto: document.getElementById('bt-deshacer').hidden, total: document.querySelectorAll('#bt-results .row').length }), id);
  assert(r.fila && !r.desc && r.oculto && r.total === total, 'deshacer devuelve la tarjeta y esconde el aviso: ' + JSON.stringify(r) + ' (antes ' + total + ')');
});
await check('Mis procesos: el resumen de arriba cuenta lo guardado, y desaparece cuando no hay nada guardado', async () => {
  const { pg } = await abrir();
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  const vacio = await pg.evaluate(() => { const r = document.getElementById('bt-pipeline-resumen'); return r.hidden || !r.textContent.trim(); });
  assert(vacio, 'sin procesos guardados no hay resumen');
  await pg.click('#bt-nav-buscar');
  await pg.click('#bt-results .row [data-agregar-pipeline]');
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  const r = await pg.evaluate(() => { const el = document.getElementById('bt-pipeline-resumen'); return { hid: el.hidden, tarjetas: [...el.querySelectorAll('.stat-card')].map(c => c.querySelector('.stat-card-label').textContent + '=' + c.querySelector('.stat-card-value').textContent) }; });
  assert(!r.hid && r.tarjetas.length === 4 && r.tarjetas[0] === 'Guardados=1', 'el resumen muestra 1 guardado: ' + JSON.stringify(r));
  assert(/Novedades en SECOP=(—|0)/.test(r.tarjetas[3]), 'sin respuesta de SECOP no inventa novedades: ' + r.tarjetas[3]);
});
await check('Mis procesos: la tarjeta guardada muestra la modalidad corta y no la etiqueta «SECOP II»', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  const mod = await pg.evaluate(() => { const f = document.querySelector('#bt-results .row'); const dt = [...f.querySelectorAll('.ficha dt')].find(x => x.textContent.trim() === 'Modalidad'); return dt ? dt.nextElementSibling.textContent.trim() : ''; });
  await pg.click('#bt-results .row [data-agregar-pipeline]');
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  const tag = await pg.evaluate(() => { const t = document.querySelector('.pipeline-card .pipeline-card-meta .tag'); return t ? t.textContent.trim() : null; });
  assert(mod && tag && !/SECOP/.test(tag), 'el tag de la tarjeta es la modalidad (' + mod + '), no SECOP: ' + tag);
  assert(mod.toLowerCase().indexOf(tag.toLowerCase().replace('…', '').slice(0, 5)) !== -1 || tag.length <= 28, 'el tag corresponde a la modalidad: ' + mod + ' → ' + tag);
});
await check('Notas propias: agregar en la tarjeta de Mis procesos, se guarda al salir del campo, sobrevive a recargar, Escape cancela y quitar el proceso la borra', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  await pg.click('#bt-results .row [data-agregar-pipeline]');
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  const sinNota = await pg.evaluate(() => { const c = document.querySelector('.pipeline-card'); return { boton: (c.querySelector('[data-nota-editar]') || {}).textContent, texto: !!c.querySelector('.pipeline-card-nota-txt') }; });
  assert(/Agregar nota/.test(sinNota.boton || '') && !sinNota.texto, 'sin nota ofrece «Agregar nota»: ' + JSON.stringify(sinNota));
  await pg.click('.pipeline-card [data-nota-editar]');
  await pg.fill('.pipeline-card textarea', '  Llamar a la entidad el lunes <b>urgente</b>  ');
  await pg.click('#view-procesos h1'); // salir del campo
  const vista = await pg.evaluate(() => { const c = document.querySelector('.pipeline-card'); const t = c.querySelector('.pipeline-card-nota-txt'); return { txt: t && t.textContent, html: t && t.innerHTML, ta: !!c.querySelector('textarea'), boton: c.querySelector('[data-nota-editar]').textContent }; });
  assert(vista.txt === 'Llamar a la entidad el lunes <b>urgente</b>' && /&lt;b&gt;/.test(vista.html) && !vista.ta && /Editar nota/.test(vista.boton), 'la nota queda visible, recortada y escapada: ' + JSON.stringify(vista));
  const guardado = await pg.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bitacora_historial'))).map(h => h.nota));
  assert(guardado.length === 1 && guardado[0] === 'Llamar a la entidad el lunes <b>urgente</b>', 'se guardó en el historial: ' + JSON.stringify(guardado));
  await pg.reload();
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  assert(await pg.evaluate(() => !!document.querySelector('.pipeline-card-nota-txt')), 'la nota sobrevive a recargar la página');
  await pg.click('.pipeline-card [data-nota-editar]');
  await pg.fill('.pipeline-card textarea', 'texto que se descarta');
  await pg.press('.pipeline-card textarea', 'Escape');
  const esc = await pg.evaluate(() => ({ txt: document.querySelector('.pipeline-card-nota-txt').textContent, ta: !!document.querySelector('.pipeline-card textarea') }));
  assert(esc.txt.startsWith('Llamar a la entidad') && !esc.ta, 'Escape cancela sin guardar: ' + JSON.stringify(esc));
  await pg.click('.pipeline-card [data-nota-editar]');
  await pg.fill('.pipeline-card textarea', '   ');
  await pg.click('#view-procesos h1');
  assert(await pg.evaluate(() => !document.querySelector('.pipeline-card-nota-txt')), 'un texto vacío borra la nota');
  await pg.click('.pipeline-card [data-nota-editar]');
  await pg.fill('.pipeline-card textarea', 'borrador a medias');
  await pg.selectOption('.pipeline-card select', 'viable'); // la vista se vuelve a dibujar mientras se escribe
  const bor = await pg.evaluate(() => { const ta = document.querySelector('.pipeline-card-nota-campo'); return { ok: !!ta && ta.value === 'borrador a medias', foco: !!ta && document.activeElement === ta }; });
  assert(bor.ok, 'el borrador de la nota sobrevive a un redibujado de la vista: ' + JSON.stringify(bor));
  await pg.fill('.pipeline-card textarea', 'otra nota');
  await pg.click('#view-procesos h1');
  await pg.click('.pipeline-card [data-pipeline-quitar-id]');
  const resto = await pg.evaluate(() => localStorage.getItem('bitacora_historial') || '');
  assert(!/otra nota/.test(resto), 'quitar el proceso de Mis procesos borra también su nota');
});
await check('Mis procesos: un proceso presentado o no viable ya no muestra el plazo ni «Venció»; uno en decisión sí', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  await pg.click('#bt-results .row [data-agregar-pipeline]');
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  assert(await pg.evaluate(() => !!document.querySelector('.pipeline-card .pipeline-card-plazo')), 'por revisar muestra el plazo');
  for (const etapa of ['presentada', 'no_viable']) {
    await pg.selectOption('.pipeline-card select', etapa);
    const r = await pg.evaluate(() => ({ plazo: !!document.querySelector('.pipeline-card .pipeline-card-plazo'), urgente: !!document.querySelector('.pipeline-card-urgente') }));
    assert(!r.plazo && !r.urgente, etapa + ' no debe mostrar plazo ni alarma: ' + JSON.stringify(r));
  }
  await pg.selectOption('.pipeline-card select', 'viable');
  assert(await pg.evaluate(() => !!document.querySelector('.pipeline-card .pipeline-card-plazo')), 'volver a una etapa activa devuelve el plazo');
});
await check('Mis procesos en celular (375 px): los enlaces de cada tarjeta miden 44 px reales, no se pisan, y «Quitar» queda aparte, a la derecha y debajo de las demás acciones', async () => {
  const ahora = Date.now();
  const f = n => new Date(ahora + n * 86400000).toISOString().slice(0, 19);
  const mk = (cod, etapa, cierre, ent, obj, extra = {}) => ['ps2-CO1.REQ.' + cod, Object.assign({ etapa, etapaTs: ahora, snapshot: { entidad: ent, objeto: obj, closingRaw: cierre, fuente: 'II', valor: 4250000000 + cod * 1000, modalidad: 'Licitación pública', url: 'https://community.secop.gov.co/x' + cod } }, extra)];
  const hist = Object.fromEntries([
    mk(901, 'viable', f(2), 'INSTITUTO DE INFRAESTRUCTURA Y VALORIZACIÓN DE NORTE DE SANTANDER', 'MEJORAMIENTO Y OPTIMIZACIÓN DE LAS REDES DE ALCANTARILLADO EN EL BARRIO EL LÍBANO', { nota: 'Preguntar por el K fijado en $100.000.000.' }),
    mk(902, 'viable', f(20), 'ALCALDÍA DE CÚCUTA', 'CONSTRUCCIÓN DE PAVIMENTO RÍGIDO'),
    mk(903, 'por_revisar', f(5), 'AREA METROPOLITANA DE CUCUTA', 'MANTENIMIENTO VÍA SECUNDARIA ALTO MEJUE - TOLEDO')
  ]);
  const { ctx, pg } = await abrir({ viewport: { width: 375, height: 812 }, hasTouch: true, sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.click('#bt-nav-toggle');
  await pg.click('#bt-nav-procesos');
  await pg.waitForSelector('.pipeline-card');
  const m = await pg.evaluate(() => {
    const out = { bajos: [], tapas: [], quitar: [], desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    document.querySelectorAll('.pipeline-card').forEach(card => {
      const enlaces = [...card.querySelectorAll('button.link-btn, a.link-btn')].filter(el => el.getBoundingClientRect().width > 0);
      enlaces.forEach(el => {
        el.scrollIntoView({ block: 'center' }); // elementFromPoint solo ve lo que está dentro de la pantalla
        const r = el.getBoundingClientRect();
        if (r.height < 43.5) out.bajos.push((el.textContent || '').trim().slice(0, 25) + ' h=' + Math.round(r.height));
        // un toque a 3 px del borde de arriba y de abajo debe caer en el propio botón (no en la zona ampliada de otro)
        [r.top + 3, r.bottom - 3].forEach(y => { const t = document.elementFromPoint(r.left + r.width / 2, y); if (!t || t.closest('button.link-btn, a.link-btn') !== el) out.tapas.push((el.textContent || '').trim().slice(0, 25) + ' y=' + Math.round(y) + ' → ' + (t ? (t.textContent || t.tagName).trim().slice(0, 20) : 'nada')); });
      });
      card.scrollIntoView({ block: 'start' });
      const q = card.querySelector('[data-pipeline-quitar-id]'), otros = enlaces.filter(el => el !== q), rq = q.getBoundingClientRect();
      const abajoDeTodos = otros.every(el => rq.top >= el.getBoundingClientRect().bottom - 1);
      out.quitar.push({ abajo: abajoDeTodos, derecha: Math.round(card.getBoundingClientRect().right - rq.right) <= 20 && rq.left > card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2 });
    });
    return out;
  });
  assert(m.bajos.length === 0, 'enlaces de menos de 44 px: ' + m.bajos.join(' | '));
  assert(m.tapas.length === 0, 'toques en el borde de un botón que caen en otro: ' + m.tapas.join(' | '));
  assert(m.quitar.length === 3 && m.quitar.every(q => q.abajo && q.derecha), '«Quitar» aparte, abajo y a la derecha: ' + JSON.stringify(m.quitar));
  assert(m.desborde <= 0, 'sin desborde horizontal: ' + m.desborde);
  await pg.setViewportSize({ width: 1280, height: 900 });
  const escritorio = await pg.evaluate(() => { const q = document.querySelector('[data-pipeline-quitar-id]'); const a = q.closest('.pipeline-card-acciones').querySelector('[data-pipeline-abrir-id]'); return { quitarVisible: q.getBoundingClientRect().width > 0, mismaFila: Math.abs(q.getBoundingClientRect().top - a.getBoundingClientRect().top) < 60 }; });
  assert(escritorio.quitarVisible, '«Quitar» sigue visible en pantalla ancha');
  await ctx.close();
});
await check('Mis procesos: la entidad y el objeto largos se recortan con «Ver más / Ver menos» (solo si de verdad no caben), se leen completos al abrir y la tarjeta abierta sigue abierta al redibujar', async () => {
  const ahora = Date.now();
  const f = n => new Date(ahora + n * 86400000).toISOString().slice(0, 19);
  const largoEnt = 'INSTITUTO DE INFRAESTRUCTURA Y VALORIZACIÓN DE NORTE DE SANTANDER Y OTRAS ENTIDADES ASOCIADAS PARA EL DESARROLLO REGIONAL FINALIZA-ENT';
  const largoObj = 'MEJORAMIENTO Y OPTIMIZACIÓN DE LAS REDES DE ALCANTARILLADO EN EL BARRIO EL LÍBANO, SECTOR VILLA ESPERANZA, MUNICIPIO DE OCAÑA, DEPARTAMENTO NORTE DE SANTANDER, INCLUYENDO LA CONSTRUCCIÓN DE POZOS DE INSPECCIÓN, CONEXIONES DOMICILIARIAS, ENTIBADOS Y LA REPOSICIÓN DE PAVIMENTO EN LAS VÍAS INTERVENIDAS FINALIZA-OBJ';
  const mk = (cod, ent, obj) => ['ps2-CO1.REQ.' + cod, { etapa: 'viable', etapaTs: ahora, snapshot: { entidad: ent, objeto: obj, closingRaw: f(20), fuente: 'II', valor: 1000000 * cod } }];
  const hist = Object.fromEntries([mk(901, largoEnt, largoObj), mk(902, 'ALCALDÍA DE CÚCUTA', 'PAVIMENTO RÍGIDO')]);
  for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 900 }]) {
    const { ctx, pg } = await abrir({ viewport: vp, sembrar: { bitacora_historial: JSON.stringify(hist) } });
    if (vp.width < 600) await pg.click('#bt-nav-toggle');
    await pg.click('#bt-nav-procesos');
    await pg.waitForSelector('.pipeline-card');
    const est = () => pg.evaluate(() => [...document.querySelectorAll('.pipeline-card')].map(c => {
      const ent = c.querySelector('.pipeline-card-ent-txt'), obj = c.querySelector('.pipeline-card-obj'), b = c.querySelector('[data-pipeline-mas]');
      return { texto: ent.textContent + ' | ' + obj.textContent, recortado: ent.scrollHeight > ent.clientHeight + 1 || obj.scrollHeight > obj.clientHeight + 1, boton: b && !b.hidden ? b.textContent.trim() : null, abierta: c.classList.contains('abierto') };
    }));
    const [larga, corta] = await est();
    assert(larga.boton === 'Ver más' && larga.recortado, vp.width + ' px: la tarjeta larga se recorta y ofrece «Ver más»: ' + JSON.stringify(larga));
    assert(corta.boton === null && !corta.recortado, vp.width + ' px: la corta no muestra el botón: ' + JSON.stringify(corta));
    assert(/FINALIZA-ENT/.test(larga.texto) && /FINALIZA-OBJ/.test(larga.texto), 'el texto completo está en la página (no se corta con «…»)');
    await pg.locator('.pipeline-card [data-pipeline-mas]:visible').first().click();
    const [abierta] = await est();
    assert(abierta.abierta && abierta.boton === 'Ver menos' && !abierta.recortado, vp.width + ' px: abierta se lee completa y el botón dice «Ver menos»: ' + JSON.stringify(abierta));
    assert(await pg.evaluate(() => document.querySelector('[data-pipeline-mas]').getAttribute('aria-expanded')) === 'true', 'aria-expanded = true');
    await pg.check('#bt-pipeline-solo-pronto'); await pg.uncheck('#bt-pipeline-solo-pronto'); // redibuja la vista
    const [trasRedibujar] = await est();
    assert(trasRedibujar.abierta, vp.width + ' px: la tarjeta abierta sigue abierta al redibujar');
    await pg.locator('.pipeline-card [data-pipeline-mas]:visible').first().click();
    const [cerrada] = await est();
    assert(!cerrada.abierta && cerrada.boton === 'Ver más' && cerrada.recortado, vp.width + ' px: «Ver menos» vuelve a recortar');
    await ctx.close();
  }
});
await check('Mis procesos: el filtro «solo los que cierran en 7 días» deja las secciones con los que coinciden, oculta las vacías, avisa «N de M» y se puede quitar', async () => {
  const ahora = Date.now();
  const f = n => new Date(ahora + n * 86400000).toISOString().slice(0, 19);
  const mk = (cod, etapa, cierre, ent) => ['ps2-CO1.REQ.' + cod, { etapa, etapaTs: ahora, snapshot: { entidad: ent, objeto: 'Obra ' + cod, closingRaw: cierre, fuente: 'II' } }];
  const hist = Object.fromEntries([
    mk(901, 'viable', f(2), 'ENTIDAD CERCA'), mk(902, 'viable', f(20), 'ENTIDAD LEJOS'), mk(903, 'por_revisar', f(5), 'OTRA CERCA'),
    mk(904, 'presentada', f(1), 'YA PRESENTADA'), mk(905, 'en_analisis', f(-3), 'VENCIDA')
  ]);
  const { pg } = await abrir({ sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  const todos = await pg.evaluate(() => ({ tarjetas: document.querySelectorAll('.pipeline-card').length, secciones: [...document.querySelectorAll('.pipeline-grupo')].map(s => s.getAttribute('aria-label')) }));
  assert(todos.tarjetas === 5 && todos.secciones.length === 4, 'sin filtro se ven los 5 procesos en 4 secciones: ' + JSON.stringify(todos));
  await pg.check('#bt-pipeline-solo-pronto');
  const r = await pg.evaluate(() => ({ ents: [...document.querySelectorAll('.pipeline-card .pipeline-card-ent')].map(e => e.textContent.trim()).sort(), secciones: [...document.querySelectorAll('.pipeline-grupo')].map(s => s.getAttribute('aria-label')), nota: document.getElementById('bt-pipeline-filtro-nota').textContent.trim() }));
  assert(JSON.stringify(r.ents) === '["ENTIDAD CERCA","OTRA CERCA"]', 'solo los que cierran en ≤7 días y siguen en decisión: ' + JSON.stringify(r.ents));
  assert(JSON.stringify(r.secciones) === '["Por revisar","Viable"]', 'las secciones vacías se ocultan: ' + JSON.stringify(r.secciones));
  assert(/2 de 5/.test(r.nota), 'avisa «2 de 5»: ' + r.nota);
  await pg.uncheck('#bt-pipeline-solo-pronto');
  assert(await pg.evaluate(() => document.querySelectorAll('.pipeline-card').length) === 5, 'al quitar el filtro vuelven todos');
  const hist2 = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bitacora_historial'))).length);
  assert(hist2 === 5, 'filtrar no modifica lo guardado');
});
await check('Mis procesos: si ningún proceso cierra pronto el filtro lo dice y ofrece quitarlo', async () => {
  const ahora = Date.now();
  const hist = { 'ps2-CO1.REQ.911': { etapa: 'viable', etapaTs: ahora, snapshot: { entidad: 'LEJANA', objeto: 'Obra', closingRaw: new Date(ahora + 40 * 86400000).toISOString().slice(0, 19), fuente: 'II' } } };
  const { pg } = await abrir({ sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  await pg.check('#bt-pipeline-solo-pronto');
  const r = await pg.evaluate(() => ({ tarjetas: document.querySelectorAll('.pipeline-card').length, txt: document.getElementById('bt-pipeline-board').textContent }));
  assert(r.tarjetas === 0 && /Ningún proceso guardado cierra en los próximos 7 días/.test(r.txt), 'mensaje de vacío: ' + JSON.stringify(r));
  await pg.click('#bt-pipeline-board [data-quitar-filtro-pronto]');
  assert(await pg.evaluate(() => document.querySelectorAll('.pipeline-card').length === 1 && !document.getElementById('bt-pipeline-solo-pronto').checked), 'quitar el filtro devuelve la lista');
});
await check('Mis procesos: Compartir copia el resumen del proceso guardado y Copiar código copia su código SECOP II (los de hash no lo ofrecen)', async () => {
  const ahora = Date.now();
  const hist = {
    'ps2-CO1.REQ.921': { etapa: 'viable', etapaTs: ahora, snapshot: { entidad: 'ENTIDAD UNO', objeto: 'Construcción de vías', valor: 2500000000, modalidad: 'Licitación pública', closingRaw: new Date(ahora + 4 * 86400000).toISOString().slice(0, 19), fuente: 'II' } },
    'hs2-abc123': { etapa: 'por_revisar', etapaTs: ahora, snapshot: { entidad: 'ENTIDAD HASH', objeto: 'Sin código', fuente: 'II' } }
  };
  const { pg } = await abrir({ sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.evaluate(() => document.getElementById('bt-nav-procesos').click());
  await pg.evaluate(() => { window.__copiado = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copiado.push(t); return Promise.resolve(); } }, configurable: true }); });
  const hay = await pg.evaluate(() => [...document.querySelectorAll('.pipeline-card')].map(c => ({ ent: c.querySelector('.pipeline-card-ent').textContent.trim(), compartir: !!c.querySelector('[data-compartir]'), codigo: (c.querySelector('[data-copiar-codigo]') || {}).dataset ? c.querySelector('[data-copiar-codigo]').dataset.copiarCodigo : null })));
  const uno = hay.find(x => x.ent.startsWith('ENTIDAD UNO')), hash = hay.find(x => x.ent.startsWith('ENTIDAD HASH'));
  assert(uno.compartir && uno.codigo === 'CO1.REQ.921', 'la tarjeta con código ofrece Compartir y Copiar código: ' + JSON.stringify(uno));
  assert(hash.compartir && hash.codigo === null, 'la de hash ofrece Compartir pero no Copiar código: ' + JSON.stringify(hash));
  await pg.click('.pipeline-card:has-text("ENTIDAD UNO") [data-compartir]');
  await pg.waitForFunction(() => window.__copiado.length === 1);
  await pg.click('.pipeline-card:has-text("ENTIDAD UNO") [data-copiar-codigo]');
  await pg.waitForFunction(() => window.__copiado.length === 2);
  const r = await pg.evaluate(() => ({ c: window.__copiado }));
  assert(r.c[1] === 'CO1.REQ.921', 'copió el código exacto: ' + r.c[1]);
  const lineas = r.c[0].split('\n');
  assert(lineas[0] === 'ENTIDAD UNO' && /Construcción de vías/.test(lineas[1]) && /Cuantía: \$2\.500\.000\.000/.test(r.c[0]) && /Cierre: .*\(4 días\)/.test(r.c[0]) && /Modalidad: Licitación pública/.test(r.c[0]), 'resumen del proceso guardado: ' + r.c[0]);
});
await check('Objeto largo: la tarjeta lo resume en 3 líneas y «Ver más» / «Ver menos» lo despliega y lo recoge', async () => {
  const { pg } = await abrir();
  await pg.click('#bt-nav-buscar');
  const r = await pg.evaluate(() => {
    const filas = [...document.querySelectorAll('#bt-results .row')];
    const f = filas.find(x => x.querySelector('.row-obj-mas'));
    if (!f) return { hay: false, truncadas: filas.filter(x => /…$/.test(x.querySelector('.row-obj').textContent)).length };
    const obj = f.querySelector('.row-obj'), b = f.querySelector('.row-obj-mas');
    const antes = { clamp: obj.scrollHeight > obj.clientHeight + 1, exp: b.getAttribute('aria-expanded'), t: b.textContent };
    b.click();
    const despues = { abierto: obj.classList.contains('abierto'), exp: b.getAttribute('aria-expanded'), t: b.textContent, completo: obj.scrollHeight <= obj.clientHeight + 1 };
    b.click();
    return { hay: true, antes, despues, vuelve: !obj.classList.contains('abierto') && b.getAttribute('aria-expanded') === 'false' };
  });
  if (r.hay){
    assert(r.antes.clamp && r.antes.exp === 'false' && r.antes.t === 'Ver más', 'cerrado: recortado y «Ver más»: ' + JSON.stringify(r.antes));
    assert(r.despues.abierto && r.despues.exp === 'true' && r.despues.t === 'Ver menos' && r.despues.completo, 'abierto: texto completo y «Ver menos»: ' + JSON.stringify(r.despues));
    assert(r.vuelve, '«Ver menos» vuelve a recortar');
  } else {
    assert(r.truncadas === 0, 'sin objetos largos, ninguna tarjeta debe mostrar el texto cortado con «…»');
  }
});

await check('Rediseño fase 1: barra superior horizontal (una sola fila, ancho completo, corta) y cabecera azul noche con título blanco', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 } });
  await pg.click('#bt-nav-buscar');
  const m = await pg.evaluate(() => {
    const b = document.querySelector('#bitacora-root .sidebar').getBoundingClientRect();
    const items = [...document.querySelectorAll('#bt-nav .nav-item')].map(i => i.getBoundingClientRect());
    const h = document.querySelector('#view-buscar .view-header');
    const cs = getComputedStyle(h), h1 = getComputedStyle(h.querySelector('h1'));
    const foot = document.getElementById('bt-sidebar-foot').getBoundingClientRect();
    return {
      anchoBarra: b.width, altoBarra: b.height, vw: document.documentElement.clientWidth,
      topes: items.map(r => Math.round(r.top)), foot: { w: foot.width, h: foot.height },
      fondo: cs.backgroundImage, h1: h1.color, hTop: h.getBoundingClientRect().top
    };
  });
  assert(m.anchoBarra >= m.vw - 2, 'la barra debe ocupar todo el ancho: ' + m.anchoBarra + ' de ' + m.vw);
  assert(m.altoBarra <= 96, 'la barra es corta (no una columna lateral): ' + m.altoBarra);
  assert(Math.max(...m.topes) - Math.min(...m.topes) <= 2, 'los ítems del menú van en una sola fila: ' + m.topes.join(','));
  assert(m.foot.w > 0 && m.foot.h > 0, 'el pie con la cuenta sigue visible');
  assert(/gradient/.test(m.fondo), 'la cabecera lleva degradado: ' + m.fondo);
  assert(m.h1 === 'rgb(255, 255, 255)', 'el título de la cabecera es blanco: ' + m.h1);
  assert(m.hTop >= m.altoBarra - 1, 'la cabecera queda debajo de la barra');
  assert(await sinDesborde(pg) <= 0, 'sin desborde horizontal a 1280');
  await ctx.close();
});

await check('Rediseño fase 2: tarjeta sin franja gruesa, botones que se hunden al presionar y filtro de Mis procesos como chip lila al marcarlo', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 } });
  await pg.click('#bt-nav-buscar');
  const borde = await pg.evaluate(() => {
    const r = [...document.querySelectorAll('#bt-results .row')].find(x => !x.classList.contains('vence-pronto') && !x.classList.contains('alta') && !x.classList.contains('media'));
    return r ? getComputedStyle(r).borderLeftWidth : 'sin tarjeta';
  });
  assert(borde === '1px', 'la tarjeta normal no lleva franja gruesa a la izquierda: ' + borde);
  // presionar: el botón se encoge un poco (scale .97) y vuelve al soltar
  const b = pg.locator('#view-buscar .btn-primary').first();
  const caja = await b.boundingBox();
  await pg.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await pg.mouse.down();
  await pg.waitForTimeout(300);
  const escala = await b.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return m.a; });
  await pg.mouse.up();
  assert(escala > 0.95 && escala < 0.99, 'al presionar el botón escala ~0.97: ' + escala);
  // filtro de Mis procesos
  for (let i = 0; i < 2; i++) { await pg.locator('#bt-results [data-agregar-pipeline]').first().click(); await pg.waitForTimeout(150); }
  await pg.click('#bt-nav-procesos');
  const lab = pg.locator('#bt-pipeline-filtro label');
  const antes = await lab.evaluate(el => getComputedStyle(el).backgroundColor);
  await pg.check('#bt-pipeline-solo-pronto');
  await pg.waitForTimeout(350); // termina la transición de color
  const despues = await lab.evaluate(el => getComputedStyle(el).backgroundColor);
  assert(antes !== despues && despues === 'rgb(201, 176, 255)', 'marcado, el filtro se pinta lila: ' + antes + ' → ' + despues);
  assert(await sinDesborde(pg) <= 0, 'sin desborde');
  await ctx.close();
});

await check('Rediseño fase 3: Mis procesos trae las cifras dentro de la cabecera y un calendario de próximos cierres agrupado y ordenado', async () => {
  const p2 = n => String(n).padStart(2, '0');
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(15, 0, 0, 0); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T15:00:00'; }; // n días de calendario, a las 15:00
  const mk = (n, e, etapa) => ({ etapa: etapa || 'por_revisar', etapaTs: 1, snapshot: { closingRaw: dia(n), entidad: e, objeto: 'Obra de ' + e, valor: 100000000 } });
  const hist = { 'ps2-1': mk(1, 'Entidad Mañana'), 'ps2-2': mk(5, 'Entidad Semana'), 'ps2-3': mk(20, 'Entidad Mes'), 'ps2-4': mk(3, 'Entidad Presentada', 'presentada'), 'ps2-5': mk(-4, 'Entidad Vencida') };
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await pg.click('#bt-nav-procesos');
  const r = await pg.evaluate(() => {
    const hero = document.querySelector('#view-procesos .view-header');
    const cal = document.getElementById('bt-pipeline-calendario');
    return {
      resumenEnCabecera: !!hero.querySelector('#bt-pipeline-resumen .stat-card'),
      calVisible: !!cal && !cal.hidden && cal.getBoundingClientRect().height > 0,
      grupos: cal ? [...cal.querySelectorAll('.cal-grupo h3')].map(x => x.textContent.trim()) : [],
      filas: cal ? [...cal.querySelectorAll('.cal-fila')].map(x => x.textContent) : []
    };
  });
  assert(r.resumenEnCabecera, 'las cifras de Mis procesos van dentro de la cabecera azul');
  assert(r.calVisible, 'el calendario de cierres se ve');
  assert(r.grupos.length === 3 && /Mañana/.test(r.grupos[0]) && /7 días/.test(r.grupos[1]) && /30 días/.test(r.grupos[2]), 'grupos: ' + r.grupos.join(' | '));
  assert(r.filas.length === 3 && /Entidad Mañana/.test(r.filas[0]) && /Entidad Semana/.test(r.filas[1]) && /Entidad Mes/.test(r.filas[2]), 'orden por cercanía y sin presentados ni vencidos: ' + r.filas.join(' | '));
  assert(!r.filas.some(f => /Presentada|Vencida/.test(f)), 'no salen presentados ni vencidos');
  // sin procesos con cierre próximo, el calendario no se muestra
  assert(await sinDesborde(pg) <= 0, 'sin desborde a 1280');
  await ctx.close();
  const m = await abrir({ viewport: { width: 375, height: 800 }, hasTouch: true, sembrar: { bitacora_historial: JSON.stringify(hist) } });
  await m.pg.click('#bt-nav-toggle'); await m.pg.click('#bt-nav-procesos');
  assert(await sinDesborde(m.pg) <= 0, 'sin desborde a 375: ' + await sinDesborde(m.pg));
  const alto = await m.pg.evaluate(() => [...document.querySelectorAll('#bt-pipeline-calendario .cal-fila button, #bt-pipeline-calendario .cal-fila a')].map(b => Math.round(b.getBoundingClientRect().height)));
  assert(alto.length && alto.every(a => a >= 44), 'las filas del calendario se tocan con 44 px: ' + alto.join(','));
  await m.ctx.close();
});

await check('Pie de ayuda en Buscar procesos: corto (≤ 600 caracteres visibles) y sin semáforo ni prioridad', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 } });
  await pg.click('#bt-nav-buscar');
  const ps = await pg.evaluate(() => { const f = document.getElementById('bt-footnote'); return f.hidden ? [] : [...f.querySelectorAll('p')].filter(p => !p.hidden).map(p => p.textContent.trim()); });
  assert(ps.length === 1, 'en Buscar el pie tiene un solo párrafo: ' + ps.length);
  const t = ps.join(' ');
  assert(t.length > 0 && t.length <= 400 && /^Fuente:/.test(t), 'el pie de Buscar es solo la nota de la Fuente: ' + t.length + ' · ' + t.slice(0, 60));
  assert(!/semáforo|prioridad|NO-GO/.test(t), 'no menciona funciones que ya no existen: ' + t);
  assert(await sinDesborde(pg) <= 0, 'sin desborde');
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
  assert(grupos.some(g => /analizados antes/i.test(g)), 'debe existir el grupo "Analizados antes": ' + grupos.join(' | '));
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

await check('Rediseño fase 4: el análisis tiene tarjeta de resultado con relieve, secciones como tarjetas con título en tinta, plegables con flecha que gira y panel de evidencia que entra con animación (sin ella al reducir movimiento)', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const r = await pg.evaluate(() => {
    const h = document.querySelector('#bt-analisis-out .resultado-global'), n = document.querySelector('#bt-analisis-out .resultado-nombre');
    const hs = getComputedStyle(h);
    const secs = [...document.querySelectorAll('#bt-analisis-out .analisis-seccion')].map(e => { const c = getComputedStyle(e), t = getComputedStyle(e.querySelector('h3')); return { fondo: c.backgroundColor, borde: c.borderTopWidth, radio: parseFloat(c.borderTopLeftRadius), h3: t.color }; });
    const fold = document.querySelector('#bt-analisis-out details.analysis-fold');
    const antes = getComputedStyle(fold.querySelector('summary'), '::before').transform;
    fold.open = true;
    const abierto = getComputedStyle(fold.querySelector('summary'), '::before').transform;
    return { radio: parseFloat(hs.borderTopLeftRadius), sombra: hs.boxShadow, tam: parseFloat(getComputedStyle(n).fontSize), secs, antes, abierto };
  });
  assert(r.radio >= 14 && r.sombra !== 'none' && r.tam >= 32, 'tarjeta de resultado con radio, sombra y nombre grande: ' + JSON.stringify({ radio: r.radio, sombra: r.sombra, tam: r.tam }));
  assert(r.secs.length >= 3, 'hay secciones: ' + r.secs.length);
  assert(r.secs.every(x => x.fondo === 'rgb(255, 255, 255)' && x.borde === '1px' && x.radio >= 14 && x.h3 === 'rgb(21, 26, 51)'), 'cada sección es una tarjeta blanca con título en tinta: ' + JSON.stringify(r.secs[0]));
  assert(r.antes === 'none' && r.abierto !== 'none', 'la flecha del plegable gira al abrirlo: ' + r.antes + ' → ' + r.abierto);
  const anim = async () => pg.evaluate(() => getComputedStyle(document.querySelector('#bt-evidencia-backdrop .evidencia-panel')).animationName);
  await pg.locator('[data-ev-fila]').first().click();
  await pg.waitForSelector('#bt-evidencia-backdrop:not([hidden])');
  assert(await anim() === 'bt-ev-in', 'el panel de evidencia entra con animación: ' + await anim());
  await pg.keyboard.press('Escape');
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await pg.locator('[data-ev-fila]').first().click();
  await pg.waitForSelector('#bt-evidencia-backdrop:not([hidden])');
  assert(await anim() === 'none', 'al reducir movimiento no hay animación: ' + await anim());
  await ctx.close();
  for (const w of [768, 1280]) {
    const m = await abrir({ viewport: { width: w, height: 900 }, sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
    await abrirAnalisisSembrado(m.pg);
    assert(await sinDesborde(m.pg) <= 0, 'sin desborde a ' + w);
    await m.ctx.close();
  }
});

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
  const cols = await pg.evaluate(() => [...document.querySelectorAll('.matriz-tabla:not(.ficha-tabla) thead th')].map(t => t.textContent));
  assert(cols.join('|') === 'Requisito|Exigencia|Empresa|Resultado|Evidencia', 'columnas de la matriz: ' + cols.join('|'));
  const res = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.matriz-tabla:not(.ficha-tabla) tbody tr')].map(tr => [tr.children[0].textContent.split(':')[0], tr.dataset.resultado])));
  assert(res['Capacidad financiera'] === 'CUMPLE' && res['K residual'] === 'NO CUMPLE' && res['Garantías'] === 'REVISAR' && res['Personal'] === 'NO DETERMINABLE', 'resultados por fila (la cita sin verificar jamás da CUMPLE): ' + JSON.stringify(res));
  const visibles = () => pg.evaluate(() => [...document.querySelectorAll('.matriz-tabla:not(.ficha-tabla) tbody tr')].filter(t => !t.hidden).length);
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

await check('Observaciones: la ficha lista los puntos para preguntar a la entidad (discrepancia del K contra el presupuesto) y descarga el borrador con la entidad, la página y la cifra', async () => {
  const texto = "1.1. OBJETO, PRESUPUESTO OFICIAL, PLAZO Y UBICACIÓN El objeto, presupuesto oficial estimado, plazo y ubicación del proyecto se identifican en la siguiente tabla: Objeto del proyecto ALCANTARILLADO BARRIO EL LIBANO Plazo del contrato Valor presupuesto oficial (pesos incluido IVA) CINCUENTA (50) DIAS $138.776.810,00 Lugar(es) de ejecución del contrato OCAÑA. 3.6 CALCULO LA CAPACIDAD RESIDUAL DEL PROPONENTE. El Proponente debe acreditar una capacidad residual o K de Contratación igual o superior al presupuesto oficial: $100.000.000 El proponente debe presentar un certificado.";
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado({ text: texto, paginaOffsets: [{ pagina: 1, hasta: texto.length }] })) }) });
  await abrirAnalisisSembrado(pg);
  const bloque = await pg.evaluate(() => { const b = document.querySelector('#bt-analisis-out [data-ficha-obs-bloque]'); return b ? { resumen: b.querySelector('summary').textContent, items: b.querySelectorAll('ol li').length, botones: b.querySelectorAll('[data-ficha-obs]').length } : null; });
  assert(bloque && /punto\(s\) para preguntar a la entidad/.test(bloque.resumen) && bloque.items >= 1 && bloque.botones === 2, 'bloque de observaciones: ' + JSON.stringify(bloque));
  await pg.setViewportSize({ width: 375, height: 800 });
  await pg.locator('#bt-analisis-out [data-ficha-obs-bloque] summary').click();
  const med = await pg.evaluate(() => ({ desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth, botones: [...document.querySelectorAll('#bt-analisis-out [data-ficha-obs]')].map(b => Math.round(b.getBoundingClientRect().height)) }));
  assert(med.desborde <= 0, 'sin desborde horizontal a 375 px: ' + med.desborde);
  assert(med.botones.every(h => h >= 44), 'botones de al menos 44 px de alto en celular: ' + med.botones.join(','));
  const tabla = await pg.evaluate(() => {
    const sec = document.querySelector('#bt-analisis-out [data-ficha-seccion]');
    const wrap = sec.querySelector('.ficha-scroll'), hint = sec.querySelector('.ficha-desliza');
    // La cifra del K debe quedar en UNA línea (un rectángulo), no partida letra por letra.
    const td = [...sec.querySelectorAll('td')].find(c => /\$100\.000\.000/.test(c.textContent));
    let rects = null;
    if (td){ const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())){ const i = n.nodeValue.indexOf('$100.000.000'); if (i >= 0){ const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 12); rects = r.getClientRects().length; break; } } }
    return { rects: rects, scroll: wrap.scrollWidth - wrap.clientWidth, sombra: /gradient/.test(getComputedStyle(wrap).backgroundImage), aviso: getComputedStyle(hint).display };
  });
  assert(tabla.rects === 1, 'la cifra $100.000.000 no se parte en varias líneas: ' + tabla.rects);
  assert(tabla.scroll > 0 && tabla.sombra && tabla.aviso !== 'none', 'la tabla se desplaza, con sombra y aviso visible en celular: ' + JSON.stringify(tabla));
  await pg.setViewportSize({ width: 1280, height: 900 });
  const avisoEscritorio = await pg.evaluate(() => getComputedStyle(document.querySelector('#bt-analisis-out .ficha-desliza')).display);
  assert(avisoEscritorio === 'none', 'el aviso de desplazamiento no se muestra en pantalla ancha: ' + avisoEscritorio);
  await pg.setViewportSize({ width: 375, height: 800 });
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.locator('#bt-analisis-out [data-ficha-obs="descargar"]').click()]);
  assert(/^observaciones-.*\.txt$/.test(dl.suggestedFilename()), 'nombre: ' + dl.suggestedFilename());
  const cuerpo = await readFile(await dl.path(), 'utf8');
  assert(/Alcaldía E2E/.test(cuerpo) && /\$100\.000\.000/.test(cuerpo) && /\$138\.776\.810/.test(cuerpo) && /Solicitamos/.test(cuerpo) && /Empresa A/.test(cuerpo), 'el borrador trae entidad, cifras, solicitud y la empresa: ' + cuerpo.slice(0, 300));
  await ctx.close();
});
await check('Análisis en celular (375 px): los puntos de «Decisión» apilan etiqueta y texto (el texto usa casi todo el ancho) y los botones, filtros y secciones plegables miden al menos 44 px', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 375, height: 812 }, hasTouch: true, sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await pg.click('#bt-nav-toggle'); // en celular el menú va plegado
  await abrirAnalisisSembrado(pg);
  const m = await pg.evaluate(() => {
    const raiz = document.querySelector('#bt-analisis-out');
    const items = [...raiz.querySelectorAll('.decision-lista .alerta-item')].map(li => {
      const [a, b] = li.children, ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rl = li.getBoundingClientRect();
      return { apilado: rb.top >= ra.bottom - 1, anchoTexto: Math.round(100 * rb.width / rl.width) };
    });
    const bajos = [...raiz.querySelectorAll('button.link-btn, .matriz-filtro, .analysis-fold > summary')].filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < 43.5).map(el => (el.textContent || '').trim().slice(0, 35) + ' h=' + Math.round(el.getBoundingClientRect().height));
    return { items: items, bajos: bajos, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  assert(m.items.length >= 2, 'hay puntos de decisión: ' + m.items.length);
  assert(m.items.every(i => i.apilado && i.anchoTexto >= 85), 'etiqueta arriba y texto a casi todo el ancho: ' + JSON.stringify(m.items));
  assert(m.bajos.length === 0, 'controles de menos de 44 px: ' + m.bajos.join(' | '));
  assert(m.desborde <= 0, 'sin desborde horizontal: ' + m.desborde);
  // Matriz de requisitos: las palabras y las cifras no se parten, «Ver evidencia» cabe en una línea y la tabla avisa que se desliza.
  const mx = await pg.evaluate(() => {
    const t = document.querySelector('#bt-analisis-out .matriz-req'); const w = t.closest('.expeval-table-wrap');
    const lineas = (celda, texto) => { const wk = document.createTreeWalker(celda, NodeFilter.SHOW_TEXT); let n; while ((n = wk.nextNode())){ const i = n.nodeValue.indexOf(texto); if (i >= 0){ const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + texto.length); return r.getClientRects().length; } } return null; };
    const celdaTexto = txt => [...t.querySelectorAll('td')].find(c => c.textContent.includes(txt));
    const ev = t.querySelector('[data-ev-fila]').getBoundingClientRect();
    const hint = w.previousElementSibling;
    return { palabra: lineas(celdaTexto('financiera:'), 'financiera:'), cifra: lineas(celdaTexto('5.000.000.000'), '5.000.000.000'), evAncho: Math.round(ev.width), evAlto: Math.round(ev.height),
      scroll: w.scrollWidth - w.clientWidth, sombra: /gradient/.test(getComputedStyle(w).backgroundImage), aviso: hint && hint.classList.contains('ficha-desliza') ? getComputedStyle(hint).display : 'sin aviso' };
  });
  assert(mx.palabra === 1 && mx.cifra === 1, 'palabras y cifras de la matriz sin partir: ' + JSON.stringify(mx));
  assert(mx.evAlto <= 50 && mx.evAncho >= 75, '«Ver evidencia» en una sola línea: ' + mx.evAncho + 'x' + mx.evAlto);
  assert(mx.scroll > 0 && mx.sombra && mx.aviso !== 'none' && mx.aviso !== 'sin aviso', 'la matriz se desplaza con sombra y aviso: ' + JSON.stringify(mx));
  await pg.setViewportSize({ width: 1280, height: 900 });
  const esc = await pg.evaluate(() => { const w = document.querySelector('#bt-analisis-out .matriz-req').closest('.expeval-table-wrap'); return { scroll: w.scrollWidth - w.clientWidth, aviso: getComputedStyle(w.previousElementSibling).display }; });
  assert(esc.scroll <= 0 && esc.aviso === 'none', 'en pantalla ancha la matriz no cambia: ' + JSON.stringify(esc));
  await ctx.close();
});
await check('Informe del análisis: la tarjeta de decisión baja un Word con el análisis sin botones ni filtros; el PDF abre una ventana imprimible', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const dec = await pg.evaluate(() => { const d = document.querySelector('#bt-analisis-out [data-decision]'); return d ? { h3: d.querySelector('h3').textContent, botones: d.querySelectorAll('[data-informe-doc]').length } : null; });
  assert(dec && /^Decisión: /.test(dec.h3) && dec.botones === 2, 'la tarjeta de decisión trae los 2 botones: ' + JSON.stringify(dec));
  const [word] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.locator('#bt-analisis-out [data-informe-doc="word"]').click()]);
  assert(/^analisis-.*\.doc$/.test(word.suggestedFilename()), 'nombre del Word: ' + word.suggestedFilename());
  const ruta = await word.path();
  const html = (await readFile(ruta, 'utf8'));
  assert(/Decisión: /.test(html) && /Resumen de viabilidad/.test(html) && /Orientativo/.test(html) && /Fuente: /.test(html), 'el informe trae decisión, viabilidad, aviso y fuente');
  assert(!/<button/i.test(html) && !/data-matriz-filtro/.test(html), 'sin botones ni filtros');
  const [popup] = await Promise.all([pg.waitForEvent('popup', { timeout: 8000 }), pg.locator('#bt-analisis-out [data-informe-doc="pdf"]').click()]);
  await popup.waitForLoadState('domcontentloaded');
  const titulo = await popup.title();
  assert(/^Análisis de proceso/.test(titulo), 'ventana imprimible: ' + titulo);
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Evidencia: el panel lateral muestra requisito, exigencia, fuente, página, cita textual y dato de la empresa; abre la página del documento; Escape lo cierra y devuelve el foco', async () => {
  const { ctx, pg } = await abrir({ sembrar: Object.assign(empresaAn(), { bitacora_analisis_pliegos: JSON.stringify(analisisSembrado()) }) });
  await abrirAnalisisSembrado(pg);
  const boton = pg.locator('.matriz-tabla:not(.ficha-tabla) tbody tr', { hasText: 'Índice de liquidez' }).locator('[data-ev-fila]');
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
  const sinVer = pg.locator('.matriz-tabla:not(.ficha-tabla) tbody tr', { hasText: 'Director de obra' }).locator('[data-ev-fila]');
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

await check('Ficha del pliego con el Formato Maestro y el personal de la empresa: el cruce de experiencia muestra un resumen corto con la lista de contratos plegada («Ver los contratos»), los cargos de personal se cruzan con «Personal», y en celular el control mide 44 px y la página no se ensancha', async () => {
  const fix = JSON.parse(await readFile(join(RAIZ, 'tests', 'fixtures', 'imrd-lp-pdfjs.json'), 'utf8'));
  const texto = Array.from({ length: fix.total }, (_, i) => fix.paginas[String(i + 1)] || '').join('\n');
  const cods = ['30191500', '22101500', '40141700', '30111600', '30131500', '30131600', '30102400', '40171600'];
  const contratos = Array.from({ length: 14 }, (_, i) => ({ fila: i + 1, numeroContrato: 'FM-' + (i + 1), objeto: 'CONSTRUCCION DE OBRA CIVIL NUMERO ' + (i + 1), contratante: 'ALCALDIA X', valor: 800000000 + i * 1000000, participacion: { valor: 100, unidad: '%' }, enEjecucion: false,
    formatoMaestro: { estado: 'Terminado', unspsc: i % 2 ? cods : [], cantidades: [], enRup: i % 3 ? 'si' : '' } }));
  const entrada = { 'E2E-IMRD': { id: 'E2E-IMRD', ts: Date.now(), fileName: 'imrd.pdf', pagesRead: fix.total, numPages: fix.total, text: texto,
    proceso: { entidad: 'IMRD Cúcuta', objeto: 'Mantenimiento de parques', modalidad: 'Licitación pública', valor: 600000000, closingRaw: new Date(Date.now() + 14 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa de prueba', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100 } };
  const sem = {
    bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa de prueba', nit: '900', k: '', kResidual: '', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']),
    bitacora_experiencia_evaluacion: JSON.stringify({ porPerfil: { p1: { contratos: { headers: [], cols: {}, contratos, fuente: 'formato-maestro' }, meta: { fileName: 'fm.xlsx' } } } }),
    bitacora_perfiles_profesionales: JSON.stringify({ q1: { nombre: 'Marta Ruiz', cargo: 'Directora de proyectos', formacion: 'Ingeniera civil', anos: '22', especializaciones: 'Especialización en gerencia de proyectos', experiencia: '', competencias: '' } }), bitacora_personal_activo_id: 'q1',
    bitacora_analisis_pliegos: JSON.stringify(entrada)
  };
  for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const { ctx, pg } = await abrir({ viewport: vp, sembrar: sem });
    if (vp.width < 600) await pg.click('#bt-nav-toggle');
    await pg.click('#bt-nav-documentos');
    await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-IMRD"]').click();
    await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .ficha-tabla'));
    const f = await pg.evaluate(() => {
      const fila = n => [...document.querySelectorAll('#bt-analisis-out .ficha-tabla tbody tr')].find(tr => tr.children[0] && tr.children[0].textContent.trim() === n);
      const celda = n => { const tr = fila(n); return tr ? tr.children[tr.children.length - 1] : null; };
      const exp = celda('Experiencia general: contratos'), per = celda('Ingeniero civil y/o arquitecto, especialista en gerencia de proyectos'), det = exp && exp.querySelector('details.ficha-det');
      const sum = det && det.querySelector('summary');
      return { badgeExp: exp && exp.querySelector('.tag, .badge, [class*="estado"]') ? exp.querySelector('.tag, .badge, [class*="estado"]').textContent.trim() : (exp ? exp.textContent.trim().slice(0, 40) : null),
        visible: exp ? (exp.querySelector(':scope > .saved-note') || {}).textContent : null, det: !!det, abierto: det ? det.open : null, resumenDet: sum ? sum.textContent.trim() : null, alto: sum ? Math.round(sum.getBoundingClientRect().height) : null,
        dentro: det ? det.textContent : '', personal: per ? per.textContent.replace(/\s+/g, ' ').trim().slice(0, 260) : null, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(f.det && f.abierto === false && f.resumenDet === 'Ver los contratos', 'lista plegada: ' + JSON.stringify(f).slice(0, 300));
    assert(f.visible && f.visible.length < 900 && /^Con tus 14 contratos: 14 terminados/.test(f.visible) && !/Por confirmar:/.test(f.visible), 'resumen visible corto: ' + (f.visible || '').slice(0, 200));
    assert(/Por confirmar:/.test(f.dentro), 'dentro del plegable va la lista: ' + f.dentro.slice(0, 120));
    assert(/REVISAR/.test(f.personal) && /Marta Ruiz/.test(f.personal) && /22 años declarados frente a 20/.test(f.personal), 'personal cruzado: ' + f.personal);
    if (vp.width < 600) assert(f.alto >= 44, 'el control mide ' + f.alto + ' px (se piden 44)');
    assert(f.desborde <= 0, 'la página no debe ensancharse: ' + f.desborde + ' px en ' + vp.width);
    assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
    await ctx.close();
  }
});

await check('Indicadores en la ficha: con los componentes del balance una empresa deriva liquidez y endeudamiento (cumple) y las rentabilidades (0,02 y 0,015 contra 0,10: NO CUMPLE); sin consorcio ni ponderación', async () => {
  const fix = JSON.parse(await readFile(join(RAIZ, 'tests', 'fixtures', 'imrd-lp-pdfjs.json'), 'utf8'));
  const texto = Array.from({ length: fix.total }, (_, i) => fix.paginas[String(i + 1)] || '').join('\n');
  const kDe = c => ['Activo corriente = ' + c.AC, 'Pasivo corriente = ' + c.PC, 'Activo total = ' + c.AT, 'Pasivo total = ' + c.PT, 'Patrimonio = ' + c.PAT, 'Utilidad operacional = ' + c.UO, 'Gastos de intereses = ' + c.GI].join('\n');
  const A = { AC: 600e6, PC: 60e6, AT: 800e6, PT: 200e6, UO: 12e6, GI: 4e6, PAT: 600e6 }, B = { AC: 700e6, PC: 70e6, AT: 700e6, PT: 70e6, UO: 350e6, GI: 50000, PAT: 630e6 }, C = { AC: 950e6, PC: 3e6, AT: 1100e6, PT: 210e6, UO: 90e6, GI: 0, PAT: 890e6 };
  const perfiles = (conPct) => ({ pa: { nombre: 'Empresa A', nit: '1', k: kDe(A), kResidual: '', rup: '', participacion: conPct ? '10' : '' }, pb: { nombre: 'Empresa B', nit: '2', k: kDe(B), kResidual: '', rup: '', participacion: conPct ? '40' : '' }, pc: { nombre: 'Empresa C', nit: '3', k: kDe(C), kResidual: '', rup: '', participacion: conPct ? '50' : '' } });
  const entrada = { 'E2E-IND': { id: 'E2E-IND', ts: Date.now(), fileName: 'imrd.pdf', pagesRead: fix.total, numPages: fix.total, text: texto,
    proceso: { entidad: 'IMRD Cúcuta', objeto: 'Mantenimiento de parques', modalidad: 'Licitación pública', valor: 600000000, closingRaw: new Date(Date.now() + 14 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa A', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100 } };
  const leer = async (sem) => {
    const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: sem });
    await pg.click('#bt-nav-documentos');
    await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-IND"]').click();
    await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .ficha-tabla'));
    const filas = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#bt-analisis-out .ficha-tabla tbody tr')].filter(tr => tr.children.length > 1).map(tr => [tr.children[0].textContent.trim(), tr.children[tr.children.length - 1].textContent.replace(/\s+/g, ' ').trim()])));
    assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
    return { filas, ctx, pg };
  };
  // 1) Empresa A sola
  let r = await leer({ bitacora_perfiles_empresa: JSON.stringify({ pa: perfiles(false).pa }), bitacora_perfil_activo_id: 'pa', bitacora_perfiles_activos: JSON.stringify(['pa']), bitacora_analisis_pliegos: JSON.stringify(entrada) });
  assert(/NO CUMPLE/.test(r.filas['Rentabilidad del patrimonio']) && /0,02/.test(r.filas['Rentabilidad del patrimonio']), 'A sola, patrimonio: ' + r.filas['Rentabilidad del patrimonio']);
  assert(/NO CUMPLE/.test(r.filas['Rentabilidad del activo']) && /0,015/.test(r.filas['Rentabilidad del activo']), 'A sola, activo: ' + r.filas['Rentabilidad del activo']);
  assert(/CUMPLE/.test(r.filas['Índice de liquidez']) && !/NO CUMPLE/.test(r.filas['Índice de liquidez']) && /CUMPLE/.test(r.filas['Índice de endeudamiento']), 'A sola cumple liquidez y endeudamiento derivados del balance');
  await r.ctx.close();
  // 2) Dos empresas marcadas: se usa la mejor SOLA (no hay consorcio ni ponderación)
  r = await leer({ bitacora_perfiles_empresa: JSON.stringify(perfiles(false)), bitacora_perfil_activo_id: 'pa', bitacora_perfiles_activos: JSON.stringify(['pa', 'pb']), bitacora_analisis_pliegos: JSON.stringify(entrada) });
  assert(!/consorcio|ponder/i.test(r.filas['Rentabilidad del patrimonio']), 'sin consorcio: ' + r.filas['Rentabilidad del patrimonio']);
  assert(await r.pg.evaluate(() => !document.getElementById('bt-perfil-participacion')), 'el campo de participación ya no existe');
  await r.ctx.close();
});

await check('Matrices y anexos: la Matriz 2 cargada (PDF escaneado, texto real) completa la ficha del documento base CCE: 5 indicadores cruzados con la empresa (rentabilidad del patrimonio NO CUMPLE) y desaparece el aviso de «Matriz 2 no publicada»', async () => {
  const lee = async nombre => JSON.parse(await readFile(join(RAIZ, 'tests', 'fixtures', nombre), 'utf8'));
  const base = await lee('puerto-santander-pdfjs.json'), m2 = await lee('matriz2-cce-pdfjs.json');
  const unir = f => Array.from({ length: f.total }, (_, i) => f.paginas[String(i + 1)] || '').join('\n');
  const kDe = c => ['Activo corriente = ' + c.AC, 'Pasivo corriente = ' + c.PC, 'Activo total = ' + c.AT, 'Pasivo total = ' + c.PT, 'Patrimonio = ' + c.PAT, 'Utilidad operacional = ' + c.UO, 'Gastos de intereses = ' + c.GI].join('\n');
  const D = { AC: 649046318, PC: 53554509, AT: 737303721, PT: 183768204, PAT: 553535517, UO: 9648701, GI: 3860257 };
  const entrada = conAnexos => ({ 'E2E-M2': Object.assign({ id: 'E2E-M2', ts: Date.now(), fileName: 'docbase.pdf', pagesRead: base.total, numPages: base.total, text: unir(base),
    proceso: { entidad: 'Alcaldía de Puerto Santander', objeto: 'Mantenimiento y rehabilitación de vías', modalidad: 'Selección abreviada de menor cuantía', valor: 451999714, closingRaw: new Date(Date.now() + 14 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa de prueba', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100 }, conAnexos ? { anexos: [{ nombre: 'MATRIZ_2.pdf', texto: unir(m2), paginaOffsets: [] }] } : {}) });
  const leer = async conAnexos => {
    const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa de prueba', k: kDe(D), kResidual: '', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']), bitacora_analisis_pliegos: JSON.stringify(entrada(conAnexos)) } });
    await pg.click('#bt-nav-documentos');
    await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-M2"]').click();
    await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .ficha-tabla'));
    const filas = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#bt-analisis-out .ficha-tabla tbody tr')].filter(tr => tr.children.length > 1).map(tr => [tr.children[0].textContent.trim(), tr.children[tr.children.length - 1].textContent.replace(/\s+/g, ' ').trim()])));
    const texto = await pg.evaluate(() => document.getElementById('bt-analisis-out').textContent);
    const slot = await pg.evaluate(() => !!document.querySelector('#bt-analisis-out input[type=file][data-anexos-id]'));
    assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
    await ctx.close();
    return { filas, texto, slot };
  };
  const sin = await leer(false);
  assert(!sin.filas['Rentabilidad del patrimonio'] && /Matriz 2/.test(sin.texto), 'sin la matriz: avisa que falta y no inventa indicadores');
  const con = await leer(true);
  assert(/NO CUMPLE/.test(con.filas['Rentabilidad del patrimonio']) && /0,0174/.test(con.filas['Rentabilidad del patrimonio']), 'patrimonio: ' + con.filas['Rentabilidad del patrimonio']);
  assert(/CUMPLE/.test(con.filas['Índice de liquidez']) && !/NO CUMPLE/.test(con.filas['Índice de liquidez']), 'liquidez: ' + con.filas['Índice de liquidez']);
  assert(!/remiten a la «Matriz 2»/.test(con.texto), 'con la matriz ya no debe decir que no está publicada');
  assert(/PDF escaneado/.test(con.texto), 'debe avisar que se leyó de un PDF escaneado');
  assert(con.slot, 'el espacio para cargar matrices y anexos existe');
});

await check('Experiencia por tramos (documento base CCE de infraestructura social): la ficha cruza el Formato Maestro y propone la mejor combinación de contratos (polideportivo + aula educativa), REVISAR y nunca CUMPLE', async () => {
  const fix = JSON.parse(await readFile(join(RAIZ, 'tests', 'fixtures', 'cementerio-cucuta-pdfjs.json'), 'utf8'));
  const texto = Array.from({ length: fix.total }, (_, i) => fix.paginas[String(i + 1)] || '').join('\n');
  const mk = (num, objeto, esp, ini, fin, valor, part) => ({ numeroContrato: num, objeto: objeto, contratante: 'X', valor: valor, participacion: { valor: part, unidad: '%', raw: part + ' %' }, fechaInicio: ini, fechaFin: fin, enEjecucion: false,
    formatoMaestro: { estado: 'Terminado', unspsc: ['72101500'], cantidades: [], enRup: 'si', especialidad: esp } });
  const contratos = [mk('LPNS-015-02', 'CONSTRUCCION POLIDEPORTIVO Y PARQUE INFANTIL', 'Edificaciones deportivas y recreativas', '2002-10-28', '2003-03-01', 379318000, 100),
    mk('214/2014', 'CONSTRUCCION BATERIA SANITARIA Y AULA DE CLASE EN LA INSTITUCION EDUCATIVA', 'Edificaciones educativas', '2015-01-05', '2015-03-03', 163147838, 10),
    mk('ALC-1', 'RECUPERACION DE LA RED DE ALCANTARILLADO', 'Alcantarillado', '2011-02-01', '2012-02-01', 1968000000, 60)];
  const entrada = { 'E2E-CEM': { id: 'E2E-CEM', ts: Date.now(), fileName: 'docbase.pdf', pagesRead: fix.total, numPages: fix.total, text: texto,
    proceso: { entidad: 'Alcaldía de Cúcuta', objeto: 'Obras del Cementerio Central', modalidad: 'Selección abreviada de menor cuantía', valor: 250000000, closingRaw: new Date(Date.now() + 10 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa de prueba', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100 } };
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: {
    bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa de prueba', nit: '900', k: '', kResidual: '', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']),
    bitacora_experiencia_evaluacion: JSON.stringify({ porPerfil: { p1: { contratos: { headers: [], cols: {}, contratos, fuente: 'formato-maestro' }, meta: { fileName: 'fm.xlsx' } } } }),
    bitacora_analisis_pliegos: JSON.stringify(entrada) } });
  await pg.click('#bt-nav-documentos');
  await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-CEM"]').click();
  await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .ficha-tabla'));
  const t = await pg.evaluate(() => { const tr = [...document.querySelectorAll('#bt-analisis-out .ficha-tabla tbody tr')].find(x => x.children[0] && x.children[0].textContent.trim() === 'Experiencia general: contratos'); return tr ? tr.children[tr.children.length - 1].textContent.replace(/\s+/g, ' ').trim() : null; });
  assert(t && /REVISAR/.test(t) && !/CUMPLE\s*Con tus/.test(t), 'estado de la experiencia: ' + (t || '').slice(0, 200));
  assert(/LPNS-015-02/.test(t) && /214\/2014/.test(t) && !/ALC-1 \(/.test(t.split('Mejor combinación')[1] || ''), 'la combinación usa el polideportivo y el aula, no el alcantarillado: ' + (t || '').slice(0, 700));
  assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
  await ctx.close();
});

await check('Tamaño de empresa (RUP): el selector del perfil se guarda, y una microempresa cruza la Matriz 2 con los umbrales Mipyme (rentabilidad del activo CUMPLE, la del patrimonio sigue sin cumplir) y los indicadores del RUP', async () => {
  const lee = async nombre => JSON.parse(await readFile(join(RAIZ, 'tests', 'fixtures', nombre), 'utf8'));
  const base = await lee('puerto-santander-pdfjs.json'), m2 = await lee('matriz2-cce-pdfjs.json');
  const unir = f => Array.from({ length: f.total }, (_, i) => f.paginas[String(i + 1)] || '').join('\n');
  const kDe = ['Activo corriente = 649046318', 'Pasivo corriente = 53554509', 'Activo total = 737303721', 'Pasivo total = 183768204', 'Patrimonio = 553535517', 'Utilidad operacional = 9648701', 'Gastos de intereses = 3860257'].join('\n');
  const entrada = { 'E2E-TAM': { id: 'E2E-TAM', ts: Date.now(), fileName: 'docbase.pdf', pagesRead: base.total, numPages: base.total, text: unir(base), anexos: [{ nombre: 'MATRIZ_2.pdf', texto: unir(m2), paginaOffsets: [] }],
    proceso: { entidad: 'Alcaldía de Puerto Santander', objeto: 'Mantenimiento de vías', modalidad: 'Selección abreviada de menor cuantía', valor: 451999714, closingRaw: new Date(Date.now() + 14 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa de prueba', hallazgosAnotados: [] }], redFlags: [], viabilidad: 100 } };
  const leer = async tam => {
    const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa de prueba', k: kDe, kResidual: '', rup: '', tamanoEmpresa: tam } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']), bitacora_analisis_pliegos: JSON.stringify(entrada) } });
    await pg.click('#bt-nav-documentos');
    await pg.locator('#bt-docs-out [data-abrir-proceso="E2E-TAM"]').click();
    await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .ficha-tabla'));
    const filas = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#bt-analisis-out .ficha-tabla tbody tr')].filter(tr => tr.children.length > 1).map(tr => [tr.children[0].textContent.trim(), tr.children[tr.children.length - 1].textContent.replace(/\s+/g, ' ').trim()])));
    assert(pg.errores.length === 0, 'errores de JS: ' + pg.errores.join(' | '));
    await ctx.close();
    return filas;
  };
  const micro = await leer('microempresa');
  assert(/CUMPLE/.test(micro['Rentabilidad del activo']) && !/NO CUMPLE/.test(micro['Rentabilidad del activo']) && /Mipyme/.test(micro['Rentabilidad del activo']), 'microempresa, activo: ' + micro['Rentabilidad del activo']);
  assert(/NO CUMPLE/.test(micro['Rentabilidad del patrimonio']), 'microempresa, patrimonio: ' + micro['Rentabilidad del patrimonio']);
  const grande = await leer('grande');
  assert(/NO CUMPLE/.test(grande['Rentabilidad del activo']), 'gran empresa, activo: ' + grande['Rentabilidad del activo']);
  const sin = await leer('');
  assert(/NO DETERMINABLE/.test(sin['Rentabilidad del activo']), 'sin tamaño, activo: ' + sin['Rentabilidad del activo']);
  // El selector del perfil se guarda
  const { ctx, pg } = await abrir({ viewport: { width: 1280, height: 900 }, sembrar: { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa de prueba', k: '', kResidual: '', rup: '' } }), bitacora_perfil_activo_id: 'p1', bitacora_perfiles_activos: JSON.stringify(['p1']) } });
  await pg.click('#bt-nav-empresa');
  await pg.selectOption('#bt-perfil-tamano', 'pequena');
  await pg.click('#bt-perfil-save');
  await pg.waitForTimeout(300);
  const guardado = await pg.evaluate(() => JSON.parse(localStorage.getItem('bitacora_perfiles_empresa')).p1.tamanoEmpresa);
  assert(guardado === 'pequena', 'tamaño guardado: ' + guardado);
  await pg.reload();
  await pg.waitForTimeout(800);
  await pg.click('#bt-nav-empresa');
  assert(await pg.evaluate(() => document.getElementById('bt-perfil-tamano').value) === 'pequena', 'el selector recuerda el tamaño al volver a abrir el perfil');
  await ctx.close();
});

await navegador.close();
servidor.close();
console.log('\n' + ok + ' ok, ' + fallos + ' fallo(s).');
process.exit(fallos ? 1 : 0);
