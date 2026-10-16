import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'experiencia_especifica', descripcion:'Experiencia en puentes vehiculares', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:'puentes vehiculares', naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Experiencia específica: acreditar 2 contratos de puentes vehiculares, cada uno con un valor igual o superior a $3.000.000.000.';
const offs=[{pagina:1,hasta:T.length}];
const contratos = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],
  ['Construcción de puentes vehiculares A', 2000000000, '2024-06-01'], ['Construcción de puentes vehiculares B', 2000000000, '2024-06-01']] } }).contratos;
for (const ac of [false, true]){
  const v = E.verificarFilasIA([fila({min_contratos:2, valor_minimo_numero:3000000000, valor_minimo_unidad:'COP', acumulable:ac, cita_textual:T.slice(24)})], T, offs)[0];
  const ev = E.evaluarExperienciaCompleta(contratos, E.requisitosDeExperienciaDesdeIA([v]), new Date('2026-06-01T00:00:00'));
  console.log('acumulable='+ac, 'verificada', v.verificada, '->', ev.resultados[0].resultado);
}
// regla SMMLV mal asignada: no se coteja con la cita
const T2 = 'Experiencia específica: 1 contrato de puentes vehiculares por valor mínimo de 3.000 SMMLV, convertidos con el salario mínimo vigente a la fecha de inicio del contrato.';
const offs2=[{pagina:1,hasta:T2.length}];
for (const regla of ['fecha_inicio','fecha_terminacion', null]){
  const v = E.verificarFilasIA([fila({min_contratos:1, valor_minimo_numero:3000, valor_minimo_unidad:'SMMLV', regla_conversion_smmlv:regla, cita_textual:T2.slice(24)})], T2, offs2)[0];
  console.log('regla', regla, 'verificada', v.verificada, E.motivoBloqueoFilaIA(v));
}
// "máximo" tomado como mínimo
const T3 = 'Se podrán presentar máximo 3 contratos para acreditar la experiencia en puentes vehiculares.';
const v3 = E.verificarFilasIA([fila({categoria:'experiencia_especifica', min_contratos:3, cita_textual:T3})], T3, [{pagina:1,hasta:T3.length}])[0];
console.log('max 3 como min 3: verificada', v3.verificada, '| bloqueo:', E.motivoBloqueoFilaIA(v3));
const T4 = 'Experiencia específica: acreditar contratos de puentes vehiculares cuya sumatoria sea igual o superior a $3.000.000.000.';
const v4 = E.verificarFilasIA([fila({min_contratos:null, valor_minimo_numero:3000000000, valor_minimo_unidad:'COP', acumulable:null, cita_textual:T4.slice(24)})], T4, [{pagina:1,hasta:T4.length}])[0];
const ev4 = E.evaluarExperienciaCompleta(contratos, E.requisitosDeExperienciaDesdeIA([v4]), new Date('2026-06-01T00:00:00'));
console.log('sumatoria con acumulable=null ->', ev4.resultados[0].resultado, '|', ev4.resultados[0].justificacion.slice(0,160));
