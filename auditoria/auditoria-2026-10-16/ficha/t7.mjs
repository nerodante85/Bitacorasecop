import { e } from './lib.mjs';
const g = (n,t)=>{ const f=e.fichaHabilitante(t,{anio:2026}); console.log('\n### '+n); f.filas.filter(x=>x.grupo==='Garantías').forEach(x=>console.log('  '+x.requisito+' | '+x.exige+' | '+x.cifras)); };
g('RC inferior a', 'Responsabilidad civil extracontractual: para contratos cuyo valor sea inferior a 1.500 SMMLV, el valor asegurado será de 200 SMMLV.');
g('RC menor igual', 'La póliza de responsabilidad civil extracontractual, si el contrato es menor o igual a 1.500 SMMLV, tendrá un valor asegurado de 200 SMMLV.');
