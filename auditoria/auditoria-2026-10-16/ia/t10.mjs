import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Experiencia específica: 1 contrato de puentes vehiculares. Liquidez mayor o igual a 1,2. Capacidad residual (K) mínima 400 millones de pesos. Garantía de seriedad 10% del presupuesto oficial.';
const offs=[{pagina:1,hasta:T.length}];
const filas = [
 fila({categoria:'experiencia_especifica', objeto_literal:'puentes vehiculares', descripcion:'puentes vehiculares', min_contratos:1, cita_textual:'1 contrato de puentes vehiculares'}),
 fila({indicador:'liquidez', operador:'>=', valor_indicador:1.2, cita_textual:'Liquidez mayor o igual a 1,2'}),
 fila({categoria:'k_residual', indicador:'k_residual', valor_minimo_numero:400000000, valor_minimo_unidad:'COP', cita_textual:'Capacidad residual (K) mínima 400 millones de pesos'}),
 fila({categoria:'garantias', cita_textual:'Garantía de seriedad 10% del presupuesto oficial'}),
];
const ver = E.verificarFilasIA(filas,T,offs);
console.log(ver.map(v=>v.verificada));
const contratos = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],['Construcción de puentes vehiculares A', 2000000000, '2024-06-01']] } }).contratos;
const entry = {id:'p', requisitosIA:{filas:ver}};
E.setExpevalContratos({contratos, headers:[], cols:{}}); E.aplicarRequisitosIAaEntry(entry);
const matriz = { id:'m', nombre:'E', codigos:[], kResidual:{unidad:'COP', valor:900000000}, capacidadEstimada:null, liquidez:1.5, endeudamiento:0.4, cobertura:null, patrimonio:null, capitalTrabajo:null };
const res = E.evaluarProceso({id:'p', entidad:'X', valor:300000000, estado:'Abierta'}, {daysLeft:10}, matriz, entry, {minV:0,maxV:0,perfilesProfesionales:{},perfiles:[]});
res.gates.forEach(g=>console.log(g.estado.padEnd(8), g.nombre));
console.log('VEREDICTO', res.veredicto, res.veredictoGlobal);
