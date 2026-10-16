import { show, e } from './lib.mjs';
const P = 'El presupuesto oficial es de $6.000.000.000. El plazo de ejecución del contrato será de SEIS (6) MESES. Capital de trabajo demandado. CRPC = POE – Anticipo. ';
show('anticipo limite', P+'El contratista podrá recibir un anticipo. No se otorgará anticipo por un valor superior al treinta por ciento (30%) del valor del contrato.');
show('anticipo no se pacta pero hay pago anticipado', P+'No se pactará anticipo; se pagará un acta de inicio del 20%.');
show('anticipo condicional', P+'No se entregará anticipo hasta tanto el contratista presente el plan de inversión del anticipo aprobado por el interventor. El anticipo será del 30%.');
