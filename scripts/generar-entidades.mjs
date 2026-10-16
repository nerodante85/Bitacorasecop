// Genera entidades.json (codigo_entidad -> departamento) desde SECOP II (p6dx-8zbt). El PAA (9sue-ezhx) no trae
// departamento pero sí `codigo_entidad`, el mismo código que SECOP II: con este mapa la búsqueda del PAA por
// departamento se hace por CÓDIGO (antes se cruzaba por nombre de entidad y encontraba 6 de 88 planeaciones).
// Uso: node scripts/generar-entidades.mjs   (necesita internet; la consulta agrupa millones de filas y tarda ~1 min)
// Una entidad con más de un departamento real (sin contar «No Definido») queda fuera: la app no lo adivina.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const url = 'https://www.datos.gov.co/resource/p6dx-8zbt.json?$select=' + encodeURIComponent('codigo_entidad,departamento_entidad,count(*) as n') +
  '&$group=codigo_entidad,departamento_entidad&$limit=50000';
const res = await fetch(url);
if (!res.ok) throw new Error('HTTP ' + res.status);
const filas = await res.json();
if (filas.length < 5000) throw new Error('Respuesta incompleta: ' + filas.length + ' pares');
const porCodigo = {};
filas.forEach(f => {
  const cod = String(f.codigo_entidad || '').trim();
  const dep = String(f.departamento_entidad || '').trim();
  if (!/^\d+$/.test(cod) || !dep || /^no\s*definido$/i.test(dep)) return;
  (porCodigo[cod] = porCodigo[cod] || new Set()).add(dep);
});
const mapa = {};
let ambiguos = 0;
Object.keys(porCodigo).sort().forEach(c => {
  const ds = [...porCodigo[c]];
  if (ds.length === 1) mapa[c] = ds[0]; else ambiguos++;
});
writeFileSync(path.join(ROOT, 'entidades.json'), JSON.stringify(mapa));
console.log('entidades:', Object.keys(mapa).length, '| ambiguas (omitidas):', ambiguos);
