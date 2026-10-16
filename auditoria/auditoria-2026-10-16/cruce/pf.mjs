import { expEngine as E } from './harness.mjs';
const mk = k => E.matrizCapacidad({_id:'a',nombre:'A',k:k,kResidual:'',rup:''});
for (const k of [
 'Patrimonio: $1.500.000.000',
 'Patrimonio: 1.000 SMMLV ($1.750.905.000)',
 'Patrimonio: 1.500 millones',
 'Patrimonio: $1.500.000.000 (2022); Patrimonio: $2.000.000.000 (2023)',
 'Índice de liquidez: 1,8 (2023) / 0,9 (2022)',
 'Índice de liquidez 2023: 1,8\nÍndice de liquidez 2022: 0,9',
 'Liquidez: 1,8; Endeudamiento: 0,45; Cobertura: 12',
 'Índice de liquidez: INDETERMINADO',
 'Liquidez 1.8',
 'Índice de endeudamiento: 0,4 (40%)',
 'Endeudamiento 40 %',
 'Liquidez: 8,5\nEndeudamiento: 0,12',
 'Liquidez: 1,5 pasivo corriente 800.000.000 activo corriente 1.200.000.000',
 'Capital de trabajo: $800.000.000; Patrimonio: $1.200.000.000',
 'Activo corriente: $1.200.000.000\nPasivo corriente: $800.000.000\nÍndice de liquidez: 1,5\nCapital de trabajo: $400.000.000',
]) {
  const m = mk(k);
  console.log(JSON.stringify(k).slice(0,90).padEnd(92), 'liq', m.liquidez, 'end', m.endeudamiento, 'cob', m.cobertura, 'pat', m.patrimonio, 'ct', m.capitalTrabajo);
}
