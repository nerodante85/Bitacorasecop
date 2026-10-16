import { expEngine as e } from './h.mjs';
const show = (n, txt, emp, ctx={anio:2026}) => {
  const f = e.fichaHabilitante(txt, ctx);
  console.log('\n### '+n);
  f.filas.forEach(x=>console.log('  ['+x.grupo+'] '+x.requisito+' | '+x.exige+' | '+x.cifras+(x.aviso?' | AVISO:'+x.aviso:'')+(x.dato&&x.dato.demas?' | dato.demas='+JSON.stringify(x.dato.demas)+' mi='+JSON.stringify(x.dato.mipyme):'')));
  f.avisos.forEach(a=>console.log('  aviso: '+a.slice(0,160)));
  if (emp) { const c = e.cruceFichaEmpresa(f.filas, emp); Object.entries(c).forEach(([k,v])=>console.log('  CRUCE '+k+' => '+v.estado+' :: '+v.detalle)); }
};
const base = 'El presupuesto oficial es de $3.185.389.625. El plazo de ejecución del contrato será de CUATRO (4) MESES. No se otorgará anticipo. ';
// 1 decimal con punto
show('INDICADOR dot decimal', base+'INDICADOR PARÁMETRO EXIGIDO Índice de liquidez ≥ 1.5 Índice de endeudamiento ≤ 0.70 Razón de cobertura de intereses ≥ 2.0 Rentabilidad del patrimonio ≥ 0.05', {liquidez:2.0, endeudamiento:0.8, cobertura:3});
// endeudamiento en porcentaje
show('endeud %', base+'INDICADOR PARÁMETRO EXIGIDO Índice de liquidez ≥ 1,5 Índice de endeudamiento ≤ 70% Razón de cobertura de intereses ≥ 2', {liquidez:2.0, endeudamiento:0.8, cobertura:3});
// endeud "menor o igual" palabras
show('palabras', base+'INDICADOR PARÁMETRO EXIGIDO Índice de liquidez Mayor o igual a 1,5 Índice de endeudamiento Menor o igual a 0,7', {liquidez:1, endeudamiento:0.9});
// signos ASCII
show('ascii >=', base+'INDICADOR PARÁMETRO EXIGIDO Índice de liquidez >= 1,5 Índice de endeudamiento <= 0,7', {liquidez:1, endeudamiento:0.9});
