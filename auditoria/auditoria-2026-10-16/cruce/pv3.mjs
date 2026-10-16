import { expEngine as E } from './harness.mjs';
for (const s of ['K residual 2022: 3.000.000.000; 2023: 1.500.000.000','K residual 1.500.000.000 (antes de contratos en ejecución: 3.000.000.000)','Capacidad residual: 1.500.000.000. Contrato en ejecución saldo 4.000.000.000']) console.log(JSON.stringify(s),'=>',JSON.stringify(E.parseValorUnidad(s)));
// ficha-style: rules for Excel "Valor" cell weirdness
