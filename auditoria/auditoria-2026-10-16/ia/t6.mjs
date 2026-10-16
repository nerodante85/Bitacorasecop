import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
// 1) heredarConfirmaciones: indicador/naturaleza/obligatoriedad/objeto cambian
const C = 'Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6.';
const previa = fila({indicador:'liquidez', operador:'>=', valor_indicador:1.5, cita_textual:C, confirmadaPorUsuario:true});
previa.confirmacion = E.registroConfirmacion(previa, 'sha', 1);
const nueva = fila({indicador:'endeudamiento', operador:'>=', valor_indicador:1.5, cita_textual:C, naturaleza:'habilitante'});
const nueva2 = fila({indicador:'liquidez', operador:'>=', valor_indicador:1.5, cita_textual:C, naturaleza:'ponderable', obligatoriedad:'opcional'});
const nueva3 = fila({indicador:'liquidez', operador:'>=', valor_indicador:1.5, cita_textual:C, documento:'Adenda 3', pagina:9});
const r = E.heredarConfirmaciones([nueva, nueva2, nueva3], [previa]);
console.log('hereda confirmación con indicador distinto:', r[0].confirmadaPorUsuario === true);
console.log('hereda con naturaleza/obligatoriedad distintas:', r[1].confirmadaPorUsuario === true);
console.log('hereda con otro documento/página:', r[2].confirmadaPorUsuario === true);
// confirmada => confiable aunque no verificada?
console.log('confiable (confirmada, no verificada):', E.filaIAConfiable(Object.assign({}, r[0], {verificada:false})));

// 2) valor: cifra equivocada pero presente en la misma cita
const T = 'Experiencia específica: 2 contratos de puentes vehiculares cuyo valor acumulado sea mayor o igual a $15.000.000.000. Presupuesto oficial: $2.000.000.000.';
const offs=[{pagina:1,hasta:T.length}];
const f = fila({categoria:'experiencia_especifica', objeto_literal:'puentes vehiculares', min_contratos:2, valor_minimo_numero:2000000000, valor_minimo_unidad:'COP', acumulable:true, cita_textual:T.slice(0, T.length)});
console.log('valor = presupuesto oficial (no el exigido):', E.verificarFilaIA(f, T, offs));

// 3) objeto_literal parcial
const T2 = 'Experiencia específica: 1 contrato de obras civiles tipo puentes vehiculares.';
const offs2=[{pagina:1,hasta:T2.length}];
const g1 = fila({categoria:'experiencia_especifica', objeto_literal:'obras civiles', descripcion:'Experiencia en obras civiles', min_contratos:1, cita_textual:T2});
const v = E.verificarFilasIA([g1], T2, offs2)[0];
console.log('objeto parcial verificado:', v.verificada, 'objetoLiteralVerificado:', E.motivoBloqueoFilaIA(v));
const contratos = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],
  ['Construcción de andenes y obras civiles menores', 900000000, '2024-06-01']] } }).contratos;
const ev = E.evaluarExperienciaCompleta(contratos, E.requisitosDeExperienciaDesdeIA([v]), new Date('2026-06-01T00:00:00'));
console.log('contrato de andenes frente a "puentes vehiculares":', ev.resultados[0].resultado);
const g2 = fila({categoria:'experiencia_especifica', objeto_literal:'puentes', descripcion:'Experiencia en puentes', min_contratos:1, cita_textual:T2});
const v2 = E.verificarFilasIA([g2], T2, offs2)[0];
const contratos2 = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],
  ['Construcción de puentes peatonales sobre quebrada', 400000000, '2024-06-01']] } }).contratos;
const ev2 = E.evaluarExperienciaCompleta(contratos2, E.requisitosDeExperienciaDesdeIA([v2]), new Date('2026-06-01T00:00:00'));
console.log('objeto_literal="puentes" (truncado) vs puente peatonal:', v2.verificada, ev2.resultados[0].resultado);
