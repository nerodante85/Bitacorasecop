import { expEngine as E } from './harness.mjs';
for (const s of ['2.500 millones','2500 millones de pesos','$2.500.000.000','15.320 SMMLV','1,5 mil millones','K residual = 1.200.000.000','Capacidad residual de contratación: 1.200.000.000 COP (2022)','capacidad residual 3.500.000.000 vigente hasta 2025','K residual 800 SMMLV','2.500.000.000 / 1.428 SMMLV','K residual: $ 450 millones','1.200.000','N/A','0','-']) {
  console.log(JSON.stringify(s), '=>', JSON.stringify(E.parseValorUnidad(s)));
}
