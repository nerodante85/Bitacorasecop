import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
const T = 'Indicadores: Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6.';
const offs = [{ pagina: 1, hasta: T.length }];
const C = 'Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6.';
// Caso: la IA asigna a liquidez el valor 0,6 y a endeudamiento el 1,5 (cifras intercambiadas)
const filas = [
  fila({indicador:'liquidez', operador:'>=', valor_indicador:0.6, cita_textual:C}),
  fila({indicador:'endeudamiento', operador:'<=', valor_indicador:1.5, cita_textual:C}),
];
const ver = E.verificarFilasIA(filas, T, offs);
ver.forEach(f=>console.log(f.indicador, f.valor_indicador, f.verificada, f.motivoVerificacion));
const entry = { id:'p', requisitosIA:{ filas: ver } };
E.setExpevalContratos(null);
E.aplicarRequisitosIAaEntry(entry);
// empresa: liquidez 0.9 (NO cumple el real 1.5), endeudamiento 1.2 (NO cumple real 0.6)
const matriz = { id:'m', nombre:'Mi empresa', codigos:[], kResidual:{unidad:'COP', valor:800000000}, capacidadEstimada:null, liquidez:0.9, endeudamiento:1.2, cobertura:null, patrimonio:null, capitalTrabajo:null };
const res = E.evaluarProceso({id:'p', entidad:'X', valor:500000000, estado:'Abierta'}, {daysLeft:10}, matriz, entry, {minV:0,maxV:0,perfilesProfesionales:{},perfiles:[]});
res.gates.filter(g=>/liquidez|endeud/i.test(g.nombre)).forEach(g=>console.log(g.estado.padEnd(8), g.nombre, '|', String(g.detalle).slice(0,160)));
