import { readFileSync } from 'node:fs';
import { expEngine as E } from './h.mjs';
for (const k of ['A','B','C','D']) {
  const pags = JSON.parse(readFileSync(k + '.json'));
  const t = pags.join('\n');
  const f = E.fichaHabilitante(t, { anio: 2026 });
  console.log('\n================ DOC ' + k + ' (' + pags.length + ' págs) — ' + f.filas.length + ' filas, ' + f.avisos.length + ' avisos, ' + (f.observaciones||[]).length + ' obs');
  f.filas.forEach(x => console.log(` [${x.grupo}] ${x.requisito} | ${String(x.exige).slice(0,150)} | ${String(x.cifras).slice(0,110)} | p.${x.pagina||'-'}${x.aviso?' | AVISO: '+x.aviso.slice(0,120):''}`));
  f.avisos.forEach(a => console.log('  aviso: ' + a.slice(0,220)));
}
