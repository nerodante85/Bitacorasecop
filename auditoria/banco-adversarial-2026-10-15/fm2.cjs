const FM = require('../../formatomaestro.js');
const mk = estado => FM.importar({
  sujetos: [{ id: 'S1', nombre: 'Mi Empresa' }],
  participaciones: [{ ID_SUJETO: 'S1', ID_CONTRATO: 'C1', PORCENTAJE: '100%', FORMA_EJECUCION: 'Individual' }],
  contratos: [{ ID_CONTRATO: 'C1', OBJETO: 'Construcción acueducto', ENTIDAD: 'Alcaldía', VALOR_CONTRATO: 1000000000, ESTADO: estado, FECHA_INICIO: '2020-01-01', FECHA_TERMINACION: '2030-01-01' }],
  unspsc: [], cantidades: []
}, { sujetoId: 'S1' });
['Terminado', 'terminado', '', 'En ejecución', 'EN EJECUCION', 'en ejecución.', 'En Ejecucion ', 'Ejecución', 'Suspendido', 'Liquidado', 'Vigente', 'Activo', 'En curso', 'En liquidación', 'Cedido', 'Caducado', 'Terminado anticipadamente'].forEach(e => {
  const r = mk(e);
  console.log(JSON.stringify(e).padEnd(28), r.contratos[0].enEjecucion ? 'NO acredita (ejecución)' : 'ACREDITA', r.contratos[0].fechaFin);
});
