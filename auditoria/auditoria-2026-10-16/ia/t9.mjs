import { expEngine as E } from './harness.mjs';
const T='Cierre de presentación de ofertas: 15 de noviembre de 2026 a las 10:00 a.m. Audiencia de adjudicación: 20 de noviembre de 2026.';
const f={evento:'Cierre de ofertas', fecha:'25 de noviembre de 2026', hora:'3:00 p.m.', documento:'Pliego de Condiciones', pagina:1, cita_textual:'Cierre de presentación de ofertas: 15 de noviembre de 2026 a las 10:00 a.m.'};
const v=E.verificarFilasIA([f],T,[{pagina:1,hasta:T.length}])[0];
console.log('cronograma con fecha/hora distintas a la cita -> verificada:', v.verificada, v.tipoVerificacion);
// pagina fuera: cita real en p.2 declarada p.3
const T2 = 'a'.repeat(50)+' '; 
const offs=[{pagina:1,hasta:10},{pagina:2,hasta:20},{pagina:3,hasta:30},{pagina:4,hasta:T.length+30}];
const tx = 'x'.repeat(30)+T;
const v2=E.verificarFilasIA([Object.assign({},f,{fecha:'15 de noviembre de 2026',hora:'10:00 a.m.',pagina:6})],tx,offs)[0];
console.log('pagina declarada 6, cita en p.4:', v2.verificada, v2.motivoVerificacion);
