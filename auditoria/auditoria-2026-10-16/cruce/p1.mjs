import { expEngine as E } from './harness.mjs';
const h = (s)=>[{snippet:s, categoria:'Personal / Equipo de trabajo'}];
function t(titulo, snippet, personal){
  const g = E.gatePersonalRequerido(h(snippet), personal);
  console.log('## '+titulo+'\n  pliego: '+snippet+'\n  => '+g.estado+' | '+g.detalle.slice(0,250));
}
t('Director de obra 10 años exige; perfil junior residente 1 año', 'Director de obra: ingeniero civil o arquitecto con mínimo 10 años de experiencia profesional y especialización en gerencia de proyectos',
  {p1:{nombre:'Juan', cargo:'Residente de obra', formacion:'Ingeniero civil', anos:'1', experiencia:'Residente en obra de vivienda', especializaciones:'', competencias:''}});
t('Ingeniero sanitario exigido; perfil ingeniero civil', 'Ingeniero sanitario con 5 años de experiencia en redes de acueducto',
  {p1:{nombre:'Juan', cargo:'Director de obra', formacion:'Ingeniero civil', anos:'12', experiencia:'Obras civiles', especializaciones:'', competencias:''}});
t('Especialista en geotecnia; perfil con especialización en gerencia', 'Especialista en geotecnia con maestría en geotecnia y 8 años de experiencia',
  {p1:{nombre:'Ana', cargo:'Director', formacion:'Ingeniera civil', anos:'12', experiencia:'Vías', especializaciones:'Especialista en gerencia de proyectos', competencias:''}});
t('Residente SST licencia exigida; perfil sin licencia', 'Profesional SST con licencia vigente en seguridad y salud en el trabajo',
  {p1:{nombre:'Luis', cargo:'Residente de obra', formacion:'Ingeniero civil', anos:'7', experiencia:'trabajo en alturas', especializaciones:'', competencias:''}});
