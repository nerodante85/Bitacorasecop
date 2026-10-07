// Sonda con datos EN VIVO de SECOP II (auditoría 2026-10-07): la app real busca LP-008-2026 y se compara su ficha con el registro oficial.
// El navegador del sandbox no sale a internet, así que las peticiones a datos.gov.co se resuelven con curl (proxy del entorno) y se sirven a la página.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const rutas = [process.env.PLAYWRIGHT_NODE_MODULES, '/opt/node-tools/node_modules'].filter(Boolean);
let pw; for (const n of ['playwright-core', 'playwright']) { try { pw = require(require.resolve(n, { paths: rutas })); break; } catch (e) {} }
const servidor = http.createServer(async (req, res) => {
  try { const r = decodeURIComponent(new URL(req.url, 'http://x').pathname); const a = join(RAIZ, r === '/' ? 'index.html' : r); const c = await readFile(a);
    res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' }[extname(a)] || 'application/octet-stream' }); res.end(c); }
  catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const consultas = [];
await ctx.route('**/*', async ruta => {
  const u = ruta.request().url();
  if (u.startsWith(BASE)) return ruta.continue();
  if (/^https:\/\/www\.datos\.gov\.co\//.test(u)) {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS' };
    if (ruta.request().method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
    try { const cuerpo = execFileSync('curl', ['-sS', '-m', '40', u], { maxBuffer: 64 * 1024 * 1024 }); consultas.push(decodeURIComponent(u).slice(0, 220)); return ruta.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: cuerpo }); }
    catch (e) { return ruta.abort(); }
  }
  return ruta.abort();
});
const pg = await ctx.newPage();
const errores = []; pg.on('pageerror', e => errores.push(e.message));
await pg.goto(BASE + '/index.html');
await pg.waitForTimeout(1500);
await pg.evaluate(() => document.getElementById('bt-nav-buscar').click());
await pg.evaluate(() => { const i = document.getElementById('bt-proceso'); i.value = 'LP-008-2026'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.evaluate(() => document.getElementById('bt-search').click());
await pg.waitForFunction(() => document.querySelectorAll('#bt-results .row').length > 0 || /SIN RESULTADOS/.test(document.getElementById('bt-results').innerText), null, { timeout: 90000 });
const r = await pg.evaluate(() => ({
  filas: document.querySelectorAll('#bt-results .row').length,
  primera: (document.querySelector('#bt-results .row') || { innerText: '' }).innerText.replace(/\n+/g, ' | '),
  aviso: (document.getElementById('bt-data-freshness') || {}).innerText, estado: (document.getElementById('bt-count') || {}).innerText
}));
console.log('consultas a datos.gov.co:', consultas.length); consultas.slice(0, 3).forEach(c => console.log('  ' + c));
console.log('filas:', r.filas, '| contador:', r.estado, '| frescura:', r.aviso);
console.log('FICHA:', r.primera);
console.log('errores JS:', JSON.stringify(errores));
await nav.close(); servidor.close();
