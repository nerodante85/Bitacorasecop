import { expEngine as E } from './harness.mjs';
const item = { valor: 2e9, estado: 'Publicado', entidad:'X', objeto:'obra' };
const s = { daysLeft: 20 };
const entryBase = () => ({
  comps: [{ hallazgosAnotados: [] }],
  exigencias: { liquidez: { valor: 1.5 }, endeudamiento: { valor: 0.6 }, kResidual: null },
  experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, totalObligatorios: 1, resultados: [{ resultado: 'CUMPLE' }] }
});
const A = { _id:'A', nombre:'Empresa A (sin experiencia, buenos indicadores)', k:'Liquidez: 1,6; Endeudamiento: 0,55', kResidual:'5.000.000.000', rup:'' };
const B = { _id:'B', nombre:'Empresa B (con experiencia, liquidez mala)', k:'Liquidez: 0,4; Endeudamiento: 0,95', kResidual:'100.000.000', rup:'' };
const ctx = { minV:null, maxV:null, perfilesProfesionales:{}, perfiles:[A,B] };
const r = E.evaluarContraPerfiles(item, s, entryBase(), ctx);
console.log('mejor:', r.mejor.perfil, r.mejor.veredicto, r.mejor.veredictoGlobal);
r.porPerfil.forEach(p=>console.log(p.perfil, p.veredicto, p.gates.map(g=>g.nombre+':'+g.estado).join(' | ')));
// solo A marcada (no hay B para experiencia): experiencia global sale del entry; the entry is per-process evaluation of the combined contratos
