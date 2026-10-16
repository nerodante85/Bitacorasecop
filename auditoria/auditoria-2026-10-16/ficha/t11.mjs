import { show, e } from './lib.mjs';
const P = 'El presupuesto oficial es de $3.185.389.625. El plazo de ejecución del contrato será de CUATRO (4) MESES. No se otorgará anticipo. ';
show('split 0,0 3', P+'ÍNDICES ÍNDICE REQUERIDO Rentabilidad del Patrimonio ≥ 0,0 6 ≥ 0,0 3 Mipyme Rentabilidad del activo ≥ 0,0 2');
show('cobertura 1,0 5', P+'INDICADOR PARÁMETRO EXIGIDO Índice de liquidez ≥ 1,0 5 Índice de endeudamiento ≤ 0,6 5 Razón de cobertura de intereses ≥ 1,5', {liquidez:1.2, endeudamiento:0.66});
