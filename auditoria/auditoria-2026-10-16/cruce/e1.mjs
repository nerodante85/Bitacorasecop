import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
function run(titulo, textoReq, headers, rows, opts = {}) {
  const contratos = E.parsearExcelExperiencia(fakeWorkbook(headers, rows)).contratos;
  const req = E.construirRequisitoDesdeTexto(textoReq, 0, {});
  Object.assign(req, opts.req || {});
  const r = E.evaluarRequisito(req, contratos, HOY, opts.ctx);
  console.log('\n## ' + titulo + '\n  req: ' + textoReq + '\n  => ' + r.resultado + '\n  ' + (r.justificacion||'').slice(0, 400));
  return { r, req, contratos };
}
const H = ['Objeto', 'Contratante', 'Valor', 'Fecha de terminación', 'Participación', 'Número de contrato'];
// 1 construccion vs mantenimiento
run('1 requisito construcción de acueducto, contrato = mantenimiento de acueducto',
  'Experiencia específica: mínimo 1 contrato de construcción de redes de acueducto, valor mínimo $500.000.000',
  H, [['Mantenimiento de redes de acueducto del municipio', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('2 requisito pavimento rígido, contrato pavimento flexible',
  'Experiencia específica: mínimo 1 contrato de construcción de pavimento rígido',
  H, [['Construcción de pavimento flexible en la vía X', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('3 requisito alcantarillado, contrato acueducto y alcantarillado',
  'Experiencia específica: mínimo 1 contrato de construcción de alcantarillado',
  H, [['Construcción de acueducto', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('4 objeto vial: rehabilitación vs construcción',
  'Experiencia específica: construcción de placa huella',
  H, [['Mejoramiento y rehabilitación de vías terciarias mediante placa huella', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('5 estudios y diseños vs obra',
  'Experiencia específica: contratos de construcción de puentes vehiculares',
  H, [['Estudios y diseños de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('6 interventoria vs obra',
  'Experiencia específica: contratos de construcción de puentes vehiculares',
  H, [['Interventoría técnica, administrativa y financiera a la construcción de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1']]);
run('7 consorcio participación 30% valor 900M requisito 500M',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000',
  H, [['Construcción de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', '30%', 'C1']]);
run('8 consorcio participación 30 (sin %)',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000',
  H, [['Construcción de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', 30, 'C1']]);
run('9 consorcio participacion 0.3',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000',
  H, [['Construcción de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', 0.3, 'C1']]);
run('10 valor en SMMLV 2015 a pesos nominales vs min 1000 SMMLV (reglas)',
  'Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo 1000 SMMLV',
  H, [['Construcción de puentes vehiculares', 'Alcaldía X', 700000000, '2016-05-30', '', 'C1']]);
run('11 min 3 contratos, 3 filas = mismo contrato con adicion (num distinto)',
  'Experiencia específica: mínimo 3 contratos de construcción de puentes vehiculares',
  H, [['Construcción de puentes vehiculares', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1'],
      ['Construcción de puentes vehiculares', 'Alcaldía X', 100000000, '2024-08-30', '', 'C1-ADICION 1'],
      ['Construcción de puentes vehiculares', 'Alcaldía X', 50000000, '2024-09-30', '', 'C1 Otrosí 2']]);
run('12 min 2 contratos, mismo contrato en 2 filas por actividad (mismo num, distinto valor)',
  'Experiencia específica: mínimo 2 contratos de construcción de puentes vehiculares',
  H, [['Construcción de puentes vehiculares - obra civil', 'Alcaldía X', 900000000, '2024-05-30', '', 'C1'],
      ['Construcción de puentes vehiculares - suministro', 'Alcaldía X', 100000000, '2024-05-30', '', 'C1']]);
