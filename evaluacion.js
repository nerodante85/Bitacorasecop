// Motor del veredicto GO / REVISAR / NO-GO de un proceso contra el perfil de una empresa.
// Sin DOM, sin red y sin estado global: todo lo que necesita entra por `deps` (las piezas que siguen
// viviendo en index.html: formato de dinero, lectura de palabras clave, matriz de capacidad...) y por
// el `ctx` de cada evaluación ({ minV, maxV, perfilesProfesionales, perfiles }). Así se prueba en Node
// sin navegador. Uso: const motor = Evaluacion.crear(deps); motor.evaluarProceso(item, s, matriz, entry, ctx).
(function (root) {
  'use strict';

  function crear(deps) {
    const { fmtMoney, truncate, palabrasClaveDe, esTokenNumerico, normHeader, compararIndiceConUmbral,
            gatesCompletitudIA, lecturaParcial, experienciaGateDetalle, matrizCapacidad, parseNumCO, saldoDeContrato, participacionDeContrato } = deps;
    const PALABRAS_GENERICAS_OBRA = deps.PALABRAS_GENERICAS_OBRA;

  // ---- Auditoría de pre-lanzamiento: cuándo puede aparecer un GO -------------------
  // RT-004: sin K residual en el perfil (o con el valor de la obra en 0) el gate de
  // "Capacidad vs valor" DESAPARECÍA (`if (matriz.kResidual && valor)` sin else): con
  // liquidez, endeudamiento y experiencia en verde el veredicto salía GO sin haber
  // comparado la capacidad contra el valor de la obra. Ahora el gate siempre existe; si
  // falta el dato es "requiere verificación", y un GO nunca se afirma sin haberla comparado.
  // MC-014: con contratos en ejecución sin saldo/fecha (`incompletos`) un "cubre" pasa a
  // "revisar": la capacidad real podría ser menor.
  function gateCapacidadVsValor(kResidual, valor, capacidadEstimada){
    if (valor == null || !(valor > 0)) return null; // "Valor de la obra" ya avisa que no hay valor válido
    const conContratos = capacidadEstimada && !capacidadEstimada.sinContratos;
    const etiqueta = conContratos ? 'Tu capacidad disponible estimada' : 'Tu K residual';
    const fmt = n => '$' + Number(n).toLocaleString('es-CO');
    if (!kResidual){
      return { estado: 'nd', detalle: 'Tu perfil no declara capacidad residual (K residual) en pesos, así que no se puede comparar contra el valor de la obra (' + fmt(valor) + '). Decláralo en "Perfil de la empresa": sin ese dato no se afirma que puedas contratar esta obra.' };
    }
    if (kResidual.unidad !== 'COP'){
      return { estado: 'nd', detalle: etiqueta + ' está en ' + kResidual.unidad + ', pero el valor de la obra está en pesos -- no se pueden comparar directamente. Revísalo manualmente.' };
    }
    if (kResidual.valor < valor){
      return { estado: 'revisar', detalle: etiqueta + ' (' + fmt(kResidual.valor) + ') es menor que el valor de la obra.' + (conContratos ? ' (K residual declarado menos tus contratos en ejecución.)' : '') };
    }
    const incompletos = (capacidadEstimada && capacidadEstimada.incompletos) || 0;
    if (incompletos > 0){
      return { estado: 'revisar', detalle: etiqueta + ' cubre el valor de la obra, PERO ' + incompletos + ' contrato(s) en ejecución no tienen saldo o fecha válida y no se descontaron: tu capacidad real puede ser menor.' };
    }
    return { estado: 'ok', detalle: etiqueta + ' cubre el valor de la obra.' };
  }

  // Un "Capacidad K residual: cumple" tampoco se afirma con contratos en ejecución incompletos.
  function ajustarGatesPorContratosIncompletos(gates, incompletos){
    if (!incompletos) return gates;
    return gates.map(x => (x.nombre === 'Capacidad K residual' && x.estado === 'ok')
      ? Object.assign({}, x, { estado: 'revisar', detalle: x.detalle + ' ⚠ ' + incompletos + ' contrato(s) en ejecución sin saldo o fecha válida no se descontaron: tu capacidad real puede ser menor.' })
      : x);
  }

  // RT-007: un pliego leído en parte (OCR por tandas o tope de páginas) nunca da GO:
  // los requisitos de las páginas sin leer no se evaluaron.
  function gateLecturaParcial(parcial){
    if (!parcial) return null;
    // 'nd' (Requiere verificación), no 'revisar' ("Cumple parcialmente"): leer 8 de 112 páginas no es un
    // cumplimiento parcial de nada, es información que falta. El veredicto no cambia (ambos bloquean el GO).
    return { estado: 'nd', detalle: 'Solo se leyeron ' + parcial.pagesRead + ' de ' + parcial.numPages + ' páginas del pliego' + (parcial.metodo ? ' (por ' + parcial.metodo + ')' : '') + ': los requisitos de las páginas sin leer no se evaluaron, así que no se afirma un GO. Pulsa "Seguir leyendo más páginas" en el análisis.' };
  }

  // Regla del veredicto: cualquier fail -> NO-GO; cualquier "revisar" o "nd" (falta
  // información, no hay evidencia de cumplimiento) o sin pliego -> REVISAR; solo si todo
  // está en verde y hay pliego, GO.
  function decidirVeredicto(gates, hayPliego){
    if (gates.some(x => x.estado === 'fail')) return 'NO-GO';
    if (!gates.length) return 'REVISAR'; // sin nada evaluado no se afirma un GO
    if (gates.some(x => x.estado === 'revisar' || x.estado === 'nd') || !hayPliego) return 'REVISAR';
    return 'GO';
  }

  // Capa de PRESENTACIÓN del resultado global (decidirVeredicto no cambia). Agrega "NO DETERMINABLE":
  // no hay evidencia de ningún requisito (sin pliego analizado, o todos los requisitos en nd). Las
  // condiciones administrativas (estado, plazo, valor) no son evidencia de cumplimiento: que la oferta
  // siga abierta no dice nada de si la empresa puede participar. Un "revisar" SÍ es evidencia de que
  // hay algo concreto que mirar, así que no se esconde tras NO DETERMINABLE. Un fail siempre domina.
  const GATES_ADMINISTRATIVOS = ['Estado del proceso', 'Presentación de oferta', 'Valor de la obra'];
  function veredictoGlobal(gates, hayPliego){
    const base = decidirVeredicto(gates, hayPliego);
    if (base === 'NO-GO') return base;
    if (!hayPliego || !gates.length) return 'NO DETERMINABLE';
    const hayEvidencia = gates.some(x => (x.estado === 'ok' || x.estado === 'revisar') && GATES_ADMINISTRATIVOS.indexOf(x.nombre) === -1);
    return (base === 'REVISAR' && !hayEvidencia) ? 'NO DETERMINABLE' : base;
  }


  // ── Pantalla de análisis: resumen de viabilidad, alertas y explicación ──────────────────────
  // Todo se deriva de los gates del motor (nunca de la IA). Regla de oro: lo que no se pudo comprobar es
  // NO DETERMINABLE, jamás "cumple".
  const AREAS_VIABILIDAD = [
    { clave: 'experiencia', nombre: 'Experiencia', gates: ['Experiencia'], que: 'la experiencia que exige el pliego' },
    { clave: 'financiera', nombre: 'Capacidad financiera', gates: ['Índice de liquidez', 'Índice de endeudamiento', 'Razón de cobertura', 'Rentabilidad del patrimonio', 'Rentabilidad del activo', 'Patrimonio', 'Capital de trabajo'], que: 'los indicadores financieros' },
    { clave: 'residual', nombre: 'Capacidad residual', gates: ['Capacidad K residual', 'Capacidad vs valor'], que: 'la capacidad residual' },
    { clave: 'personal', nombre: 'Personal', gates: ['Personal / equipo de trabajo'], que: 'el personal mínimo' },
    { clave: 'garantias', nombre: 'Garantías', gates: [], que: 'las garantías' }
  ];
  // Gates que describen el estado de la lectura o del proceso, no un requisito: tienen su propia alerta.
  const GATES_META = ['Lectura del pliego', 'Requisitos por verificar a mano', 'Completitud de la lectura', 'Requisitos habilitantes'];

  // Una parte en verde y otra sin dato es evidencia parcial (REVISAR); solo "sin dato" es NO DETERMINABLE.
  function estadoDeArea(estados){
    if (!estados.length) return 'NO DETERMINABLE';
    if (estados.indexOf('fail') !== -1) return 'NO CUMPLE';
    if (estados.indexOf('revisar') !== -1) return 'REVISAR';
    const nOk = estados.filter(e => e === 'ok').length;
    if (nOk && nOk < estados.length) return 'REVISAR';
    return nOk ? 'CUMPLE' : 'NO DETERMINABLE';
  }

  // opciones: { hayPliego, redFlags }. Devuelve [{ clave, nombre, estado, motivo, gates }].
  function resumenViabilidad(gates, opciones){
    const op = opciones || {};
    const hayPliego = op.hayPliego !== false;
    return AREAS_VIABILIDAD.map(a => {
      if (a.clave === 'garantias'){
        const flags = (op.redFlags || []).filter(f => f && (f.severidad === 'alta' || f.severidad === 'media'));
        return flags.length
          ? { clave: a.clave, nombre: a.nombre, estado: 'REVISAR', motivo: flags.length + ' alerta(s): ' + (flags[0].mensaje || 'garantía por debajo del mínimo legal') + '.', gates: [] }
          : { clave: a.clave, nombre: a.nombre, estado: 'NO DETERMINABLE', motivo: 'Bitácora no compara las garantías con tu empresa: confirma montos y pólizas en el pliego.', gates: [] };
      }
      const delArea = (gates || []).filter(g => a.gates.indexOf(g.nombre) !== -1);
      // Sin pliego analizado ninguna exigencia del pliego se da por cumplida; la capacidad frente al valor del proceso sí se puede medir.
      if (!hayPliego && a.clave !== 'residual')
        return { clave: a.clave, nombre: a.nombre, estado: 'NO DETERMINABLE', motivo: 'Analiza el pliego de este proceso para evaluar ' + a.que + '.', gates: [] };
      const estado = estadoDeArea(delArea.map(g => g.estado));
      const nombresDe = est => delArea.filter(g => g.estado === est).map(g => g.nombre);
      let motivo;
      if (!delArea.length) motivo = 'No se encontró ' + a.que + ' en el texto leído: confírmalo en el pliego.';
      else if (estado === 'NO CUMPLE') motivo = 'No cumple: ' + nombresDe('fail').join(', ') + '.';
      else if (estado === 'REVISAR') motivo = 'Por validar: ' + nombresDe('revisar').concat(nombresDe('nd')).join(', ') + '.';
      else if (estado === 'CUMPLE') motivo = 'Cumple lo evaluado (' + delArea.map(g => g.nombre).join(', ') + ').';
      else motivo = 'Sin dato suficiente: ' + nombresDe('nd').join(', ') + '.';
      return { clave: a.clave, nombre: a.nombre, estado: estado, motivo: motivo, gates: delArea.map(g => g.nombre) };
    });
  }

  // Solo lo importante: críticas (algo aparentemente no se cumple) y "a revisar". Tope de 8 visibles.
  // opciones: { hayPliego, lecturaParcial:{pagesRead,numPages}, nSinVerificar, tablasNoLeidas, conflictos, inyeccion, redFlags, faltanDatosEmpresa:[] }
  function alertasAnalisis(gates, opciones){
    const op = opciones || {};
    const criticas = [], revisar = [];
    const corto = t => { t = String(t || ''); return t.length > 220 ? t.slice(0, 220) + '…' : t; };
    (gates || []).filter(g => g.estado === 'fail').forEach(g => criticas.push({ nivel: 'critica', texto: g.nombre + ': ' + corto(g.detalle) }));
    if (op.lecturaParcial) revisar.push({ nivel: 'revisar', texto: 'El análisis es parcial: se leyeron ' + op.lecturaParcial.pagesRead + ' de ' + op.lecturaParcial.numPages + ' páginas del documento; los requisitos de las páginas sin leer no se evaluaron.' });
    if (op.inyeccion) revisar.push({ nivel: 'revisar', texto: 'El PDF contiene texto dirigido a una IA (instrucciones ocultas): ninguna fila cuenta para decidir hasta que la confirmes a mano.' });
    if (op.tablasNoLeidas) revisar.push({ nivel: 'revisar', texto: 'Posible tabla no leída en ' + op.tablasNoLeidas + ' página(s): su contenido no se pudo interpretar como texto.' });
    if (op.nSinVerificar) revisar.push({ nivel: 'revisar', texto: op.nSinVerificar + ' requisito(s) con cita sin verificar contra el PDF: no cuentan para decidir hasta que los confirmes.' });
    if (op.conflictos) revisar.push({ nivel: 'revisar', texto: op.conflictos + ' requisito(s) con valores distintos entre el pliego y una adenda (conflicto): confirma cuál está vigente.' });
    if (op.faltanDatosEmpresa && op.faltanDatosEmpresa.length) revisar.push({ nivel: 'revisar', texto: 'Faltan datos de la empresa: ' + op.faltanDatosEmpresa.join(', ') + '. Esos requisitos no se pueden comparar.' });
    (gates || []).filter(g => g.estado === 'revisar' && GATES_META.indexOf(g.nombre) === -1).forEach(g => revisar.push({ nivel: 'revisar', texto: g.nombre + ': ' + corto(g.detalle) }));
    const nd = (gates || []).filter(g => g.estado === 'nd' && GATES_META.indexOf(g.nombre) === -1 && GATES_ADMINISTRATIVOS.indexOf(g.nombre) === -1).map(g => g.nombre);
    if (nd.length) revisar.push({ nivel: 'revisar', texto: 'No se pudo determinar: ' + nd.join(', ') + ' (falta información o evidencia verificada).' });
    ((op.redFlags || []).filter(f => f && (f.severidad === 'alta' || f.severidad === 'media'))).forEach(f => revisar.push({ nivel: 'revisar', texto: 'Garantías: ' + corto(f.mensaje) }));
    const todas = [];
    criticas.concat(revisar).forEach(a => { if (!todas.some(x => x.texto === a.texto)) todas.push(a); });
    if (todas.length > 8){
      const resto = todas.length - 8;
      return todas.slice(0, 8).concat([{ nivel: 'revisar', texto: 'y ' + resto + ' más: abre el detalle del análisis.' }]);
    }
    return todas;
  }

  // Una frase que dice qué significa el resultado y por qué (sin prometer un GO que no existe).
  function explicacionVeredicto(veredicto, gates, opciones){
    const op = opciones || {};
    const reales = (gates || []).filter(g => GATES_ADMINISTRATIVOS.indexOf(g.nombre) === -1 || g.estado === 'fail');
    const nombres = est => reales.filter(g => g.estado === est).map(g => g.nombre);
    if (veredicto === 'GO') return 'No se identificaron incumplimientos determinantes con la información disponible.';
    if (veredicto === 'NO-GO'){
      const f = nombres('fail');
      return 'Se identificó ' + f.length + ' requisito(s) crítico(s) que aparentemente la empresa no cumple: ' + f.join(', ') + '.';
    }
    const pend = nombres('revisar').concat(nombres('nd')).filter(n => GATES_META.indexOf(n) === -1);
    if (veredicto === 'REVISAR'){
      const n = pend.length || 1;
      return n === 1 ? 'Se identificó 1 aspecto que requiere revisión antes de decidir la participación.'
        : 'Se identificaron ' + n + ' aspectos que requieren revisión antes de decidir la participación.';
    }
    return 'No hay evidencia suficiente para establecer el cumplimiento' + (op.hayPliego === false ? '. Analiza el pliego de este proceso.' : (pend.length ? ': ' + pend.join(', ') + '.' : '.'));
  }

  // Normaliza un entry (nuevo o del esquema viejo de un solo comp) a una lista de comps.
  function compsDe(entry){
    if (entry && Array.isArray(entry.comps)) return entry.comps;
    if (entry && entry.comp) return [Object.assign({ perfilNombre: 'Tu perfil' }, entry.comp)];
    return [];
  }


  // Códigos UNSPSC que el pliego menciona (de los fragmentos de la categoría RUP
  // del análisis). Devuelve strings de 8 dígitos.
  function codigosExigidosEnPliego(entry){
    const comps = compsDe(entry);
    const ha = (comps[0] && comps[0].hallazgosAnotados) || [];
    const txt = ha.filter(h => h.categoria === 'RUP / Clasificador').map(h => h.snippet).join(' ');
    const set = [];
    const push = c => { if (/^\d{8}$/.test(c) && set.indexOf(c) === -1) set.push(c); };
    let m;
    const reDot = /\b(\d{2})\s*[.\s]\s*(\d{2})\s*[.\s]\s*(\d{2})\s*[.\s]\s*(\d{2})\b/g;
    while ((m = reDot.exec(txt)) !== null){ if (+m[1] >= 10 && +m[1] <= 95) push(m[1]+m[2]+m[3]+m[4]); }
    const reBare = /(?<!\d)(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/g;
    while ((m = reBare.exec(txt)) !== null){ if (+m[1] >= 10 && +m[1] <= 95) push(m[1]+m[2]+m[3]+m[4]); }
    (entry && entry.codigosUnspscIA || []).forEach(push);
    return set;
  }

  // Personal / equipo de trabajo exigido en el pliego vs. los perfiles
  // profesionales registrados en "Personal" -- igual que Experiencia, es
  // GLOBAL (no depende del perfil de empresa comparado): reutiliza la misma
  // técnica de palabra clave distintiva que ya usa evaluarRequisito() para no
  // duplicar lógica. Nunca afirma "no cumple" solo porque no hay coincidencia
  // de palabras -- eso solo dice "revísalo a mano" (nd), consistente con el
  // resto de la app.
  function gatePersonalRequerido(hallazgos, personal){
    const total = Object.keys(personal).length;
    if (!total){
      return { estado: 'nd', detalle: 'El pliego menciona personal/equipo de trabajo, pero todavía no has registrado ningún perfil profesional en "Personal".' };
    }
    const coincidencias = [];
    hallazgos.forEach(h => {
      const distintivas = palabrasClaveDe(h.snippet).filter(p => !PALABRAS_GENERICAS_OBRA.has(p) && !esTokenNumerico(p));
      Object.keys(personal).forEach(pid => {
        const pp = personal[pid];
        const texto = normHeader([pp.cargo, pp.formacion, pp.especializaciones, pp.experiencia, pp.competencias].filter(Boolean).join(' '));
        const nombre = pp.nombre || 'Sin nombre';
        if (distintivas.some(p => texto.indexOf(p) !== -1) && coincidencias.indexOf(nombre) === -1) coincidencias.push(nombre);
      });
    });
    const snippet = truncate(hallazgos[0].snippet, 160);
    if (coincidencias.length){
      return { estado: 'ok', detalle: 'El pliego menciona: "' + snippet + '". Perfil(es) que podrían acreditarlo: ' + coincidencias.join(', ') + '.' };
    }
    return { estado: 'nd', detalle: 'El pliego menciona personal/equipo de trabajo ("' + snippet + '"), pero ningún perfil registrado en "Personal" comparte palabras clave con ese requisito -- revísalo manualmente.' };
  }

  // Evalúa un proceso contra UNA matriz de capacidad.
  //   entry (análisis del pliego) opcional -> con él se evalúan indicadores
  //   financieros y experiencia exigidos; sin él, evaluación "ligera".
  //   ctx: { minV, maxV, perfilesProfesionales } -- todo lo que antes se leía de la pantalla
  //   (getInputs) y de variables globales entra aquí por argumento, así el motor se prueba sin DOM.
  function evaluarProceso(item, s, matriz, entry, ctx){
    const gates = [];
    const g = (nombre, estado, detalle) => gates.push({ nombre: nombre, estado: estado, detalle: detalle });
    // No `Number(item.valor) || null`: un proceso con valor base EXACTAMENTE
    // en $0 (dato real, aunque inusual) volvía a caer en "sin valor" por el
    // mismo patrón de "0 tratado como falsy" ya corregido en parseValorUnidad/
    // fmtMoney (ver CLAUDE.md). No producía un falso GO por sí solo (cae a
    // 'nd', que el fix del veredicto ya bloquea), pero mostraba un dato
    // impreciso ("no reporta valor base" en vez de "$0").
    const valorNum = Number(item.valor);
    const valor = (item.valor != null && !isNaN(valorNum)) ? valorNum : null;
    const { minV, maxV } = ctx;
    const daysLeft = s ? s.daysLeft : null;

    // Estado del proceso
    const est = (item.estado || '').toLowerCase();
    if (/adjudicad|celebrad|liquidad|termin|desiert|revocad|cancelad|suspend/.test(est))
      g('Estado del proceso', 'fail', 'Está "' + item.estado + '": ya no admite ofertas.');

    // Presentación de oferta (fecha de recepción de respuestas / cierre)
    if (daysLeft == null) g('Presentación de oferta', 'nd', 'Sin fecha de cierre confiable en el dataset.');
    else if (daysLeft < 0) g('Presentación de oferta', 'fail', 'Venció hace ' + (-daysLeft) + ' días.');
    else if (daysLeft < 5) g('Presentación de oferta', 'revisar', 'Solo ' + daysLeft + ' día(s) hasta el cierre — poco margen para armar la oferta.');
    else g('Presentación de oferta', 'ok', daysLeft + ' días hasta el cierre.');

    // Valor de la obra vs rango del "Perfil de la obra"
    if (valor == null) g('Valor de la obra', 'nd', 'El proceso no reporta valor base.');
    // RT-014: un valor base en 0 o negativo no es un presupuesto válido (antes salía "ok").
    else if (valor <= 0) g('Valor de la obra', 'nd', 'El proceso reporta un valor base de ' + fmtMoney(valor) + ', que no es un dato válido: verifícalo en el pliego.');
    else if (minV && valor < minV) g('Valor de la obra', 'revisar', fmtMoney(valor) + ' por debajo de tu mínimo (' + fmtMoney(minV) + ').');
    else if (maxV && valor > maxV) g('Valor de la obra', 'revisar', fmtMoney(valor) + ' por encima de tu máximo (' + fmtMoney(maxV) + ').');
    // `else` (no `else if (valor)`): un valor exactamente en $0 es un dato
    // real (ver el fix de fmtMoney(0) más abajo) y ya pasó los dos filtros
    // de rango de arriba -- con `else if (valor)` esta fila desaparecía por
    // completo en vez de mostrar $0 (bug real corregido, ver CLAUDE.md).
    else g('Valor de la obra', 'ok', fmtMoney(valor) + (minV || maxV ? ' dentro de tu rango.' : '.'));

    // Capacidad (K residual en COP, o la capacidad disponible ESTIMADA si hay
    // contratos en ejecución registrados -- ver matrizCapacidad) vs valor de la obra.
    // Si hay K residual pero está en SMMLV (no COP), antes este gate simplemente
    // no se agregaba -- desaparecía en silencio de la tabla en vez de avisar que
    // hace falta revisar a mano (mismo patrón de "ausencia silenciosa" que el
    // hallazgo crítico de parseValorUnidad, ver CLAUDE.md). Ahora cae a 'nd'.
    const gCap = gateCapacidadVsValor(matriz.kResidual, valor, matriz.capacidadEstimada);
    if (gCap) g('Capacidad vs valor', gCap.estado, gCap.detalle);

    // Clasificación UNSPSC (solo si hay pliego analizado y menciona códigos)
    const exigidos = entry ? codigosExigidosEnPliego(entry) : [];
    if (exigidos.length){
      const tengo = exigidos.filter(c => matriz.codigos.some(mc => mc.replace(/\D/g, '').slice(0, 6) === c.slice(0, 6)));
      const faltan = exigidos.filter(c => tengo.indexOf(c) === -1);
      if (!faltan.length) g('Clasificación UNSPSC', 'ok', 'Tu RUP cubre los ' + exigidos.length + ' códigos que menciona el pliego.');
      else if (tengo.length) g('Clasificación UNSPSC', 'revisar', 'Cubres ' + tengo.length + '/' + exigidos.length + '. Falta(n): ' + faltan.join(', ') + '.');
      else g('Clasificación UNSPSC', 'fail', 'Tu RUP no cubre ninguno de los códigos del pliego (' + exigidos.join(', ') + ').');
    }

    // Indicadores financieros + experiencia exigidos (necesitan pliego analizado)
    // exigenciasIA: umbrales extraídos por IA con cita verificada (o confirmada a mano); pisan al regex.
    const ex = Object.assign({}, (entry && entry.exigencias) || {}, (entry && entry.exigenciasIA) || {});
    const cmp = (nombre, exig, mio, sentido) => {
      // Patrimonio y capital de trabajo (montos, no índices) van por la misma
      // vía: sin "%" ni ambigüedad de unidad, el resultado es el de siempre.
      const r = compararIndiceConUmbral(nombre, exig, mio, sentido, !!entry);
      g(nombre, r.estado, r.detalle);
    };
    if (entry){
      const gParcial = gateLecturaParcial(lecturaParcial(entry));
      if (gParcial) g('Lectura del pliego', gParcial.estado, gParcial.detalle);
      if (entry.requisitosIA) gatesCompletitudIA(entry.requisitosIA.filas).forEach(x => g(x.nombre, x.estado, x.detalle));
      cmp('Índice de liquidez', ex.liquidez, matriz.liquidez, '>=');
      cmp('Índice de endeudamiento', ex.endeudamiento, matriz.endeudamiento, '<=');
      if (ex.cobertura) cmp('Razón de cobertura', ex.cobertura, matriz.cobertura, '>=');
      // Rentabilidad: el perfil no la guarda (el RUP no la trae), así que queda en "Requiere verificación".
      if (ex.rentabilidadPatrimonio) cmp('Rentabilidad del patrimonio', ex.rentabilidadPatrimonio, null, '>=');
      if (ex.rentabilidadActivo) cmp('Rentabilidad del activo', ex.rentabilidadActivo, null, '>=');
      [['Patrimonio', ex.patrimonio, matriz.patrimonio], ['Capital de trabajo', ex.capitalTrabajo, matriz.capitalTrabajo]].forEach(par => {
        if (!par[1]) return;
        if (par[1].unidad === 'SMMLV') g(par[0], 'nd', 'El pliego lo exige en SMMLV (' + Number(par[1].valor).toLocaleString('es-CO') + ') y tu perfil lo tiene en pesos -- compáralo a mano.');
        else cmp(par[0], par[1], par[2], '>=');
      });
      if (ex.kResidual && ex.kResidual.conflicto){
        g('Capacidad K residual', 'nd', ex.kResidual.raw);
      } else if (ex.kResidual && ex.kResidual.relativo){
        // MC-006: umbral relativo ("1,5 veces el presupuesto oficial", "100% del presupuesto").
        const factor = ex.kResidual.relativo.factor;
        const baseK = ex.kResidual.baseValor != null ? ex.kResidual.baseValor : valor;
        const conContratosR = matriz.capacidadEstimada && !matriz.capacidadEstimada.sinContratos;
        if (!baseK){
          g('Capacidad K residual', 'nd', 'El pliego la exige como ' + factor + ' veces el presupuesto oficial, pero no se conoce el valor del proceso -- compárala a mano.');
        } else if (!matriz.kResidual || matriz.kResidual.unidad !== 'COP'){
          g('Capacidad K residual', 'nd', 'El pliego la exige como ' + factor + ' veces el presupuesto oficial (' + fmtMoney(baseK * factor) + ') pero tu perfil no la tiene en pesos.');
        } else {
          const umbralK = baseK * factor;
          const pasaK = matriz.kResidual.valor >= umbralK;
          g('Capacidad K residual', pasaK ? 'ok' : 'fail', 'Pliego: ≥ ' + fmtMoney(umbralK) + ' (' + factor + ' veces el presupuesto de ' + fmtMoney(baseK) + ') · ' + (conContratosR ? 'tu capacidad disponible estimada' : 'tu perfil') + ': ' + fmtMoney(matriz.kResidual.valor) + (pasaK ? ' ✓' : ' ✗'));
        }
      } else if (ex.kResidual && ex.kResidual.valor == null){
        g('Capacidad K residual', 'nd', ex.kResidual.motivo || 'El pliego no da una cifra clara de capacidad residual.');
      } else if (ex.kResidual){
        const conContratos = matriz.capacidadEstimada && !matriz.capacidadEstimada.sinContratos;
        const etiquetaPerfil = conContratos ? 'tu capacidad disponible estimada' : 'tu perfil';
        // Auditoría UX/UI: mostraba "1200000000 COP" sin separador de miles
        // -- confuso de leer a simple vista, e inconsistente con el resto
        // del mismo informe (que sí usa fmtMoney en pesos). fmtCifra()
        // separa por miles con toLocaleString sin asumir "$" (la unidad
        // puede ser SMMLV, no siempre pesos).
        const fmtCifra = (n, unidad) => (unidad === 'COP' ? '$' : '') + Number(n).toLocaleString('es-CO') + (unidad === 'COP' ? '' : ' ' + unidad);
        if (matriz.kResidual && matriz.kResidual.unidad === ex.kResidual.unidad){
          const pasa = matriz.kResidual.valor >= ex.kResidual.valor;
          g('Capacidad K residual', pasa ? 'ok' : 'fail', 'Pliego: ≥ ' + fmtCifra(ex.kResidual.valor, ex.kResidual.unidad) + ' · ' + etiquetaPerfil + ': ' + fmtCifra(matriz.kResidual.valor, matriz.kResidual.unidad) + (pasa ? ' ✓' : ' ✗'));
        } else {
          g('Capacidad K residual', 'nd', 'El pliego la exige (' + fmtCifra(ex.kResidual.valor, ex.kResidual.unidad) + ') pero tu perfil no la tiene en esa unidad.');
        }
      }
      // Experiencia: YA NO sale del perfil (el perfil no la tiene). Sale de
      // los requisitos extraídos del Pliego/Estudio Previo de ESTE proceso
      // comparados contra la experiencia acreditada de la empresa (ver
      // "Experiencia requerida" en renderAnalysisHtml) -- por eso ahora
      // depende de `entry`, no es la misma para cualquier proceso.
      const gExp = experienciaGateDetalle(entry);
      g('Experiencia', gExp.estado, gExp.detalle);

      // Personal / equipo de trabajo (solo si el pliego menciona algo de esto).
      const hallazgosPersonal = ((compsDe(entry)[0] || {}).hallazgosAnotados || []).filter(h => h.categoria === 'Personal / Equipo de trabajo').concat(entry.hallazgosPersonalIA || []);
      if (hallazgosPersonal.length){
        const gPersonal = gatePersonalRequerido(hallazgosPersonal, ctx.perfilesProfesionales);
        g('Personal / equipo de trabajo', gPersonal.estado, gPersonal.detalle);
      }
    } else {
      g('Requisitos habilitantes', 'nd', 'Sube y analiza el pliego (PDF) para evaluar indicadores financieros y experiencia.');
    }

    // Un gate "nd" (no determinable / requiere verificación) o "revisar" nunca deja pasar un
    // GO pleno -- falta información, no evidencia de cumplimiento (ver decidirVeredicto).
    const gatesFinal = ajustarGatesPorContratosIncompletos(gates, (matriz.capacidadEstimada && matriz.capacidadEstimada.incompletos) || 0);
    const veredicto = decidirVeredicto(gatesFinal, !!entry);
    return { veredicto: veredicto, veredictoGlobal: veredictoGlobal(gatesFinal, !!entry), gates: gatesFinal, conPliego: !!entry, perfil: matriz.nombre, perfilId: matriz.id };
  }

  // Evalúa contra TODOS los perfiles marcados (o el que se edita si no hay marcados)
  // y devuelve el resultado por perfil + el "mejor" (GO > REVISAR > NO-GO).
  // ctx.perfiles: la lista de perfiles de empresa a comparar (ver perfilesParaComparar).
  function evaluarContraPerfiles(item, s, entry, ctx){
    const rank = { 'GO': 0, 'REVISAR': 1, 'NO-GO': 2 };
    const porPerfil = ctx.perfiles.map(p => evaluarProceso(item, s, matrizCapacidad(p), entry, ctx));
    if (!porPerfil.length) return null;
    const mejor = porPerfil.slice().sort((a, b) => rank[a.veredicto] - rank[b.veredicto])[0];
    return { mejor: mejor, porPerfil: porPerfil };
  }


  // ---- Capacidad Residual de la empresa (Fase 1) -------------------------------------
  // Validaciones de los contratos en ejecución, estado de confianza del cálculo y comparación
  // contra la K que exige un proceso. Todo puro: la UI solo dibuja lo que esto devuelve.
  // IMPORTANTE: la K de la empresa sigue siendo la que ella DECLARA (menos el SCE); la metodología
  // completa (CO, E, CT, CF) llega en la Fase 2, por eso el estado más alto es "completa" respecto
  // de lo que la app puede verificar, nunca "certificada".
  const TIPOS_CLIENTE = { publico: 'Público', privado: 'Privado', concesionario: 'Concesionario', otro: 'Otro' };
  const ESTADOS_CONTRATO = { en_ejecucion: 'En ejecución', suspendido: 'Suspendido', otro: 'Otro' };

  function numOpt(v){
    if (v == null || String(v).trim() === '') return null;
    const n = parseNumCO(v);
    return (typeof n === 'number' && !isNaN(n)) ? n : null;
  }
  function fechaMs(f){
    if (!f) return NaN;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(f)) ? new Date(f + 'T00:00:00').getTime() : NaN;
  }
  function nombreContrato(c){ return c.nombre || c.numero || c.entidad || 'Contrato sin nombre'; }

  // Cada problema: { nivel: 'error'|'aviso', afecta: bool (si deja el cálculo en "preliminar"), tipo, mensaje }.
  function validarContratoEjecucion(c, hoyMs){
    hoyMs = hoyMs == null ? Date.now() : hoyMs;
    const out = [];
    const nom = nombreContrato(c);
    const add = (nivel, afecta, tipo, mensaje) => out.push({ nivel: nivel, afecta: afecta, tipo: tipo, mensaje: nom + ': ' + mensaje });
    const num = k => numOpt(c[k]);
    [['valorInicial', 'el valor inicial'], ['valorActual', 'el valor actual'], ['valorEjecutado', 'el valor ejecutado'], ['saldo', 'el saldo pendiente']].forEach(par => {
      const n = num(par[0]);
      if (n != null && n < 0) add('error', true, 'negativo', par[1] + ' no puede ser negativo.');
    });
    const ini = fechaMs(c.fechaInicio), fin = fechaMs(c.fechaFin);
    if (c.fechaInicio && isNaN(ini)) add('error', true, 'fecha', 'la fecha de inicio no es válida.');
    if (c.fechaFin && isNaN(fin)) add('error', true, 'fecha', 'la fecha de terminación no es válida.');
    if (!isNaN(ini) && !isNaN(fin) && ini > fin) add('error', true, 'fecha', 'la fecha de inicio es posterior a la de terminación.');
    const estado = c.estado || 'en_ejecucion';
    if (!isNaN(fin) && Math.ceil((fin - hoyMs) / 86400000) <= 0 && estado === 'en_ejecucion') add('aviso', true, 'vencido', 'figura "en ejecución" pero su fecha de terminación ya pasó; si terminó, elimínalo; si sigue, actualiza la fecha.');
    if (estado === 'suspendido') add('aviso', true, 'suspendido', 'está suspendido: se cuenta su saldo como comprometido; confirma con tu asesor si debe incluirse.');
    if (estado === 'otro') add('aviso', true, 'estado', 'tiene un estado distinto de "en ejecución": revisa si debe contarse.');
    const { saldo, origen } = saldoDeContrato(c);
    if (saldo == null || saldo <= 0) add('aviso', true, 'sin_saldo', 'no tiene saldo pendiente informado (ni valor y valor ejecutado para calcularlo): no se descuenta.');
    const tope = num('valorActual') != null ? num('valorActual') : num('valorInicial');
    if (saldo != null && tope != null && saldo > tope * 1.0001) add('aviso', true, 'saldo_mayor', 'el saldo pendiente supera el valor del contrato; revisa o documenta la adición que lo justifique.');
    const ejec = num('valorEjecutado');
    if (origen === 'declarado' && saldo != null && tope != null && ejec != null && Math.abs((ejec + saldo) - tope) > Math.max(1, tope * 0.01)) {
      add('aviso', true, 'inconsistente', 'valor ejecutado + saldo no coincide con el valor del contrato (revisa las cifras).');
    }
    if (c.consorcio){
      const pRaw = numOpt(c.participacion);
      if (pRaw == null) add('aviso', true, 'sin_participacion', 'es en consorcio o unión temporal y no tiene porcentaje de participación: se descuenta el 100 % del saldo hasta que lo indiques.');
      else if (pRaw > 100 || pRaw <= 0) add('error', true, 'participacion', 'el porcentaje de participación debe estar entre 0 y 100.');
    }
    if (!String(c.soporte || '').trim()) add('aviso', false, 'sin_soporte', 'falta indicar el documento que soporta este contrato (contrato, certificación o acta).');
    return out;
  }

  // Contratos que parecen el mismo: igual número + entidad, o igual nombre + entidad + valor inicial.
  function contratosDuplicados(contratos){
    const norm = x => normHeader(String(x || ''));
    const vistos = new Map(), dup = [];
    (contratos || []).forEach(c => {
      const claves = [];
      if (norm(c.numero) && norm(c.entidad)) claves.push('n|' + norm(c.numero) + '|' + norm(c.entidad));
      if (norm(c.nombre) && norm(c.entidad) && numOpt(c.valorInicial) != null) claves.push('v|' + norm(c.nombre) + '|' + norm(c.entidad) + '|' + numOpt(c.valorInicial));
      claves.some(k => {
        if (vistos.has(k)){ dup.push({ id: c.id, otro: vistos.get(k) }); return true; }
        return false;
      });
      claves.forEach(k => { if (!vistos.has(k)) vistos.set(k, c.id); });
    });
    return dup;
  }

  // Estado de confianza del cálculo de la capacidad disponible.
  // cce: salida de capacidadContractualEstimada(perfil) (o null si la K no está declarada en pesos).
  // opciones: { hoyMs, actualizadaISO }.
  function resumenCapacidadResidual(cce, contratos, opciones){
    opciones = opciones || {};
    const hoyMs = opciones.hoyMs == null ? Date.now() : opciones.hoyMs;
    contratos = contratos || [];
    const alertas = [];
    contratos.forEach(c => validarContratoEjecucion(c, hoyMs).forEach(a => alertas.push(a)));
    contratosDuplicados(contratos).forEach(d => {
      const c = contratos.find(x => x.id === d.id) || {};
      alertas.push({ nivel: 'aviso', afecta: true, tipo: 'duplicado', mensaje: nombreContrato(c) + ': parece repetido (mismo número o mismo nombre, entidad y valor): se descontaría dos veces.' });
    });
    const act = fechaMs(opciones.actualizadaISO);
    if (!isNaN(act) && (hoyMs - act) / 86400000 > 365) alertas.push({ nivel: 'aviso', afecta: true, tipo: 'desactualizada', mensaje: 'La capacidad lleva más de un año sin actualizarse: confirma que el K declarado y los contratos siguen vigentes.' });
    const nota = 'El K lo declaras tú (por ejemplo, de la certificación de tu RUP); la app descuenta tus contratos en ejecución y aún no lo recalcula con la metodología completa (organización, experiencia, capacidad técnica y financiera).';
    if (!cce){
      return { estado: 'no_calculable', etiqueta: 'No calculable', k: null, sce: null, disponible: null, alertas: alertas, nota: nota,
        motivo: 'Falta declarar la Capacidad K residual en pesos (por ejemplo "K residual = 1.200.000.000"): no se puede calcular lo que te queda disponible.' };
    }
    const incompletos = cce.incompletos || 0;
    const afectan = alertas.filter(a => a.afecta);
    const preliminar = incompletos > 0 || afectan.length > 0;
    const motivos = [];
    if (incompletos > 0) motivos.push(incompletos + ' contrato(s) sin saldo o fecha de terminación válida');
    const otras = afectan.length - (incompletos > 0 ? 0 : 0);
    if (afectan.length) motivos.push(afectan.length + ' alerta(s) por revisar');
    return { estado: preliminar ? 'preliminar' : 'completa', etiqueta: preliminar ? 'Cálculo preliminar' : 'Información completa',
      k: cce.kResidualDeclarado, sce: cce.sce, disponible: cce.disponible, alertas: alertas, nota: nota,
      motivo: preliminar ? 'Hay información pendiente: ' + motivos.join(' y ') + '.' : 'Toda la información que la app puede verificar está registrada.' };
  }

  // K exigida por el proceso vs K de la empresa. exigida: salida de extraerKResidualUmbral (o de la IA) o null.
  // kEmpresa: { valor, unidad } (la disponible estimada si hay contratos). Nunca inventa una K: sin dato claro es 'sin_dato'/'nd'.
  function comparacionCapacidadResidual(exigida, kEmpresa, opciones){
    opciones = opciones || {};
    const fmt = (n, u) => (u === 'COP' ? '$' : '') + Number(n).toLocaleString('es-CO') + (u === 'COP' ? '' : ' ' + u);
    const base = { etiquetas: { cumple: 'APARENTEMENTE CUMPLE', no_cumple: 'NO CUMPLE', nd: 'NO SE PUEDE DETERMINAR', sin_dato: 'NO SE IDENTIFICÓ' } };
    const res = (estado, extra) => Object.assign({ estado: estado, etiqueta: base.etiquetas[estado], requerida: null, empresa: kEmpresa || null, margen: null, motivo: '', conflicto: false }, extra || {});
    if (!exigida) return res('sin_dato', { motivo: 'No se identificó de forma confiable un requisito de Capacidad Residual K en los documentos analizados.' });
    if (exigida.conflicto) return res('nd', { conflicto: true, motivo: exigida.raw || 'Se encontraron valores diferentes de Capacidad Residual: revisa los documentos.' });
    let requerida = null;
    if (exigida.relativo){
      const baseV = exigida.baseValor != null ? exigida.baseValor : opciones.valorProceso;
      if (!baseV) return res('nd', { motivo: 'El pliego la exige como ' + exigida.relativo.factor + ' veces el presupuesto oficial, pero no se conoce el valor del proceso.' });
      requerida = { valor: baseV * exigida.relativo.factor, unidad: 'COP', nota: exigida.relativo.factor + ' veces el presupuesto oficial (' + fmt(baseV, 'COP') + ')' };
    } else if (exigida.valor == null){
      return res('nd', { motivo: exigida.motivo || 'El pliego menciona la capacidad residual pero sin una cifra clara.' });
    } else {
      requerida = { valor: exigida.valor, unidad: exigida.unidad || 'COP', nota: '' };
    }
    requerida.texto = fmt(requerida.valor, requerida.unidad);
    if (!kEmpresa || kEmpresa.valor == null) return res('nd', { requerida: requerida, motivo: 'Tu empresa no tiene una Capacidad K residual declarada: no se puede comparar.' });
    if (kEmpresa.unidad !== requerida.unidad) return res('nd', { requerida: requerida, motivo: 'La exigencia está en ' + requerida.unidad + ' y la capacidad de tu empresa en ' + kEmpresa.unidad + ': no se comparan directamente, revísalo a mano.' });
    const margen = kEmpresa.valor - requerida.valor;
    if (margen < 0) return res('no_cumple', { requerida: requerida, margen: margen, motivo: 'Tu capacidad (' + fmt(kEmpresa.valor, kEmpresa.unidad) + ') es menor que la exigida en ' + fmt(-margen, kEmpresa.unidad) + '.' });
    if ((opciones.incompletos || 0) > 0) return res('nd', { requerida: requerida, margen: margen, motivo: 'Tu capacidad declarada alcanza, pero ' + opciones.incompletos + ' contrato(s) en ejecución están incompletos y no se descontaron: la capacidad real puede ser menor.' });
    return res('cumple', { requerida: requerida, margen: margen, motivo: 'Tu capacidad supera la exigida por el proceso en ' + fmt(margen, kEmpresa.unidad) + '.' });
  }

    return {
      validarContratoEjecucion: validarContratoEjecucion, contratosDuplicados: contratosDuplicados, resumenCapacidadResidual: resumenCapacidadResidual,
      comparacionCapacidadResidual: comparacionCapacidadResidual,
      TIPOS_CLIENTE: TIPOS_CLIENTE, ESTADOS_CONTRATO: ESTADOS_CONTRATO,
      gateCapacidadVsValor: gateCapacidadVsValor, ajustarGatesPorContratosIncompletos: ajustarGatesPorContratosIncompletos,
      gateLecturaParcial: gateLecturaParcial, decidirVeredicto: decidirVeredicto, veredictoGlobal: veredictoGlobal,
      resumenViabilidad: resumenViabilidad, alertasAnalisis: alertasAnalisis, explicacionVeredicto: explicacionVeredicto, estadoDeArea: estadoDeArea, compsDe: compsDe,
      codigosExigidosEnPliego: codigosExigidosEnPliego, gatePersonalRequerido: gatePersonalRequerido,
      evaluarProceso: evaluarProceso, evaluarContraPerfiles: evaluarContraPerfiles
    };
  }

  // Resumen de decisión (Go/No-Go) de UN proceso: función pura. Nunca produce un "avanza" si el veredicto no es GO ni
  // queda ningún requisito sin resolver; todo lo que no está verificado aparece como "por resolver", no como cumplido.
  // entrada: { veredicto, requisitos:[{requisito, resultado, detalle}], ficha:[{requisito, estado, detalle}], areas:[{nombre, estado, motivo}], diasRestantes, hayPliego }
  function resumenDecision(entrada) {
    const e = entrada || {};
    const veredicto = ['GO', 'REVISAR', 'NO-GO', 'NO DETERMINABLE'].indexOf(e.veredicto) !== -1 ? e.veredicto : 'NO DETERMINABLE';
    const vistos = new Set();
    const items = [];
    const agrega = (requisito, estado, detalle, origen) => {
      const k = String(requisito || '').trim().toLowerCase();
      if (!k || vistos.has(k + '|' + origen)) return;
      vistos.add(k + '|' + origen);
      items.push({ requisito: String(requisito).trim(), estado: estado, detalle: String(detalle || '').trim(), origen: origen });
    };
    // La ficha y la matriz pueden hablar del MISMO requisito con otro nombre (p. ej. «Capacidad residual del proceso (K)» y «K residual: …»):
    // si la ficha ya lo trae se usa la ficha (con su cifra y su motivo) y no se repite.
    const concepto = r => { const t = String(r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return /residual/.test(t) ? 'k' : /capital de trabajo/.test(t) ? 'ct' : /patrimonio/.test(t) ? 'patrimonio' : /liquidez/.test(t) ? 'liquidez' : /endeudamiento/.test(t) ? 'endeudamiento' : /cobertura/.test(t) ? 'cobertura' : /unspsc/.test(t) ? 'unspsc' : null; };
    const enFicha = new Set((e.ficha || []).map(x => concepto(x.requisito)).filter(Boolean));
    (e.ficha || []).forEach(x => agrega(x.requisito, x.estado, x.detalle, 'ficha'));
    (e.requisitos || []).filter(x => !enFicha.has(concepto(x.requisito))).forEach(x => agrega(x.requisito, x.resultado, x.detalle, 'matriz'));
    const accionDe = it => {
      const d = (it.detalle || '').toLowerCase();
      if (/confirma con la entidad|incoherencia|aclar/.test(d)) return 'Pregunta a la entidad en el periodo de observaciones.';
      if (/^experiencia/i.test(String(it.requisito || ''))) {
        if (/algunas palabras|solo palabras gen|actividad no es equivalente/.test(d)) return 'Revisa a mano cuál de tus contratos (objeto, valor en SMMLV y fecha) corresponde al alcance que cita el pliego.';
        if (/ning[uú]n contrato/.test(d)) return 'Confirma si tienes experiencia descrita con otras palabras; si no, este requisito no se cumple.';
      }
      if (/hoja cantidades|cantidades cargadas|sin cantidades/.test(d)) return 'Carga las cantidades de tus contratos (hoja CANTIDADES del Formato Maestro).';
      if (/cita|verific/.test(d)) return 'Verifica la cita en el documento.';
      if (/no tiene contratos de experiencia/.test(d)) return 'Carga los contratos de experiencia de tu empresa (Formato Maestro).';
      if (/capital de trabajo legible|no tiene (?:patrimonio|liquidez)|desde el rup/.test(d)) return 'Carga el RUP o los indicadores financieros de tu empresa.';
      if (/perfil|empresa|carg|registr/.test(d)) return 'Completa los datos de tu empresa y vuelve a analizar.';
      return 'Confírmalo en el pliego.';
    };
    const norm = x => (x.estado === 'NO CUMPLE' || x.estado === 'CUMPLE' || x.estado === 'REVISAR') ? x.estado : 'NO DETERMINABLE';
    const bloqueantes = items.filter(x => norm(x) === 'NO CUMPLE').map(x => ({ requisito: x.requisito, detalle: x.detalle }));
    const porResolver = items.filter(x => norm(x) !== 'NO CUMPLE' && norm(x) !== 'CUMPLE').map(x => ({ requisito: x.requisito, estado: norm(x), detalle: x.detalle, accion: accionDe(x) }));
    const cumple = items.filter(x => norm(x) === 'CUMPLE').length;
    const dias = (typeof e.diasRestantes === 'number' && isFinite(e.diasRestantes)) ? e.diasRestantes : null;
    let titulo, recomendacion;
    if (veredicto === 'NO-GO') {
      titulo = 'NO-GO'; recomendacion = 'Hay requisitos que tu empresa aparentemente no cumple. Solo tiene sentido participar con un aliado que los cubra (consorcio o unión temporal) o si la entidad aclara el requisito.';
    } else if (bloqueantes.length) {
      titulo = 'REVISAR'; recomendacion = 'Hay requisitos que aparentemente no cumples (abajo, marcados como bloqueantes). Confírmalos en el documento antes de decidir; si se confirman, el resultado es NO-GO salvo que sumes un aliado.';
    } else if (veredicto === 'GO' && !porResolver.length && e.hayPliego !== false) {
      titulo = 'GO'; recomendacion = 'Con la información analizada no hay incumplimientos ni requisitos sin resolver. Confirma con el pliego oficial antes de preparar la oferta.';
    } else if (veredicto === 'NO DETERMINABLE' || e.hayPliego === false) {
      titulo = 'NO DETERMINABLE'; recomendacion = e.hayPliego === false ? 'Todavía no se analizó el documento del proceso: sin él no hay evidencia para decidir.' : 'Falta evidencia para decidir. Resuelve los puntos pendientes de abajo.';
    } else {
      titulo = 'REVISAR'; recomendacion = 'No hay incumplimientos confirmados, pero quedan puntos sin resolver. No decidas hasta cerrarlos.';
    }
    const urgente = dias != null && dias >= 0 && dias <= 5;
    return {
      titulo: titulo, recomendacion: recomendacion, bloqueantes: bloqueantes, porResolver: porResolver, cumple: cumple, total: items.length,
      plazo: dias == null ? null : { dias: dias, urgente: urgente, vencido: dias < 0 },
      aviso: urgente && (bloqueantes.length || porResolver.length) ? 'El cierre está cerca y hay puntos sin resolver: si dependes de una respuesta de la entidad, pídela ya.' : ''
    };
  }

  const Evaluacion = { crear: crear, resumenDecision: resumenDecision };
  if (typeof module !== 'undefined' && module.exports) module.exports = Evaluacion;
  else root.Evaluacion = Evaluacion;
})(typeof window !== 'undefined' ? window : globalThis);
