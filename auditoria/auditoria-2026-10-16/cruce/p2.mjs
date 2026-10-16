import { expEngine as E } from './harness.mjs';
for (const s of ['Ingeniero sanitario con 5 años de experiencia en redes de acueducto','Profesional SST con licencia vigente en seguridad y salud en el trabajo','Director de obra: ingeniero civil o arquitecto con mínimo 10 años de experiencia profesional']) {
 const d = E.palabrasClaveDe(s).filter(p => !E.PALABRAS_GENERICAS_OBRA.has(p) && !E.esTokenNumerico(p));
 console.log(s, '=>', d.join(','));
}
