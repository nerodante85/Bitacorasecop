import { show, e } from './lib.mjs';
const P = 'El presupuesto oficial es de $3.185.389.625. El plazo de ejecución del contrato será de CUATRO (4) MESES. No se otorgará anticipo. ';
const M = (l1,l2,e1,e2)=> P+'1. Índices de capacidad financiera y organizacional para Mipyme. Indicador Rango 1 Rango 2 Índice de liquidez ≥1,2 ≥1,3 Índice de endeudamiento ≤0,70 ≤0,75 2. Índices de capacidad financiera y organizacionales para los demás Proponentes Indicador Rango 1 Rango 2 Índice de liquidez ≥'+l1+' ≥'+l2+' Índice de endeudamiento ≤'+e1+' ≤'+e2+' Los indicadores definidos en este numeral';
show('matriz2 coma', M('1,3','1,4','0,70','0,75'), {liquidez:1.35, endeudamiento:0.6});
show('matriz2 punto', M('1.3','1.4','0.70','0.75'), {liquidez:1.35, endeudamiento:0.8});
