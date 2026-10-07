// Sondas de interfaz (auditoría 2026-10-07): lo que VE el usuario en el análisis de un proceso.
// Siembra análisis guardados (sin llamar a la IA real) y lee el DOM de la app real servida en local, sin red externa.
// Uso: PLAYWRIGHT_NODE_MODULES=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium node auditoria/AUDITORIA-2026-10-07/sondas/sondas-ui.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const require = createRequire(import.meta.url);
const rutas = [process.env.PLAYWRIGHT_NODE_MODULES, '/opt/node-tools/node_modules'].filter(Boolean);
let pw; for (const n of ['playwright-core', 'playwright']) { try { pw = require(require.resolve(n, { paths: rutas })); break; } catch (e) {} }
const servidor = http.createServer(async (req, res) => {
  try { const r = decodeURIComponent(new URL(req.url, 'http://x').pathname); const a = join(RAIZ, r === '/' ? 'index.html' : r); const c = await readFile(a); res.writeHead(200, { 'content-type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(c); }
  catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });

async function abrir(sembrar) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', ruta => ruta.request().url().startsWith(BASE) ? ruta.continue() : ruta.abort());
  await ctx.addInitScript(({ items }) => { try { if (!localStorage.getItem('__s')) { Object.keys(items).forEach(k => localStorage.setItem(k, items[k])); localStorage.setItem('__s', '1'); } } catch (e) {} }, { items: sembrar });
  const pg = await ctx.newPage();
  pg.errores = []; pg.on('pageerror', e => pg.errores.push((e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
  await pg.goto(BASE + '/index.html');
  await pg.waitForFunction(() => document.querySelectorAll('#bt-results .row').length > 0, null, { timeout: 20000 });
  return { ctx, pg };
}
const EMPRESA = { bitacora_perfiles_empresa: JSON.stringify({ p1: { nombre: 'Empresa A', nit: '900', k: 'Liquidez = 2,0\nEndeudamiento = 0,4', kResidual: 'K residual = 3.000.000.000', rup: '' } }), bitacora_perfiles_activos: JSON.stringify(['p1']) };
const textoPliego = 'Pagina 1. Indice de liquidez mayor o igual a 1,2. Indice de endeudamiento menor o igual a 0,70. Capital de trabajo mayor o igual al 40% del presupuesto oficial. Rentabilidad del patrimonio mayor o igual a 0,15. Garantia de seriedad del 10%.';
const base = (id, extra) => ({
  [id]: Object.assign({
    id, ts: Date.now(), fileName: 'documento.pdf', pagesRead: 1, numPages: 1, text: textoPliego, paginaOffsets: [{ pagina: 1, hasta: textoPliego.length }],
    proceso: { entidad: 'Municipio AUD', objeto: 'Construcción de puente', modalidad: 'Licitación pública Obra Publica', valor: 1500000000, closingRaw: new Date(Date.now() + 20 * 864e5).toISOString(), fuente: 'II', modo: 'vivo', ts: Date.now() },
    comps: [{ perfilNombre: 'Empresa A', hallazgosAnotados: [] }], redFlags: [],
    exigencias: { liquidez: { valor: 1.2, raw: 'Indice de liquidez mayor o igual a 1,2', porcentaje: false }, endeudamiento: { valor: 0.7, raw: 'Indice de endeudamiento menor o igual a 0,70', porcentaje: false } },
    experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, totalObligatorios: 1,
      resultados: [{ requisito: { id: 'r1', obligatoriedad: 'obligatorio', criterio: 'Experiencia específica en puentes', fuente: 'Pliego', pagina: 1 }, resultado: 'CUMPLE', contratosEvaluados: [{ fila: 1, objeto: 'Puente vehicular', valor: 900000000 }], evidencia: [], justificacion: 'Cumple.', faltantes: [] }] }
  }, extra)
});
async function leer(sembrado, id) {
  const { ctx, pg } = await abrir(Object.assign({}, EMPRESA, { bitacora_analisis_pliegos: JSON.stringify(sembrado) }));
  await pg.click('#bt-nav-documentos');
  await pg.locator('#bt-docs-out [data-abrir-proceso="' + id + '"]').click();
  try { await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .resultado-nombre'), null, { timeout: 8000 }); } catch (e) { console.log('DEBUG errores=' + JSON.stringify(pg.errores) + ' vista=' + await pg.evaluate(() => (document.getElementById('bt-analisis-out') || {}).innerText.slice(0, 600))); throw e; }
  const r = await pg.evaluate(() => ({
    nombre: document.querySelector('.resultado-nombre').textContent.trim(), expl: document.querySelector('.resultado-expl').textContent.trim(),
    areas: Object.fromEntries([...document.querySelectorAll('.viabilidad-tabla tbody tr')].map(tr => [tr.children[0].textContent.trim(), tr.children[1].textContent.replace(/^[^A-ZÁÉÍÓÚ]*/, '').trim()])),
    alertas: [...document.querySelectorAll('.alertas-analisis .alerta-item')].map(a => a.textContent.trim().slice(0, 160)),
    filas: [...document.querySelectorAll('.matriz-tabla tbody tr')].map(tr => tr.children[0].textContent.trim().slice(0, 60) + ' => ' + tr.dataset.resultado),
    banner: /Estudio Previo/.test(document.querySelector('#bt-analisis-out .analysis-resumen').innerText) ? 'menciona Estudio Previo en el resumen' : 'NO menciona Estudio Previo en el resumen',
    tituloAnalisis: (document.querySelector('#bt-analisis-out .analysis-head, #bt-analisis-out .analysis-titulo') || {}).textContent
  }));
  await ctx.close();
  return r;
}
const imprimir = (id, titulo, r, veredictoMalo) => console.log('[' + id + '] ' + (veredictoMalo ? 'HALLAZGO' : 'OK') + ' -- ' + titulo + '\n      resultado=' + r.nombre + ' | ' + r.expl + '\n      áreas=' + JSON.stringify(r.areas) + '\n      alertas=' + JSON.stringify(r.alertas) + '\n      matriz=' + JSON.stringify(r.filas) + '\n      ' + r.banner);

// UI-01: solo Estudio Previo (no hay pliego), todo lo extraído en verde
let r = await leer(base('AUD-EP', { esSoloEP: true }), 'AUD-EP');
imprimir('UI-01', 'Análisis basado SOLO en el Estudio Previo con todo lo evaluado en verde', r, r.nombre === 'GO');
// UI-02: pliego por texto con capital de trabajo, rentabilidad y garantía detectados pero no evaluados
r = await leer(base('AUD-TXT', { comps: [{ perfilNombre: 'Empresa A', hallazgosAnotados: [
  { trigger: 'patrimonio', categoria: 'Capacidad K / Financiera', snippet: 'Capital de trabajo mayor o igual al 40% del presupuesto oficial' },
  { trigger: 'rentabilidad del patrimonio', categoria: 'Capacidad Organizacional', snippet: 'Rentabilidad del patrimonio mayor o igual a 0,15' }] }] }), 'AUD-TXT');
imprimir('UI-02', 'Pliego por texto: capital de trabajo y rentabilidad exigidos y detectados, sin gate; garantía sin comparar', r, r.nombre === 'GO');
// UI-03: trazabilidad de un umbral leído por texto: ¿qué muestra "Ver evidencia" (documento, página, cita)?
{
  const id = 'AUD-TXT';
  const { ctx, pg } = await abrir(Object.assign({}, EMPRESA, { bitacora_analisis_pliegos: JSON.stringify(base(id, {})) }));
  await pg.click('#bt-nav-documentos');
  await pg.locator('#bt-docs-out [data-abrir-proceso="' + id + '"]').click();
  await pg.waitForFunction(() => !!document.querySelector('#bt-analisis-out .resultado-nombre'));
  const fila = pg.locator('.matriz-tabla tbody tr', { hasText: 'Índice de liquidez' }).first();
  await fila.getByRole('button', { name: /evidencia/i }).click();
  await pg.waitForTimeout(400);
  const panel = await pg.evaluate(() => { const p = document.querySelector('.evidencia-panel, #bt-evidencia, [role=dialog], aside'); return p ? p.innerText.replace(/\n+/g, ' | ').slice(0, 700) : 'sin panel'; });
  const conPagina = /p[áa]g(ina)?\.?\s*\d+/i.test(panel);
  console.log('[UI-03] ' + (conPagina ? 'OK' : 'HALLAZGO') + ' -- Umbral leído por texto: "Ver evidencia" indica la página del documento\n      panel=' + panel);
  await ctx.close();
}
await nav.close(); servidor.close();
