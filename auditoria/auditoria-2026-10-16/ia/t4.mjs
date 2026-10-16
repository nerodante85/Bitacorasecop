import { expEngine as E } from './harness.mjs';
const fila = (x) => Object.assign({
  categoria:'experiencia_especifica', descripcion:'Experiencia en puentes vehiculares', obligatoriedad:'obligatorio', documento:'Pliego de Condiciones', pagina:1,
  cita_textual:'', confianza:'alta', modificado_por_adenda:false, objeto_literal:'puentes vehiculares', naturaleza:'habilitante',
  min_contratos:null, valor_minimo_numero:null, valor_minimo_unidad:null, valor_minimo_pct_presupuesto:null, regla_conversion_smmlv:null,
  cantidad_minima_numero:null, cantidad_minima_unidad:null, acumulable:null, ventana_anios:null, indicador:null, operador:null,
  valor_indicador:null, unidad_indicador:null, codigos_unspsc:[], grupo_alternativo:null, notas:null }, x);
// Tabla leída por pdf.js: celdas de dos filas intercaladas
const T = 'Matriz 1 Experiencia. Puentes vehiculares | mínimo 10 contratos | valor $30.000.000.000 ; Edificaciones | mínimo 2 contratos | valor $4.000.000.000 ; ';
const offs = [{ pagina: 1, hasta: T.length }];
const f = fila({ min_contratos:2, valor_minimo_numero:4000000000, valor_minimo_unidad:'COP', acumulable:true,
  cita_textual:'Puentes vehiculares mínimo 2 contratos valor $4.000.000.000' });
const v = E.verificarFilasIA([f], T, offs)[0];
console.log('verificada', v.verificada, v.tipoVerificacion, v.motivoVerificacion);
// empresa: 2 contratos puentes de 6.000 SMMLV c/u aprox -> real exige 10 y 30000
const contratos = E.parsearExcelExperiencia({ SheetNames:['H'], Sheets:{ H:[['Objeto','Valor','Fecha de terminación'],
  ['Construcción de puentes vehiculares A', 2500000000, '2024-06-01'], ['Construcción de puentes vehiculares B', 2500000000, '2024-06-01']] } }).contratos;
const reqs = E.requisitosDeExperienciaDesdeIA([v]);
const ev = E.evaluarExperienciaCompleta(contratos, reqs, new Date('2026-06-01T00:00:00'));
console.log(ev.resultados[0].resultado, '|', (ev.resultados[0].justificacion||'').slice(0,200));
