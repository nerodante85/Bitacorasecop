// Motor del veredicto GO / REVISAR / NO-GO de un proceso contra el perfil de una empresa.
// Sin DOM, sin red y sin estado global: todo lo que necesita entra por `deps` (las piezas que siguen
// viviendo en index.html: formato de dinero, lectura de palabras clave, matriz de capacidad...) y por
// el `ctx` de cada evaluación ({ minV, maxV, perfilesProfesionales, perfiles }). Así se prueba en Node
// sin navegador. Uso: const motor = Evaluacion.crear(deps); motor.evaluarProceso(item, s, matriz, entry, ctx).
(function (root) {
  'use strict';

  function crear(deps) {
    const { fmtMoney, truncate, palabrasClaveDe, esTokenNumerico, normHeader, compararIndiceConUmbral,
            gatesCompletitudIA, lecturaParcial, experienciaGateDetalle, matrizCapacidad } = deps;
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
    return { veredicto: veredicto, gates: gatesFinal, conPliego: !!entry, perfil: matriz.nombre, perfilId: matriz.id };
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


    return {
      gateCapacidadVsValor: gateCapacidadVsValor, ajustarGatesPorContratosIncompletos: ajustarGatesPorContratosIncompletos,
      gateLecturaParcial: gateLecturaParcial, decidirVeredicto: decidirVeredicto, compsDe: compsDe,
      codigosExigidosEnPliego: codigosExigidosEnPliego, gatePersonalRequerido: gatePersonalRequerido,
      evaluarProceso: evaluarProceso, evaluarContraPerfiles: evaluarContraPerfiles
    };
  }

  const Evaluacion = { crear: crear };
  if (typeof module !== 'undefined' && module.exports) module.exports = Evaluacion;
  else root.Evaluacion = Evaluacion;
})(typeof window !== 'undefined' ? window : globalThis);
