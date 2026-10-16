import { expEngine as E, fakeWorkbook } from './harness.mjs';
const item = { valor: 3e9, estado: 'Publicado', entidad:'X', objeto:'obra' };
const s = { daysLeft: 20 };
const entry = (ex) => ({ comps: [{ hallazgosAnotados: [] }], exigencias: ex,
  experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, totalObligatorios: 1, resultados: [{ resultado: 'CUMPLE' }] } });
for (const [txt, ex] of [
  ['$2.500.000.000 (1.428 SMMLV)', {valor:5000,unidad:'SMMLV',raw:'K residual mínima 5.000 SMMLV'}],
  ['1.428 SMMLV ($2.500.000.000)', {valor:5000,unidad:'SMMLV',raw:'K residual mínima 5.000 SMMLV'}],
  ['1.428 SMMLV', {valor:5000,unidad:'SMMLV',raw:'K residual mínima 5.000 SMMLV'}],
]) {
  const p = {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:txt,rup:''};
  const r = E.evaluarContraPerfiles(item, s, entry({liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:ex}), {minV:null,maxV:null,perfilesProfesionales:{},perfiles:[p]});
  console.log('\nperfil K='+JSON.stringify(txt)+' exige 5.000 SMMLV (perfil real 1.428) => '+r.mejor.veredicto);
  r.mejor.gates.filter(g=>/K res|Capacidad/.test(g.nombre)).forEach(g=>console.log('  '+g.nombre+': '+g.estado+' | '+g.detalle));
}
// contrato valor con ambos
const c = E.parsearExcelExperiencia(fakeWorkbook(['Objeto','Contratante','Valor','Fecha de terminación'],[['Construcción de puentes vehiculares','A','$900.000.000 (1.000 SMMLV)','2024-05-30']])).contratos;
console.log('\ncontrato valor:', JSON.stringify(c[0].valor), JSON.stringify(c[0].valorActualizado), JSON.stringify(c[0].unidad));
