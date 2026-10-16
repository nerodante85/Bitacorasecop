import { Magnitudes as M } from './harness.mjs';
const mk = (items, part) => [{ numeroContrato:'C1', participacion: part?{valor:part}:null, formatoMaestro:{ cantidades: items.map(([item,cantidad,unidad])=>({item,cantidad,unidad})) } }];
function t(titulo, frase, items, part, base){
  const ex = M.parsearExigencia(frase);
  const r = M.evaluar(ex, mk(items, part), {base});
  console.log('## '+titulo+' ex='+JSON.stringify({a:ex.actividad,c:ex.cifra,m:ex.material,d:ex.diametroMinPulg})+' => '+r.estado+' | '+r.detalle.slice(0,260));
}
const FCON = 'Por lo menos uno (1) de los contratos válidos aportados deberá acreditar la construcción de conexiones domiciliarias de alcantarillado, cuya cantidad sea igual o superior a 100 und';
t('conexiones suministro 60 + instalación 60', FCON, [['Suministro de conexión domiciliaria de alcantarillado',60,'und'],['Instalación de conexión domiciliaria de alcantarillado',60,'und']]);
const FTUB = 'Por lo menos uno (1) de los contratos válidos aportados deberá acreditar la longitud de tubería, la cual es de 1.000,50 ml, el cual corresponde a PVC, con diámetro mayor o igual a 8"';
t('tubería PVC 8 vs 6', FTUB, [['Tubería PVC alcantarillado 6"',2000,'ml']]);
t('tubería PVC Ø 200 mm = 7.9 pulg (exige >=8)', FTUB, [['Tubería PVC alcantarillado 200 mm',2000,'ml']]);
t('tubería PVC DN 200 (sin unidad; n>60 -> mm) ', FTUB, [['Tubería PVC alcantarillado DN 200',2000,'ml']]);
t('tubería PVC 8" PERO PVC presión acueducto', FTUB, [['Tubería PVC presión RDE 21 acueducto 8"',2000,'ml']]);
t('tubería 10 + 10 ml reposición (ya instalada antes)', FTUB, [['Tubería PVC alcantarillado 8" (reposición)',1200,'ml']]);
t('tubería PVC 8" en km', FTUB, [['Tubería PVC alcantarillado 8"',1.2,'km']]);
t('tubería concreto vs PVC', FTUB, [['Tubería de concreto reforzado 24"',2000,'ml']]);
// participacion 0 or >100
t('consorcio prorrata con participación >100 (dato basura 500%)', FCON, [['Conexión domiciliaria de alcantarillado',120,'und']], 500, 'prorrata');
t('consorcio participación 0.4 (fracción) base total', FCON, [['Conexión domiciliaria de alcantarillado',120,'und']], 0.4);
