import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
function runIA(titulo, fila, headers, rows, ctx) {
  const contratos = E.parsearExcelExperiencia(fakeWorkbook(headers, rows)).contratos;
  const base = { categoria:'experiencia_especifica', descripcion:'Construcción de viviendas de interés social', objeto_literal:'Construcción de viviendas de interés social', cita_textual:'Construcción de viviendas de interés social', obligatoriedad:'obligatorio', habilitante:true, confianza:'alta', paginaVerificada:true, verificada:true, pagina:3, documento:'Pliego' };
  const f = Object.assign(base, fila);
  const req = E.filaIAaRequisito(f, 0);
  if(!req){ console.log('## '+titulo+' -> req null'); return; }
  const r = E.evaluarRequisito(req, contratos, HOY, ctx);
  console.log('\n## ' + titulo + '\n  req: ' + JSON.stringify({minC:req.minContratos,minV:req.minValor,minCant:req.minCantidad,acum:req.acumulable,porC:req.porContrato,cnv:req.condicionNoVerificable,fnd:req.forzarNoDeterminable,tipo:req.tipo,pd:req.palabrasDistintivas})+'\n  => ' + r.resultado + '\n  ' + (r.justificacion||'').slice(0, 400));
}
const H = ['Objeto', 'Contratante', 'Valor', 'Fecha de terminación', 'Participación', 'Número de contrato', 'Cantidad'];
const OBJ = 'Construcción de viviendas de interés social';
runIA('cant1 contratos 30+30 viviendas, exige 50 (cada contrato?)', { cantidad_minima_numero:50, cantidad_minima_unidad:'viviendas', acumulable:false }, H,
  [[OBJ,'A',1e9,'2024-01-01','','C1',30],[OBJ,'B',1e9,'2024-01-01','','C2',30]]);
runIA('cant2 contrato cantidad 150 (m2 en columna) exige 100 viviendas', { cantidad_minima_numero:100, cantidad_minima_unidad:'viviendas' }, H,
  [[OBJ,'A',1e9,'2024-01-01','','C1','150 m2']]);
runIA('cant3 consorcio 25%: 120 viviendas en el contrato, exige 100', { cantidad_minima_numero:100, cantidad_minima_unidad:'viviendas' }, H,
  [[OBJ,'A',1e9,'2024-01-01','25%','C1',120]]);
runIA('cant4 idem con valor minimo tambien', { cantidad_minima_numero:100, cantidad_minima_unidad:'viviendas', valor_minimo_numero:500000000, valor_minimo_unidad:'COP' }, H,
  [[OBJ,'A',1e9,'2024-01-01','25%','C1',120]]);
runIA('cant5 cantidad celda con texto 1.200 (aulas)', { cantidad_minima_numero:100, cantidad_minima_unidad:'viviendas' }, H,
  [[OBJ,'A',1e9,'2024-01-01','','C1','12 aulas']]);
