import { expEngine as e } from './h.mjs';
const f = e.fichaHabilitante('El presupuesto oficial es de $3.185.389.625. El plazo de ejecución del contrato será de CUATRO (4) MESES. Índice de liquidez mayor o igual a 1,5', {anio:2026});
console.log(JSON.stringify(f.filas.map(x=>[x.requisito,x.exige,x.cifras]),null,1));
