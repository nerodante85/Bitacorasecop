import { expEngine as E, fakeWorkbook } from './harness.mjs';
const HOY = new Date('2026-10-16T00:00:00');
const H = ['Objeto','Contratante','Valor','Fecha de terminación','Número de contrato'];
const p = E.parsearExcelExperiencia(fakeWorkbook(H,[['Construcción de puentes vehiculares','A',1200000000,'2024-05-30','C1']]));
const g = E.construirRequisitoDesdeTexto('Experiencia general: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000', 0, {tipo:'general'});
const e = E.construirRequisitoDesdeTexto('Experiencia específica: mínimo 1 contrato de construcción de puentes vehiculares, valor mínimo $500.000.000. Los contratos aportados para acreditar la experiencia específica no podrán ser los mismos presentados para la experiencia general.', 1, {tipo:'especifica'});
console.log('flags e:', e.condicionNoVerificable, '|', e.reglaParticipacion);
const ev = E.evaluarExperienciaCompleta(p.contratos, [g,e], HOY);
console.log(ev.resultadoGlobal, ev.resultados.map(r=>r.resultado));
