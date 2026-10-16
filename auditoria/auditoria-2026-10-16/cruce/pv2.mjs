import { expEngine as E } from './harness.mjs';
for (const s of ['$2.500.000.000 (1.428 SMMLV)','1.428 SMMLV ($2.500.000.000)','K residual: 1.428 SMMLV equivalente a $2.500.000.000','Capacidad residual: $2.500.000.000 COP equivalentes a 1.428 salarios mínimos','K residual 2.500.000.000 pesos (SMMLV 2024)', 'K residual: 1.200 SMMLV (año 2023: 1.160.000)']) {
  console.log(JSON.stringify(s), '=>', JSON.stringify(E.parseValorUnidad(s)));
}
