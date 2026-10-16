import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
const OBJ = 'Construcción de puentes vehiculares';
const req = E.construirRequisitoDesdeTexto('Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000', 0, {});
for (const hp of ['Participación','% Participación','Part. %','Porcentaje de participación en consorcio','Participación en consorcio (%)','% Part.','Porcentaje','Cuota de participación','Aporte (%)','Participación (UT/Consorcio)']) {
  const w = fakeWorkbook(['Objeto','Contratante','Valor del contrato','Fecha de terminación',hp],[[OBJ,'A',900000000,'2024-05-30',30]]);
  const p = E.parsearExcelExperiencia(w);
  const r = E.evaluarRequisito(req, p.contratos, HOY);
  console.log(hp.padEnd(42), 'participacion detectada:', JSON.stringify(p.contratos[0].participacion), '=>', r.resultado);
}
// valor columns variants in consorcio: "Valor ejecutado" and "Valor del contrato (participación)" 
for (const hv of ['Valor aportado por el proponente','Valor según participación','Valor ajustado','Valor proporcional']) {
  const w = fakeWorkbook(['Objeto','Contratante',hv,'Fecha de terminación','Participación'],[[OBJ,'A',900000000,'2024-05-30',30]]);
  const p = E.parsearExcelExperiencia(w);
  console.log(hv.padEnd(42), 'valor', p.contratos[0].valor, 'ajustado', p.contratos[0].valorAjustado);
}
