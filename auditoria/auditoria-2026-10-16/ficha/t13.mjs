import { e } from './lib.mjs';
for (const s of ['1.500 SMMLV','1,500 SMMLV','1.5 SMMLV','15.000 SMMLV','mil quinientos (1.500) SMMLV','$1.200.000.000','1.200 millones de pesos','$ 3.185.389.625,50','2.500 salarios mínimos mensuales legales vigentes','25.00 SMMLV','1500 SMMLV','4.381.823.607,5','$850.000.000 (OCHOCIENTOS CINCUENTA MILLONES)','100 SMMLV por contrato hasta 3 contratos','3.000 SMLMV, con el SMMLV del año 2023','2.0 SMMLV','0.5 SMMLV','1.250,5 SMMLV']) {
  console.log(JSON.stringify(s)+' => '+JSON.stringify(e.parseValorUnidad(s)));
}
