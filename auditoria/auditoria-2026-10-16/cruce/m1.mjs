import { Magnitudes as M } from './harness.mjs';
const ex = M.parsearExigencia('Por lo menos uno (1) de los contratos válidos aportados deberá acreditar la construcción de pozos de inspección, cuya cantidad sea igual o superior a 19 und');
console.log(JSON.stringify(ex));
const mk = (items, part) => [{ numeroContrato:'C1', participacion: part?{valor:part}:null, formatoMaestro:{ cantidades: items.map(([item,cantidad,unidad])=>({item,cantidad,unidad})) } }];
function t(titulo, items, part){
  const r = M.evaluar(ex, mk(items, part), {});
  console.log('## '+titulo+' => '+r.estado+' | '+r.detalle.slice(0,300));
}
t('10 pozos reales + 10 conos (componentes)', [['Pozo de inspección H=2m',10,'und'],['Cono excéntrico para pozo de inspección',10,'und']]);
t('solo pozo séptico 20', [['Construcción de pozo séptico',20,'und']]);
t('pozo de bombeo 20', [['Pozo de bombeo de aguas residuales',20,'und']]);
t('anillos de pozo 25 und', [['Anillo de concreto para pozo de inspección',25,'und']]);
t('pozo existente ajustado', [['Ajuste de cota de pozo existente',20,'und']]);
t('pozo de inspección 20 und pero unidad ml', [['Pozo de inspección',20,'ml']]);
t('pozos de inspección: mismo ítem H=2m 12 und y H=3m 12 und', [['Pozo de inspección H=2m',12,'und'],['Pozo de inspección H=3m',12,'und']]);
t('pozo ya incluidos en el item resumen: Pozos de inspección (resumen) 20 + detalle 10 + 10', [['Pozos de inspección',20,'und'],['Pozo de inspección H=2m',10,'und'],['Pozo de inspección H=3m',10,'und']]);
// consorcio
t('consorcio 50% con 20 pozos, base no definida', [['Pozo de inspección',20,'und']], 50);
