import { expEngine as E } from './harness.mjs';
const item = { valor: 2e9, estado: 'Publicado', entidad:'X', objeto:'obra' };
const s = { daysLeft: 20 };
const entry = (ex) => ({ comps: [{ hallazgosAnotados: [] }], exigencias: ex,
  experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, totalObligatorios: 1, resultados: [{ resultado: 'CUMPLE' }] } });
const ctxOf = (p) => ({ minV:null, maxV:null, perfilesProfesionales:{}, perfiles:[p] });
function show(t, p, ex, it){
  const r = E.evaluarContraPerfiles(it||item, s, entry(ex), ctxOf(p));
  console.log('\n## '+t+' => '+r.mejor.veredicto+' / '+r.mejor.veredictoGlobal);
  r.mejor.gates.forEach(g=>console.log('   '+g.nombre+': '+g.estado+' | '+String(g.detalle).slice(0,230)));
}
const en = [{id:'1',nombre:'Obra grande',entidad:'Gob',valorActual:'3.000.000.000',valorEjecutado:'0',saldo:'3.000.000.000',fechaFin:'2027-06-01'}];
// SMMLV K: 
show('K residual declarada en SMMLV con contrato en ejecucion de 3.000M; pliego exige 2.000 SMMLV',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'3.000 SMMLV',rup:'',contratosEnEjecucion:en}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:2000,unidad:'SMMLV',raw:'x'}});
show('K residual COP 3.000M con contrato en ejecucion de 3.000M saldo; pliego exige 1.000M',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'3.000.000.000',rup:'',contratosEnEjecucion:en}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:1e9,unidad:'COP',raw:'x'}});
show('K residual 0',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'0',rup:''}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:1e9,unidad:'COP',raw:'x'}});
show('K residual texto "capacidad residual 2.500.000.000 (a 2022)" ',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'Capacidad residual de contratación 2022: 2.500.000.000',rup:''}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:1e9,unidad:'COP',raw:'x'}});
show('K residual con año 2024 y cifra: "K residual a 31/12/2024: $2.500.000.000"',
  {_id:'a',nombre:'A',k:'',kResidual:'K residual a 31/12/2024: $2.500.000.000',rup:''}, {kResidual:{valor:1e9,unidad:'COP',raw:'x'}});
// vencido contrato
show('contrato en ejecucion con fecha vencida (no cuenta) pero K',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'3.000.000.000',rup:'',contratosEnEjecucion:[{id:'1',saldo:'2.900.000.000',fechaFin:'2026-01-01'}]}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:1e9,unidad:'COP',raw:'x'}});
// consorcio contrato en ejecucion con participación 50% pero la empresa responde solidariamente
show('contrato en consorcio 50% saldo 3.000M (descuenta 1.500M)',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'3.000.000.000',rup:'',contratosEnEjecucion:[{id:'1',saldo:'3.000.000.000',fechaFin:'2027-01-01',consorcio:true,participacion:'50'}]}, {liquidez:{valor:1.5},endeudamiento:{valor:.6},kResidual:{valor:1.4e9,unidad:'COP',raw:'x'}});
// K sin exigencia: pliego sin K y sin liquidez -> GO?
show('pliego sin umbrales (ex vacio) todo nd?',
  {_id:'a',nombre:'A',k:'Liquidez: 2; Endeudamiento: 0,3',kResidual:'3.000.000.000',rup:''}, {});
