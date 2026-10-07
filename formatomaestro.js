// Importador del Formato Maestro de Experiencia (plantillas/Formato_Maestro_Experiencia_BitacoraSECOP_v1.xlsx).
// Sin DOM, sin red y sin librería de Excel: recibe las hojas ya leídas como arreglos de filas (encabezado -> valor)
// y devuelve los contratos con la MISMA forma que produce la lectura de Excel antigua, más los contratos en ejecución
// con la forma de "Capacidad Residual". No usa las columnas calculadas del libro (un archivo recién generado no trae
// valores guardados de las fórmulas): todo se recalcula desde los datos de entrada.
// Uso: const d = FormatoMaestro.leer({ SUJETOS: filas, CONTRATOS: filas, PARTICIPACIONES: filas });
//      const r = FormatoMaestro.importar(d, { sujetoId: 'S-003', incluirVinculadas: true });
(function (root) {
  'use strict';

  const HOJAS_OBLIGATORIAS = ['SUJETOS', 'CONTRATOS', 'PARTICIPACIONES'];
  const ESTADOS_NO_ACREDITAN = ['EN EJECUCION', 'SUSPENDIDO'];

  const sinAcentos = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const claveCol = s => sinAcentos(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const texto = v => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  const normTexto = v => sinAcentos(texto(v)).toUpperCase();

  // Cada fila pasa a un objeto con las columnas normalizadas (ID_CONTRATO, NUMERO_CONTRATO...).
  function normalizarFilas(filas) {
    return (filas || []).map(f => {
      const o = {};
      Object.keys(f || {}).forEach(k => { o[claveCol(k)] = f[k]; });
      return o;
    });
  }

  function numero(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).replace(/[\s$]/g, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseFloat(s.replace(/,/g, ''));
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (/^-?\d+,\d+$/.test(s)) return parseFloat(s.replace(',', '.'));
    return null;
  }

  // Porcentaje: 0,45 / 45 % / "45%" -> fracción 0..1. Un número mayor que 1 se lee como porcentaje entero (45 -> 0,45).
  function porcentaje(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v > 0 && v <= 1 ? v : (v > 1 && v <= 100 ? v / 100 : null);
    const s = String(v).trim();
    const m = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(s);
    if (m) { const p = parseFloat(m[1].replace(',', '.')) / 100; return p > 0 && p <= 1 ? p : null; }
    const n = numero(s);
    return n == null ? null : porcentaje(n);
  }

  const pad = n => String(n).padStart(2, '0');
  const isoValida = (y, m, d) => y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? y + '-' + pad(m) + '-' + pad(d) : null;
  // Fecha: número de serie de Excel, Date, o texto AAAA-MM-DD / D/M/AAAA. Devuelve 'AAAA-MM-DD' o null.
  function fechaISO(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : isoValida(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') {
      if (v < 32874 || v > 73415) return null; // 1990..2100
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return isoValida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return isoValida(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return isoValida(+m[3], +m[2], +m[1]); // día/mes/año (formato colombiano)
    return null;
  }

  function esFormatoMaestro(nombresHojas) {
    const set = new Set((nombresHojas || []).map(n => claveCol(n)));
    return HOJAS_OBLIGATORIAS.every(h => set.has(h));
  }

  // hojas: { SUJETOS, CONTRATOS, PARTICIPACIONES, [UNSPSC], [CANTIDADES] } con filas = objetos encabezado -> valor.
  function leer(hojas) {
    const errores = [];
    const por = {};
    Object.keys(hojas || {}).forEach(k => { por[claveCol(k)] = hojas[k]; });
    HOJAS_OBLIGATORIAS.forEach(h => { if (!por[h]) errores.push('Falta la hoja ' + h + '.'); });
    if (errores.length) return { errores: errores, sujetos: [], contratos: [], participaciones: [] };
    const sujetos = normalizarFilas(por.SUJETOS).filter(r => texto(r.ID_SUJETO)).map(r => ({
      id: texto(r.ID_SUJETO), tipo: normTexto(r.TIPO) === 'PERSONA NATURAL' ? 'Persona natural' : 'Empresa', nombre: texto(r.NOMBRE),
      documento: texto(r.DOCUMENTO), cuentaPara: texto(r.CUENTA_PARA)
    }));
    const contratos = normalizarFilas(por.CONTRATOS).filter(r => texto(r.ID_CONTRATO));
    const participaciones = normalizarFilas(por.PARTICIPACIONES).filter(r => texto(r.ID_CONTRATO) && texto(r.ID_SUJETO));
    const unspsc = normalizarFilas(por.UNSPSC || []).filter(r => texto(r.ID_CONTRATO) && /^\d{8}$/.test(texto(r.CODIGO_UNSPSC)));
    const cantidades = normalizarFilas(por.CANTIDADES || []).filter(r => texto(r.ID_CONTRATO) && texto(r.ITEM));
    if (!sujetos.length) errores.push('La hoja SUJETOS no tiene ningún sujeto con ID_SUJETO.');
    if (!contratos.length) errores.push('La hoja CONTRATOS no tiene ningún contrato con ID_CONTRATO.');
    if (!participaciones.length) errores.push('La hoja PARTICIPACIONES no tiene ninguna participación.');
    return { errores: errores, sujetos: sujetos, contratos: contratos, participaciones: participaciones, unspsc: unspsc, cantidades: cantidades };
  }

  // Sugiere qué sujeto es la empresa del perfil, comparando palabras del nombre (sin razón social).
  function sujetoSugerido(sujetos, nombrePerfil) {
    const stop = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'S', 'A', 'SA', 'SAS', 'LTDA', 'EU', 'CIA', 'CONSTRUCTORA', 'CONSTRUCCIONES', 'INGENIERIA', 'SOCIEDAD']);
    const toks = s => new Set(normTexto(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(w => w && !stop.has(w)));
    const p = toks(nombrePerfil);
    if (!p.size) return null;
    let mejor = null, mejorPuntaje = 0;
    (sujetos || []).forEach(s => {
      const t = toks(s.nombre); const comunes = [...p].filter(x => t.has(x)).length;
      const puntaje = comunes / Math.max(p.size, t.size);
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = s.id; }
    });
    return mejorPuntaje >= 0.5 ? mejor : null;
  }

  const TIPO_CLIENTE = { PUBLICO: 'publico', PRIVADO: 'privado', CONCESIONARIO: 'concesionario', OTRO: 'otro' };

  // Contratos de un sujeto (y, si se pide, de las personas que cuentan para él), en la forma del motor de experiencia.
  // Un contrato en el que participan varias personas/empresas del mismo destino se junta en UNA entrada con la suma
  // de sus porcentajes (para que "mínimo N contratos" no cuente dos veces el mismo contrato).
  function importar(datos, opciones) {
    opciones = opciones || {};
    const avisos = [];
    const sujetoId = opciones.sujetoId;
    const sujeto = (datos.sujetos || []).find(s => s.id === sujetoId);
    if (!sujeto) return { contratos: [], enEjecucion: [], avisos: ['El sujeto elegido no existe en la hoja SUJETOS.'], resumen: null };
    const ids = new Set([sujetoId]);
    const vinculados = [];
    if (opciones.incluirVinculadas) (datos.sujetos || []).forEach(s => { if (s.cuentaPara === sujetoId && s.id !== sujetoId) { ids.add(s.id); vinculados.push(s); } });
    const nombreDe = id => ((datos.sujetos || []).find(s => s.id === id) || {}).nombre || id;
    const porContrato = new Map();
    (datos.participaciones || []).filter(p => ids.has(texto(p.ID_SUJETO))).forEach(p => {
      const id = texto(p.ID_CONTRATO); if (!porContrato.has(id)) porContrato.set(id, []); porContrato.get(id).push(p);
    });
    const contratosPorId = new Map((datos.contratos || []).map(c => [texto(c.ID_CONTRATO), c]));
    const unspscDe = id => (datos.unspsc || []).filter(r => texto(r.ID_CONTRATO) === id).map(r => texto(r.CODIGO_UNSPSC));
    const cantidadesDe = id => (datos.cantidades || []).filter(r => texto(r.ID_CONTRATO) === id).map(r => ({ item: texto(r.ITEM), cantidad: numero(r.CANTIDAD), unidad: texto(r.UNIDAD) }));
    const salida = [], enEjecucion = [];
    let sinContrato = 0, sinValor = 0, sinFechaFin = 0, sinPorcentaje = 0, noAcreditan = 0, sinNumero = 0;
    let i = 0;
    porContrato.forEach((parts, idContrato) => {
      const c = contratosPorId.get(idContrato);
      if (!c) { sinContrato++; return; }
      i++;
      const estadoNorm = normTexto(c.ESTADO);
      const ejecucion = ESTADOS_NO_ACREDITAN.indexOf(estadoNorm) !== -1;
      // Participación del destino: suma de los porcentajes registrados. "Individual" sin porcentaje = 100 %.
      let suma = 0, faltaPct = false;
      parts.forEach(p => {
        const pc = porcentaje(p.PORCENTAJE);
        if (pc != null) suma += pc; else if (normTexto(p.FORMA_EJECUCION) === 'INDIVIDUAL') suma += 1; else faltaPct = true;
      });
      const pctDestino = faltaPct ? null : Math.min(suma, 1);
      if (suma > 1.0001) avisos.push('Contrato ' + idContrato + ': las participaciones suman más de 100 % (' + Math.round(suma * 1000) / 10 + ' %); se tomó 100 %.');
      const valorNominal = numero(c.VALOR_CONTRATO);
      const numeroTxt = texto(c.NUMERO_CONTRATO);
      const numeroReal = numeroTxt && normTexto(numeroTxt) !== 'S/N' ? numeroTxt : null;
      const inicio = fechaISO(c.FECHA_INICIO), fin = fechaISO(c.FECHA_TERMINACION);
      const cargos = [...new Set(parts.map(p => texto(p.CARGO_PROFESIONAL)).filter(Boolean))];
      const formas = [...new Set(parts.map(p => texto(p.FORMA_EJECUCION)).filter(Boolean))];
      const figura = parts.map(p => texto(p.NOMBRE_FIGURA)).find(Boolean) || '';
      if (!numeroReal) sinNumero++;
      if (valorNominal == null || valorNominal <= 0) sinValor++;
      if (!ejecucion && !fin) sinFechaFin++;
      if (pctDestino == null) sinPorcentaje++;
      if (ejecucion) noAcreditan++;
      const esp = texto(c.ESPECIALIDAD), act = texto(c.TIPO_ACTIVIDAD);
      salida.push({
        fila: i,
        objeto: texto(c.OBJETO) || null,
        contratante: texto(c.ENTIDAD) || null,
        // Valor NOMINAL del contrato; la participación se pondera en valorAcreditable (no se pre-multiplica aquí).
        // Sin porcentaje (y sin ser individual) no se afirma un valor: ante la duda, no determinable.
        valor: pctDestino == null ? null : (valorNominal != null && valorNominal > 0 ? valorNominal : null),
        valorRaw: valorNominal == null ? null : String(valorNominal),
        valorAjustado: false,
        valorNominal: false,
        fechaInicio: inicio,
        fechaFin: fin,
        enEjecucion: ejecucion,
        duracion: null,
        cantidad: null,
        cantidadRaw: null,
        tipo: 'no-clasificado',
        actividades: [esp, act].filter(Boolean).join(' · ') || null,
        numeroContrato: numeroReal,
        participacion: pctDestino == null ? null : { valor: Math.round(pctDestino * 10000) / 100, unidad: '%', raw: Math.round(pctDestino * 1000) / 10 + ' %' },
        // Datos propios del formato (el motor actual no los usa; quedan para futuras reglas y para la revisión):
        formatoMaestro: {
          idContrato: idContrato, estado: texto(c.ESTADO), especialidad: esp || null, actividad: act || null,
          sujetos: parts.map(p => nombreDe(texto(p.ID_SUJETO))), cargos: cargos, formas: formas, figura: figura || null,
          unspsc: unspscDe(idContrato), cantidades: cantidadesDe(idContrato), alertasOrigen: null
        }
      });
      if (ejecucion) {
        const ejecutado = numero(c.VALOR_EJECUTADO);
        const consorcio = formas.some(f => normTexto(f) !== 'INDIVIDUAL');
        enEjecucion.push({
          id: 'fm-' + idContrato, nombre: texto(c.OBJETO).slice(0, 80), numero: numeroReal || '', entidad: texto(c.ENTIDAD),
          tipoCliente: TIPO_CLIENTE[normTexto(c.TIPO_CLIENTE)] || 'publico', estado: estadoNorm === 'SUSPENDIDO' ? 'suspendido' : 'en_ejecucion',
          valorInicial: numero(c.VALOR_INICIAL) != null ? String(numero(c.VALOR_INICIAL)) : '',
          valorActual: valorNominal != null ? String(valorNominal) : '', valorEjecutado: ejecutado != null ? String(ejecutado) : '', saldo: '',
          fechaInicio: inicio || '', fechaFin: fin || '', consorcio: consorcio,
          participacion: consorcio && pctDestino != null ? String(Math.round(pctDestino * 10000) / 100) : '', soporte: texto(c.SOPORTE)
        });
      }
    });
    if (sinContrato) avisos.push(sinContrato + ' participación(es) apuntan a un contrato que no está en la hoja CONTRATOS; se omitieron.');
    if (sinValor) avisos.push(sinValor + ' contrato(s) sin valor: no podrán acreditar cuantía.');
    if (sinPorcentaje) avisos.push(sinPorcentaje + ' contrato(s) en consorcio o unión temporal sin porcentaje: se importan sin valor hasta que lo registre.');
    if (sinFechaFin) avisos.push(sinFechaFin + ' contrato(s) terminado(s) sin fecha de terminación: los requisitos con ventana de tiempo quedarán sin determinar.');
    if (noAcreditan) avisos.push(noAcreditan + ' contrato(s) en ejecución o suspendidos: no acreditan experiencia (sí descuentan Capacidad Residual).');
    return {
      contratos: salida, enEjecucion: enEjecucion, avisos: avisos,
      resumen: { sujeto: sujeto.nombre, vinculados: vinculados.map(v => v.nombre), contratos: salida.length, enEjecucion: enEjecucion.length, sinNumero: sinNumero, sinValor: sinValor, sinFechaFin: sinFechaFin, sinPorcentaje: sinPorcentaje }
    };
  }

  const FormatoMaestro = { esFormatoMaestro: esFormatoMaestro, leer: leer, sujetoSugerido: sujetoSugerido, importar: importar, fechaISO: fechaISO, porcentaje: porcentaje, numero: numero };
  if (typeof module !== 'undefined' && module.exports) module.exports = FormatoMaestro;
  else root.FormatoMaestro = FormatoMaestro;
})(typeof window !== 'undefined' ? window : globalThis);
