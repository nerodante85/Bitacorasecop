import { expEngine as E } from './harness.mjs';
const mk = k => E.matrizCapacidad({_id:'a',nombre:'A',k:k,kResidual:'',rup:''});
for (const k of [
 'Índice de liquidez: 2,5 (2022) / 1,1 (2023)',
 'Índice de liquidez: 2,5 en 2022 y 1,1 en 2023',
 'Liquidez: 2,5 (2022), 1,1 (2023)',
 'Endeudamiento: 0,35 (2022) y 0,82 (2023)',
 'Liquidez 2022 2,5 | 2023 1,1',
 'Liquidez 2022: 2,5 | 2023: 1,1',
 'Liquidez: 2,5 (cierre 2022). Actualizar a 2023 pendiente',
 'Liquidez actual 1,1 (antes 2,5)',
]) { const m = mk(k); console.log(JSON.stringify(k).padEnd(70), 'liq', m.liquidez, 'end', m.endeudamiento); }
