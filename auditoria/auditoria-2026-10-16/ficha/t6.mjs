import { e } from './lib.mjs';
const g = (n,t)=>{ const f=e.fichaHabilitante(t,{anio:2026}); console.log('\n### '+n); f.filas.filter(x=>x.grupo==='Garantías').forEach(x=>console.log('  '+x.requisito+' | '+x.exige+' | '+x.cifras)); };
g('RC tabla tramos', 'Responsabilidad civil extracontractual. El valor asegurado será: contratos con valor hasta 1.500 SMMLV: 200 SMMLV; contratos entre 1.501 y 2.500 SMMLV: 300 SMMLV; mayores a 2.500 SMMLV: 400 SMMLV.');
g('RC valor contrato en smmlv antes', 'La póliza de responsabilidad civil extracontractual debe cubrir un valor asegurado equivalente al 10% del valor del contrato, y en todo caso no inferior a 200 SMMLV.');
g('RC prosa', 'Para contratos de valor superior a 1.500 SMMLV, la póliza de responsabilidad civil extracontractual deberá ser de 300 SMMLV.');
