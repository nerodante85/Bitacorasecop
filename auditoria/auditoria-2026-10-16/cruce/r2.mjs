import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
const H = ['Objeto','Contratante','Valor','Fecha de terminación','Número de contrato'];
const p = E.parsearExcelExperiencia(fakeWorkbook(H,[['Construcción de puentes vehiculares','A',1200000000,'2024-05-30','C1']]));
const g = E.construirRequisitoDesdeTexto('Experiencia general: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000', 0, {tipo:'general'});
const e = E.construirRequisitoDesdeTexto('Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000', 1, {tipo:'especifica'});
// la regla del pliego ("un mismo contrato no puede acreditar ambas") no es modelable en el texto del requisito; se modela como nota
e.reglaParticipacion = 'Un mismo contrato no podrá acreditar simultáneamente la experiencia general y la específica.';
const ev = E.evaluarExperienciaCompleta(p.contratos, [g,e], HOY);
console.log(ev.resultadoGlobal, ev.resultados.map(r=>r.resultado), ev.resultados.map(r=>r.contratosQueAcreditan.map(c=>c.numeroContrato)));
console.log('nota:', ev.resultados[1].nota);
