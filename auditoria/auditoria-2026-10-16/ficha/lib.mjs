import { expEngine as e } from './h.mjs';
export const show = (n, txt, emp, ctx={anio:2026}) => {
  const f = e.fichaHabilitante(txt, ctx);
  console.log('\n### '+n);
  f.filas.forEach(x=>console.log('  ['+x.grupo+'] '+x.requisito+' | '+x.exige+' | '+x.cifras+(x.aviso?' | AVISO:'+x.aviso.slice(0,100):'')+(x.dato&&x.dato.demas?' | demas='+JSON.stringify(x.dato.demas)+' mi='+JSON.stringify(x.dato.mipyme):'')));
  f.avisos.forEach(a=>console.log('  aviso: '+a.slice(0,200)));
  f.observaciones.forEach(a=>console.log('  obs: '+a.tema));
  if (emp) { const c = e.cruceFichaEmpresa(f.filas, emp); Object.entries(c).forEach(([k,v])=>console.log('  CRUCE '+k+' => '+v.estado+' :: '+v.detalle)); }
  return f;
};
export { e };
