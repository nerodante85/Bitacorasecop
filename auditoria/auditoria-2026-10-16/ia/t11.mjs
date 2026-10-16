import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6. Capital de trabajo igual o superior a 2,5 veces el presupuesto.';
const offs=[{pagina:1,hasta:T.length}];
const f = fila({indicador:'liquidez', operador:'>=', valor_indicador:2.5, cita_textual:'Índice de liquidez mayor o igual a 2,5'});
const ver = E.verificarFilasIA([f],T,offs);
console.log(ver[0].verificada, ver[0].tipoVerificacion);
const entry={id:'p', requisitosIA:{filas:ver}}; E.setExpevalContratos(null); E.aplicarRequisitosIAaEntry(entry);
const matriz = { id:'m', nombre:'E', codigos:[], kResidual:{unidad:'COP', valor:900000000}, capacidadEstimada:null, liquidez:1.8, endeudamiento:0.4, cobertura:null, patrimonio:null, capitalTrabajo:null };
const res = E.evaluarProceso({id:'p', entidad:'X', valor:300000000, estado:'Abierta'}, {daysLeft:10}, matriz, entry, {minV:0,maxV:0,perfilesProfesionales:{},perfiles:[]});
res.gates.filter(g=>/liquidez/i.test(g.nombre)).forEach(g=>console.log(g.estado, g.nombre, g.detalle));
console.log('VEREDICTO', res.veredicto);
