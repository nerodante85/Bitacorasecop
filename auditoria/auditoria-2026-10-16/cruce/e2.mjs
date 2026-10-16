import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
function run(titulo, textoReq, headers, rows, opts = {}) {
  const contratos = E.parsearExcelExperiencia(fakeWorkbook(headers, rows)).contratos;
  const req = E.construirRequisitoDesdeTexto(textoReq, 0, {});
  Object.assign(req, opts.req || {});
  const r = E.evaluarRequisito(req, contratos, HOY, opts.ctx);
  console.log('\n## ' + titulo + '\n  req: ' + textoReq + ' ' + JSON.stringify(opts.req||{}) + '\n  => ' + r.resultado + '\n  ' + (r.justificacion||'').slice(0, 500));
  return { r, req, contratos };
}
const H = ['Objeto', 'Contratante', 'Valor', 'Fecha de terminación', 'Participación', 'Número de contrato'];
const OBJ = 'Construcción de puentes vehiculares';
run('A contrato sin fecha de terminación, req sin ventana',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares',
  H, [[OBJ, 'Alcaldía X', 900000000, '', '', 'C1']]);
run('B mismo numero contrato en 2 filas con valores distintos (adición), min 2 contratos',
  'Experiencia específica: mínimo 2 contratos de construcción de puentes vehiculares',
  H, [[OBJ, 'Alcaldía X', 900000000, '2024-05-30', '', 'C1'], [OBJ, 'Alcaldía X', 150000000, '2024-07-30', '', 'C1']]);
run('C mismo contrato escrito distinto (CT-001 vs 001-2023) min 2',
  'Experiencia específica: mínimo 2 contratos de construcción de puentes vehiculares',
  H, [[OBJ, 'Alcaldía X', 900000000, '2024-05-30', '', 'CT-001-2023'], [OBJ, 'ALCALDIA X', 900000000, '2024-05-30', '', '001 de 2023']]);
run('D cantidad: acumulable? min cantidad 1000 ml, 2 contratos de 600 (no acumulable por contrato)',
  'Experiencia específica: contratos de construcción de puentes vehiculares, cantidad mínima 1000 ml',
  [...H, 'Cantidad'], [[OBJ, 'A', 900000000, '2024-05-30', '', 'C1', '600 ml'], [OBJ, 'B', 900000000, '2024-05-30', '', 'C2', '600 ml']]);
run('E cantidad en un consorcio 25%: 1000 ml contrato, req 800 ml',
  'Experiencia específica: contratos de construcción de puentes vehiculares, cantidad mínima 800 ml',
  [...H, 'Cantidad'], [[OBJ, 'A', 900000000, '2024-05-30', '25%', 'C1', '1000 ml']]);
run('F cantidad en km vs ml',
  'Experiencia específica: contratos de construcción de puentes vehiculares, cantidad mínima 800 ml',
  [...H, 'Cantidad'], [[OBJ, 'A', 900000000, '2024-05-30', '', 'C1', '1 km']]);
run('G cantidad en m2 vs ml',
  'Experiencia específica: contratos de construcción de puentes vehiculares, cantidad mínima 800 ml',
  [...H, 'Cantidad'], [[OBJ, 'A', 900000000, '2024-05-30', '', 'C1', '1200 m2']]);
run('H ventana: 5 años, contrato 2021-10-01 (hoy 2026-10-16)',
  'Experiencia específica: contratos de construcción de puentes vehiculares ejecutados en los últimos 5 años',
  H, [[OBJ, 'A', 900000000, '2021-10-01', '', 'C1']]);
run('I contrato terminado "En ejecución" texto en fecha',
  'Experiencia específica: contratos de construcción de puentes vehiculares',
  H, [[OBJ, 'A', 900000000, 'En ejecución', '', 'C1']]);
run('J estado liquidado vs terminado anormalmente en objeto',
  'Experiencia específica: contratos de construcción de puentes vehiculares',
  H, [[OBJ + ' (contrato terminado anticipadamente por mutuo acuerdo al 40%)', 'A', 900000000, '2024-05-30', '', 'C1']]);
run('K valor en USD',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000',
  H, [[OBJ, 'A', 'USD 900,000', '2024-05-30', '', 'C1']]);
run('L valor mínimo 500 millones; contrato valor 1.000.000 (sin separador, 1M)',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000',
  H, [[OBJ, 'A', '9.000.000.000', '2024-05-30', '', 'C1']]);
run('M req 1000 SMMLV con regla fecha_terminacion; valor nominal 2012 contrato 600M (SMMLV 2012 = 566700) -> 1058 smmlv',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo 1000 SMMLV',
  H, [[OBJ, 'A', 600000000, '2012-05-30', '', 'C1']], {req:{reglaSmmlv:'fecha_terminacion'}});
run('N igual pero la regla del pliego es fecha de suscripcion (inicio), sin fecha inicio',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo 1000 SMMLV',
  H, [[OBJ, 'A', 600000000, '2012-05-30', '', 'C1']], {req:{reglaSmmlv:'fecha_inicio'}});
