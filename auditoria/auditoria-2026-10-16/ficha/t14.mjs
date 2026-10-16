import { e } from './lib.mjs';
for (const s of ['Mínimo 500 SMMLV (equivalente al 50% del presupuesto oficial de 1.000 SMMLV)','sumatoria igual o superior a 2.000 SMMLV, y cada contrato no inferior a 300 SMMLV']) console.log(s,'=>',JSON.stringify(e.parseValorUnidad(s)));
const r = e.construirRequisitoDesdeTexto('Experiencia específica: la sumatoria de los contratos deberá ser igual o superior a 2.000 SMMLV, y cada contrato no inferior a 300 SMMLV, en obras de pavimentación', 0, {});
console.log(JSON.stringify(r.minValor), r.condicionNoModelada||'');
