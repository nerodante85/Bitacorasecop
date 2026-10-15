// Sonda de la ronda de documentos (2026-10-15). NO es una prueba del proyecto: reutiliza las ayudas de tests/smoke.mjs.
// Uso: cp tests/smoke.mjs tests/_probe.mjs; pegar este bloque justo antes de la última línea console.log(passed...); node tests/_probe.mjs; rm tests/_probe.mjs

console.log('\n===== SONDA DE DOCUMENTOS =====');
const H_DOC = ['Objeto', 'Contratante', 'Valor', 'Fecha de inicio', 'Fecha de terminación'];
const volcar = (nombre, req, filas) => {
  const { r } = evaluarReqTexto(req, H_DOC, filas);
  const entry = { experienciaResultado: { resultados: [r], resultadoGlobal: r.resultado, conteo: { 'CUMPLE': +(r.resultado === 'CUMPLE'), 'NO CUMPLE': +(r.resultado === 'NO CUMPLE'), 'NO DETERMINABLE': +(r.resultado === 'NO DETERMINABLE') } } };
  const doc = expEngine.generarFormatoExperienciaTexto({ nombre: 'Mi Empresa SAS', nit: '900.123.456-7', representanteLegal: 'Ana Pérez', representanteCedula: '123' }, ITEM_DOC, entry);
  console.log('\n## ' + nombre + ' -> ' + r.resultado + ' | evaluados: ' + r.contratosEvaluados.map(c => c.contratante + '(' + c.valor + ',' + c.fechaFin + ')').join(', '));
  console.log('   just: ' + String(r.justificacion).slice(0, 200));
  console.log(doc.split('\n').filter(l => /^\s+- |COMPLETAR: contrato/.test(l)).join('\n') || '   (el documento no lista contratos)');
};
const R1 = 'Un contrato de construcción de puentes vehiculares por valor mínimo de 500.000.000 pesos';
volcar('A: uno acredita, otro con valor menor', R1, [[PUENTE + ' A', 'Alcaldía A', '900000000', '2022-01-01', '2023-01-01'], [PUENTE + ' B', 'Alcaldía B', '100000000', '2022-01-01', '2023-01-01']]);
volcar('B: uno acredita, otro en ejecución', R1, [[PUENTE + ' A', 'Alcaldía A', '900000000', '2022-01-01', '2023-01-01'], [PUENTE + ' D', 'Alcaldía D', '900000000', '2025-01-01', '2027-12-31']]);
volcar('C: dos contratos mínimo, uno acredita y otro no', 'Mínimo dos contratos de construcción de puentes vehiculares por valor mínimo de 500.000.000 pesos cada uno', [[PUENTE + ' A', 'Alcaldía A', '900000000', '2022-01-01', '2023-01-01'], [PUENTE + ' B', 'Alcaldía B', '100000000', '2022-01-01', '2023-01-01'], [PUENTE + ' E', 'Alcaldía E', '800000000', '2021-01-01', '2022-01-01']]);

console.log('\n===== PAQUETE =====');
const vacioP = expEngine.generarPaqueteTexto({}, {}, undefined);
console.log('fugas (undefined/null/NaN/[object):', (vacioP.match(/undefined|\bnull\b|NaN|\[object/g) || []).length);
console.log('marcas [CONFIRMAR]:', (vacioP.match(/\[CONFIRMAR\]/g) || []).length, '| bloque ANTES DE FIRMAR:', (vacioP.match(/ANTES DE FIRMAR/g) || []).length, '| [COMPLETAR]:', (vacioP.match(/\[COMPLETAR/g) || []).length);
const lleno = expEngine.generarPaqueteTexto({ nombre: 'Ricardo Galvis', nit: '5.401.578-4', representanteLegal: 'Ricardo Galvis', representanteCedula: '1', ciudad: 'Cúcuta', direccion: 'Av 0', telefono: '3', correo: 'a@b.co' }, { entidad: 'E', objeto: 'O', modalidad: 'M', referencia: 'R' }, undefined);
console.log('persona natural -> «sociedad»:', /sociedad identificada con NIT/.test(lleno), '| «representante legal»:', /obrando en calidad de representante legal/.test(lleno));
const c = expEngine.generarCartaTexto({ nombre: 'X' }, { entidad: 'E' }, false);
const lineas = c.split('\n');
console.log('declaraciones de hecho SIN marca [CONFIRMAR]:');
lineas.filter(l => /^\d\. /.test(l) && !/CONFIRMAR|COMPLETAR/.test(l)).forEach(l => console.log('   ' + l.slice(0, 150)));
const ant = expEngine.generarAnticorrupcionTexto({ nombre: 'X' }, { entidad: 'E' }, false);
ant.split('\n').filter(l => /^\d\. /.test(l) && !/CONFIRMAR|COMPLETAR/.test(l)).forEach(l => console.log('   [anticorrupción] ' + l.slice(0, 150)));
const par = expEngine.generarParafiscalesTexto({ nombre: 'X' }, { entidad: 'E' }, false);
par.split('\n').filter(l => /^\d\. /.test(l) && !/CONFIRMAR|COMPLETAR/.test(l)).forEach(l => console.log('   [parafiscales] ' + l.slice(0, 150)));

console.log('\n===== NÚMERO DE CONTRATO =====');
const H_PROBE = ['Número de contrato', 'Objeto', 'Contratante', 'Valor', 'Fecha de inicio', 'Fecha de terminación'];
const ctos = expEngine.parsearExcelExperiencia(fakeWorkbook(H_PROBE, [['CT-045-2022', PUENTE + ' A', 'Alcaldía A', '900000000', '2022-01-01', '2023-01-01']])).contratos;
console.log('el contrato leído del Excel trae numeroContrato:', ctos[0].numeroContrato);
const rN = expEngine.evaluarRequisito(expEngine.construirRequisitoDesdeTexto('Un contrato de construcción de puentes vehiculares por valor mínimo de 500.000.000 pesos', 0, {}), ctos, HOY_AUD);
console.log('contratosEvaluados[0] trae numeroContrato:', JSON.stringify(rN.contratosEvaluados[0]));
const docN = expEngine.generarFormatoExperienciaTexto({ nombre: 'X' }, ITEM_DOC, { experienciaResultado: { resultados: [rN], resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 } } });
console.log('el documento imprime "Contrato No.":', /Contrato No\./.test(docN), '| imprime CT-045-2022:', /CT-045-2022/.test(docN));

