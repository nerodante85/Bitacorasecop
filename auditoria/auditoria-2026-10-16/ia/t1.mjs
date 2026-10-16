import { expEngine as E } from './harness.mjs';
const mk = (texto) => [{ pagina: 1, hasta: texto.length }];
const fila = (x) => Object.assign({
  categoria:'capacidad_financiera', descripcion:'x', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:null, naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
function t(nombre, f, texto){ const v = E.verificarFilaIA(f, texto, mk(texto)); console.log(nombre.padEnd(70), v.verificada ? 'VERIFICADA('+v.tipo+')' : 'no: '+v.motivo); return v; }
// A. indicador cruzado dentro de la misma cita
const T1 = 'Indicadores financieros: Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6. Razón de cobertura de intereses mayor o igual a 3.';
t('A1 endeudamiento=1.5 (cifra de liquidez), cita literal', fila({indicador:'endeudamiento', operador:'<=', valor_indicador:1.5, cita_textual:T1.slice(0)}), T1);
t('A2 liquidez=3 (cifra de cobertura)', fila({indicador:'liquidez', operador:'>=', valor_indicador:3, cita_textual:T1}), T1);
// B. escala: 1.200 millones declarado como 1200
const T2 = 'El proponente deberá acreditar un patrimonio igual o superior a $1.200 millones de pesos.';
t('B1 patrimonio valor_indicador=1200 COP (falta multiplicador)', fila({indicador:'patrimonio', operador:'>=', valor_indicador:1200, unidad_indicador:'COP', cita_textual:T2}), T2);
const T3 = 'Capacidad residual de contratación (K) mínima: 5.000 millones de pesos.';
t('B2 K residual valor_indicador=5000 COP', fila({categoria:'k_residual', indicador:'k_residual', valor_indicador:5000, unidad_indicador:'COP', cita_textual:T3}), T3);
t('B3 K residual valor_minimo_numero=5000 COP (control: debería bloquear)', fila({categoria:'k_residual', indicador:'k_residual', valor_minimo_numero:5000, valor_minimo_unidad:'COP', cita_textual:T3}), T3);
// C. Cita fabricada con palabras de la página (aproximada)
const T4 = 'Índice de liquidez mayor o igual a 1,5. Nivel de endeudamiento menor o igual a 0,6. Capital de trabajo igual o superior a 2,5 veces.';
t('C1 cita fabricada liquidez >= 2,5 (palabras y "a 2,5"existen)', fila({indicador:'liquidez', operador:'>=', valor_indicador:2.5, cita_textual:'Índice de liquidez mayor o igual a 2,5'}), T4);
const T5 = 'Liquidez mayor o igual a 1,2. Endeudamiento menor o igual a 0,7.';
t('C2 cita fabricada endeudamiento MAYOR o igual 0,7', fila({indicador:'endeudamiento', operador:'>=', valor_indicador:0.7, cita_textual:'Endeudamiento mayor o igual a 0,7'}), T5);
// D. min_contratos con "años"
const T6 = 'La experiencia general será de mínimo 3 años en contratos de obra civil.';
t('D1 min_contratos=3 pero la cita dice 3 años', fila({categoria:'experiencia_general', min_contratos:3, objeto_literal:'obra civil', cita_textual:T6}), T6);
const T7 = 'Experiencia: mínimo 3 contratos ejecutados en los últimos 10 años.';
t('D2 ventana_anios=3 (cifra de contratos)', fila({categoria:'experiencia_general', ventana_anios:3, min_contratos:3, cita_textual:T7}), T7);
t('D3 min_contratos=10 (cifra de años)', fila({categoria:'experiencia_general', min_contratos:10, cita_textual:T7}), T7);
// E. cita de pocas palabras
const T8 = 'Acreditar 5 contratos. Plazo: 90 días. Valor del presupuesto oficial: $2.000.000.000';
t('E1 cita 1 palabra con numero', fila({categoria:'experiencia_general', min_contratos:5, cita_textual:'5 contratos'}), T8);
t('E2 cita 12 chars', fila({categoria:'experiencia_general', min_contratos:5, cita_textual:'Acreditar 5 contratos'}), T8);
// F. unidad pesos vs presupuesto: valor_minimo 2.000.000.000 presupuesto oficial pct
t('F1 valor_minimo=2000000000 COP (presupuesto, no experiencia)', fila({categoria:'experiencia_general', min_contratos:null, valor_minimo_numero:2000000000, valor_minimo_unidad:'COP', cita_textual:'Valor del presupuesto oficial: $2.000.000.000'}), T8);
