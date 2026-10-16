import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'experiencia_especifica', descripcion:'Experiencia en puentes vehiculares', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:'puentes vehiculares', naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Experiencia específica 1: el proponente deberá acreditar mínimo 1 contrato de puentes vehiculares. Experiencia específica 2: el proponente deberá acreditar mínimo 3 contratos de acueductos urbanos de obra civil. ';
const offs = [{ pagina: 1, hasta: T.length }];
const c1 = 'el proponente deberá acreditar mínimo 1 contrato de puentes vehiculares';
const c2 = 'el proponente deberá acreditar mínimo 3 contratos de acueductos urbanos de obra civil';
const contratos = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],
  ['Construcción de puentes vehiculares A', 3600000000, '2024-06-01']] } }).contratos;
function run(nombre, filas){
  const ver = E.verificarFilasIA(filas, T, offs);
  console.log(nombre, ver.map(v=>v.verificada?'V':'x:'+v.motivoVerificacion).join(' | '));
  const reqs = E.requisitosDeExperienciaDesdeIA(ver);
  const ev = E.evaluarExperienciaCompleta(contratos, reqs, new Date('2026-06-01T00:00:00'));
  console.log('  global:', ev.resultadoGlobal, ev.resultados.map(r=>r.resultado).join(','));
  const e = {id:'p', requisitosIA:{filas:ver}}; E.setExpevalContratos({contratos, headers:[], cols:{}}); E.aplicarRequisitosIAaEntry(e);
  console.log('  entry global:', e.experienciaResultado && e.experienciaResultado.resultadoGlobal);
}
run('control (ambas habilitantes)', [fila({min_contratos:1, cita_textual:c1}), fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:c2})]);
run('2a mal etiquetada informativo', [fila({min_contratos:1, cita_textual:c1}), fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:c2, naturaleza:'informativo'})]);
run('2a mal etiquetada opcional (cita sin marcadores)', [fila({min_contratos:1, cita_textual:c1}), fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:c2, obligatoriedad:'opcional'})]);
const c3 = 'el proponente podrá acreditar mínimo 3 contratos de acueductos urbanos de obra civil';
const T3 = T.replace(c2, c3);
const ver = E.verificarFilasIA([fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:c3, obligatoriedad:'opcional'})], T3, offs);
console.log('opcional con "podrá":', ver[0].verificada, E.motivoBloqueoFilaIA(ver[0]));
console.log('--- extra');
// fila inventada (cita no existe) etiquetada alternativa/opcional y no verificada
const inv = fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:'cita que no existe en el pdf nunca 3 contratos acueductos urbanos', obligatoriedad:'alternativo'});
const ver2 = E.verificarFilasIA([fila({min_contratos:1, cita_textual:c1}), inv], T, offs);
console.log(ver2.map(v=>v.verificada));
const reqs2 = E.requisitosDeExperienciaDesdeIA(ver2);
const ev2 = E.evaluarExperienciaCompleta(contratos, reqs2, new Date('2026-06-01T00:00:00'));
console.log('alternativo sin grupo no verificado -> global', ev2.resultadoGlobal, ev2.resultados.map(r=>r.resultado), 'grupos', JSON.stringify(ev2.grupos.map(g=>g.resultado)));
// El motivo de bloqueo de la fila 'opcional' sin marcadores
const ver3 = E.verificarFilasIA([fila({min_contratos:3, objeto_literal:'acueductos urbanos', descripcion:'acueductos', cita_textual:c2, obligatoriedad:'opcional'})], T, offs);
console.log('motivo bloqueo opcional sin marcadores:', E.motivoBloqueoFilaIA(ver3[0]));
