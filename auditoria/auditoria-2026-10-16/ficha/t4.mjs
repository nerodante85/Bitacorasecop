import { show, e } from './lib.mjs';
const PO = 'El presupuesto oficial es de $3.185.389.625. El plazo de ejecución del contrato será de CUATRO (4) MESES. No se otorgará anticipo. ';
const k = (n, txt) => { const r = e.extraerKResidualUmbral(txt); console.log('K '+n+' => '+JSON.stringify(r).slice(0,260)); };
k('SMMLV', 'El proponente deberá acreditar una capacidad residual de contratación (K) igual o superior a 2.500 SMMLV.');
k('veces', 'El K residual debe ser mayor o igual a 1,5 veces el presupuesto oficial.');
k('millones', 'La capacidad residual del proponente debe ser mayor o igual a $1.800 millones.');
k('formula con numero de articulo', 'La capacidad residual de contratación (K) se calcula según el artículo 2.2.1.1.1.5.4 del Decreto 1082 de 2015 y debe ser mayor o igual al 100% del presupuesto oficial de $3.185.389.625.');
k('K en porcentaje 30%', 'La capacidad residual debe ser mínimo el 30% del presupuesto oficial.');
k('dos cifras (K y presupuesto)', 'Capacidad residual: el proponente debe contar con K residual mayor o igual al valor del presupuesto oficial $3.185.389.625 con corte a 31/12/2025.');
k('K 1.5 dot', 'La capacidad residual de contratación debe ser mayor o igual a 1.5 veces el presupuesto oficial.');
k('K menciona 3 dígitos', 'La capacidad residual K mínima exigida es de 3.185 millones de pesos.');
k('K en miles de pesos', 'Capacidad residual mínima (K): 3.185.390 (miles de pesos).');
show('K fija vs PO', PO+'El proponente deberá acreditar una capacidad residual de contratación (K) igual o superior a $2.000.000.000.');
show('K fija en palabras', PO+'La capacidad residual del proponente debe ser igual o superior a DOS MIL MILLONES DE PESOS ($2.000.000.000) en el RUP.');
show('K 1 caso tabla', PO+'CRPC = POE – Anticipo Capacidad residual de contratación mínima requerida');
// luz con punto
show('luz puente dot', 'Se requiere que corresponda a la construcción de puentes vehiculares cuya luz principal sea mayor o igual al 50% de la longitud del puente a contratar. La luz principal del puente a contratar es de 45.5 metros. ');
