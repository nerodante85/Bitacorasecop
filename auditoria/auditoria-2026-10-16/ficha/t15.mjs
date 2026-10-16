import { e } from './lib.mjs';
const r = e.construirRequisitoDesdeTexto('Experiencia específica: la sumatoria de los contratos deberá ser igual o superior a 2.000 SMMLV, y cada contrato no inferior a 300 SMMLV, en obras de pavimentación', 0, {});
console.log(Object.entries(r).filter(([k,v])=>v!=null&&v!==''&&!(Array.isArray(v)&&!v.length)).map(([k,v])=>k+'='+JSON.stringify(v).slice(0,120)).join('\n'));
const hoy=new Date('2026-10-16');
const c=[{objeto:'pavimentación vía', valor:700000000*3, valorActualizado:false, fechaInicio:'2023-01-01', fechaFin:'2023-12-01', numeroContrato:'A'}];
try{ const ev=e.evaluarRequisito(r,c,hoy,{anio:2026}); console.log(ev.resultado, ev.justificacion);}catch(x){console.log('err',x.message)}
