// Genera municipios.json (municipio -> departamento) desde DIVIPOLA (DANE, datos.gov.co gdxc-w37w).
// Uso: node scripts/generar-municipios.mjs   (necesita internet; el resultado se sube al repo)
// Un nombre que existe en más de un departamento (Caldas, Belén, Santa María...) queda en null: la app no lo adivina.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = (await import(pathToFileURL(path.join(ROOT, 'coincidencia.js')).href)).default;
const res = await fetch('https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000&$select=dpto,nom_mpio');
if (!res.ok) throw new Error('HTTP ' + res.status);
const filas = await res.json();
if (filas.length < 1000) throw new Error('DIVIPOLA incompleto: ' + filas.length);
// Nombres de departamento TAL COMO los escribe SECOP II (así la app los compara y los muestra igual), y pares
// municipio/departamento del propio dataset: cubren los nombres de uso común que DIVIPOLA escribe distinto
// («Cúcuta» frente a «SAN JOSÉ DE CÚCUTA»). La consulta agrupa millones de filas y tarda ~20 s: es normal.
const rd = await fetch('https://www.datos.gov.co/resource/p6dx-8zbt.json?$select=ciudad_entidad,departamento_entidad&$group=ciudad_entidad,departamento_entidad&$limit=5000');
if (!rd.ok) throw new Error('HTTP ' + rd.status);
const pares = (await rd.json()).filter(f => f.ciudad_entidad && f.departamento_entidad);
const nombreSecop = {};
pares.forEach(f => { nombreSecop[C.normalizeGeo(f.departamento_entidad)] = f.departamento_entidad; });
nombreSecop[C.normalizeGeo('Bogotá, D.C.')] = nombreSecop[C.normalizeGeo('Distrito Capital de Bogotá')] || 'Distrito Capital de Bogotá';
const bonito = s => s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && /^(de|del|y|la|las|los)$/.test(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const depSecop = d => nombreSecop[C.normalizeGeo(d)] || bonito(d);
const filasDane = filas.map(f => ({ ciudad_entidad: f.nom_mpio, departamento_entidad: depSecop(f.dpto) }));
const mapa = C.mapaMunicipios(filasDane.concat(pares));
const ordenado = {};
Object.keys(mapa).sort().forEach(k => { ordenado[k] = mapa[k]; });
writeFileSync(path.join(ROOT, 'municipios.json'), JSON.stringify(ordenado));
console.log('municipios:', Object.keys(ordenado).length, '| ambiguos:', Object.keys(ordenado).filter(k => ordenado[k] === null).length);
