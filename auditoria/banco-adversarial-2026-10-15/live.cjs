const C0 = require('../../coincidencia.js');
const C = C0;
const H = { 'X-App-Token': 'sLrsLl9JVOgiNtJUJLFM8mxiT' };
const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
(async () => {
  for (const t of ['acueducto', 'alcantarillado', 'pavimento']) {
    const q = C.consultasSecopII(t, hoy);
    const u = p => 'https://www.datos.gov.co/resource/p6dx-8zbt.json?' + p;
    const [v, r] = await Promise.all([fetch(u(q.vigentes), { headers: H }).then(x => x.json()), fetch(u(q.recientes), { headers: H }).then(x => x.json())]);
    const ids = new Set(v.concat(r).map(x => x.id_del_proceso));
    // verdad: conteo en servidor de procesos con cierre >= hoy que contengan el término
    const w = encodeURIComponent("fecha_de_recepcion_de >= '" + hoy + "T00:00:00' AND (upper(descripci_n_del_procedimiento) like upper('%" + t + "%'))");
    const srv = await fetch('https://www.datos.gov.co/resource/p6dx-8zbt.json?$select=count(*)&$where=' + w, { headers: H }).then(x => x.json());
    console.log(t, 'app trae', ids.size, '| vigentes', v.length, '| recientes', r.length, '| servidor (cierre>=hoy, descripción):', JSON.stringify(srv));
    const campos = v[0] ? Object.keys(v[0]).filter(k => /fecha|estado|precio|modalidad|tipo|ciudad|departamento/.test(k)).join(',') : '(sin vigentes)';
    if (t === 'acueducto') console.log('campos:', campos);
  }
})().catch(e => console.log('ERR', e.message));
