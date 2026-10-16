import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Indicadores: Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6. Patrimonio igual o superior a $1.200 millones de pesos. Capacidad residual (K) mínima: 5.000 millones de pesos.';
const offs = [{ pagina: 1, hasta: T.length }];
const cita = (s)=>s;
const filas = [
  fila({indicador:'endeudamiento', operador:'<=', valor_indicador:1.5, cita_textual:'Nivel de endeudamiento menor o igual a 0,6. Patrimonio'}),
  fila({indicador:'patrimonio', operador:'>=', valor_indicador:1200, unidad_indicador:'COP', cita_textual:'Patrimonio igual o superior a $1.200 millones de pesos'}),
  fila({categoria:'k_residual', indicador:'k_residual', valor_indicador:5000, unidad_indicador:'COP', cita_textual:'Capacidad residual (K) mínima: 5.000 millones de pesos'}),
  fila({indicador:'liquidez', operador:'>=', valor_indicador:3, cita_textual:'Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6'}) // valor 3? no aparece
];
const ver = E.verificarFilasIA(filas, T, offs);
ver.forEach(f=>console.log(f.indicador, f.verificada, f.motivoVerificacion));
const entry = { id:'p', requisitosIA:{ filas: ver } };
E.setExpevalContratos(null);
E.aplicarRequisitosIAaEntry(entry);
console.log(JSON.stringify(entry.exigenciasIA));
const matriz = { id:'m', nombre:'Mi empresa', codigos:[], kResidual:{unidad:'COP', valor:800000000}, capacidadEstimada:null, liquidez:1.0, endeudamiento:0.9, cobertura:null, patrimonio:300000000, capitalTrabajo:null };
const res = E.evaluarProceso({id:'p', entidad:'X', valor:500000000, estado:'Abierta'}, {daysLeft:10}, matriz, entry, {minV:0,maxV:0,perfilesProfesionales:{},perfiles:[]});
res.gates.forEach(g=>console.log(g.estado.padEnd(8), g.nombre, '|', String(g.detalle).slice(0,140)));
console.log('veredicto', res.veredicto, res.veredictoGlobal);
