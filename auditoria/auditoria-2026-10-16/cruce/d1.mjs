import { Evaluacion } from './harness.mjs';
const r = Evaluacion.resumenDecision({ veredicto:'GO', hayPliego:true, ficha:[{requisito:'Patrimonio',estado:'NO DETERMINABLE',detalle:'Tu perfil no tiene patrimonio legible'}], requisitos:[{requisito:'Experiencia: x',resultado:'CUMPLE',detalle:''}] });
console.log(r.titulo, r.porResolver.length);
// mixture: matriz says CUMPLE for Personal (word overlap), ficha doesn't evaluate personal
const r2 = Evaluacion.resumenDecision({ veredicto:'GO', hayPliego:true, ficha:[], requisitos:[{requisito:'Personal / equipo de trabajo',resultado:'CUMPLE',detalle:'Perfil(es) que podrían acreditarlo: Juan'}] });
console.log(r2.titulo, r2.cumple, r2.total);
