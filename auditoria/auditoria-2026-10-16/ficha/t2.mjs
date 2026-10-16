import { show, e } from './lib.mjs';
const NA = ' No se otorgará anticipo. ';
// Presupuesto: garantía con "es decir $"
show('PO solo en garantia (valor estimado en otra palabra)', 'El valor estimado del contrato es de $3.185.389.625 incluido IVA. La garantía de seriedad será del diez por ciento (10%) del presupuesto oficial, es decir $318.538.962. Plazo de ejecución del contrato será de CUATRO (4) MESES.'+NA);
// PO con interventoría
show('PO obra e interventoria', 'El presupuesto oficial del presente proceso para la ejecución de la obra es de $4.500.000.000 y el presupuesto oficial de la interventoría es de $380.000.000. El plazo de ejecución del contrato será de SEIS (6) MESES.'+NA);
// PO "presupuesto oficial ... incluye AIU ... $"
show('PO con texto largo y IVA', 'El presupuesto oficial para la contratación asciende a la suma de $5.200.000.000 incluido AIU e IVA; el valor del IVA sobre la utilidad es $19.000.000. Plazo de ejecución del contrato será de CINCO (5) MESES.'+NA);
// Plazo con fases
show('plazo fases', 'El presupuesto oficial es $3.185.389.625. El plazo de ejecución del contrato será de TRES (3) MESES para la fase de preconstrucción y NUEVE (9) MESES para la fase de construcción. CTd = ... capital de trabajo demandado'+NA);
// plazo en dias texto
show('plazo dias', 'El presupuesto oficial es $3.185.389.625. El plazo de ejecución del contrato será de CIENTO VEINTE (120) DÍAS calendario.'+NA);
// plazo semanas
show('plazo semanas', 'El presupuesto oficial es $3.185.389.625. El plazo de ejecución del contrato será de VEINTE (20) SEMANAS.'+NA);
// prórroga
show('plazo con prorroga', 'El presupuesto oficial es $3.185.389.625. El plazo de ejecución del contrato será de SEIS (6) MESES, prorrogable hasta por cuatro (4) meses más.'+NA);
// plazo en parentesis y menciona meses de otra cosa primero
show('plazo vigencia garantia primero', 'La garantía tendrá una vigencia por el plazo de ejecución del contrato será de la liquidación (6) meses. El plazo de ejecución del contrato será de DIEZ (10) MESES.');
