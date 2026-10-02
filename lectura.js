// Módulo "Lectura de documento": avanza la lectura por tandas de un PDF ya iniciado (capa de
// texto, OCR o IA) y deja el `entry` del análisis consistente. Sin DOM ni estado global: el
// lector (adaptador) y el reanálisis entran por argumentos, así que se prueba sin navegador.
//
// Un `lector` es { metodo: 'texto'|'ocr'|'ia', campoTexto: 'text'|'ocrText', tanda: N,
//   leer(file, desde, hasta, onProgress, entry) -> { text, pagesRead, paginaOffsets, uso?, ms?, rotacion? } }
(function (root) {
  'use strict';

  // Una sola operación de lectura/IA por proceso a la vez (la comparte index.html con la
  // extracción de requisitos). Se sostiene durante toda la operación, incluidas las pausas
  // entre tandas de leerTodo.
  const enCurso = {};

  function acumularUso(entry, result) {
    const u = entry.transcripcionUso || { input_tokens: 0, output_tokens: 0, ms: 0, tandas: 0 };
    u.input_tokens += Number((result.uso && result.uso.input_tokens) || 0);
    u.output_tokens += Number((result.uso && result.uso.output_tokens) || 0);
    u.ms += Number(result.ms || 0);
    u.tandas += 1;
    entry.transcripcionUso = u;
  }

  // PDF-06: tiempo real de cada tanda por método (la lectura lenta deja de ser una impresión).
  function medir(entry, lector, result, ms) {
    const m = entry.lecturaMs = entry.lecturaMs || {};
    const u = m[lector.metodo] = m[lector.metodo] || { tandas: 0, paginas: 0, ms: 0 };
    u.tandas += 1;
    u.paginas += (result.paginaOffsets || []).length;
    u.ms += ms;
  }

  // Suma el resultado de una tanda al entry (texto, offsets de página ya corridos, páginas leídas,
  // tokens de IA, rotación detectada por OCR).
  function aplicarResultado(entry, lector, result) {
    const base = (entry[lector.campoTexto] || '').length;
    entry[lector.campoTexto] = (entry[lector.campoTexto] || '') + result.text;
    entry.paginaOffsets = (entry.paginaOffsets || []).concat(
      (result.paginaOffsets || []).map(p => ({ pagina: p.pagina, hasta: p.hasta + base }))
    );
    entry.pagesRead = result.pagesRead;
    entry.ts = Date.now();
    if (lector.metodo === 'ia') acumularUso(entry, result);
    if (lector.metodo === 'ocr' && result.rotacion != null && entry.ocrRotacion == null) entry.ocrRotacion = result.rotacion;
  }

  // Lee UNA tanda y la suma al entry. Devuelve { liberado: true } si el texto se liberó por
  // falta de espacio (no se puede seguir leyendo sobre un texto que ya no está).
  async function paso(entry, file, lector, onProgress) {
    const desde = entry.pagesRead + 1;
    const hasta = Math.min(entry.numPages, entry.pagesRead + lector.tanda);
    const t0 = Date.now();
    const result = await lector.leer(file, desde, hasta, onProgress, entry);
    const ms = Date.now() - t0;
    if (entry.textoLiberado) return { liberado: true };
    aplicarResultado(entry, lector, result);
    medir(entry, lector, result, ms);
    return { liberado: false };
  }

  // PRIMERA lectura de un documento: crea el entry con la primera tanda. opts: { id, fileName,
  // esSoloEP, minTexto, extenderSiEscaso, onProgress, reanalizar(entry) }.
  //  - minTexto: si el texto leído queda por debajo, devuelve { vacio: true } (documento sin texto
  //    útil: escaneado, o imagen que el OCR/IA no reconoció) y NO crea entry utilizable.
  //  - extenderSiEscaso: con poco texto en la primera tanda y páginas pendientes, lee UNA tanda más
  //    antes de rendirse (portada/índice/anexos de poca densidad no significan "escaneado").
  // lector.marca ({viaOcr:true} / {viaIA:true}) se copia al entry para saber con qué se leyó.
  async function iniciar(file, lector, opts) {
    opts = opts || {};
    if (enCurso[opts.id]) return { enCurso: true };
    enCurso[opts.id] = true;
    try {
      const entry = Object.assign({ id: opts.id, ts: Date.now(), fileName: opts.fileName, numPages: 0, pagesRead: 0, paginaOffsets: [] }, lector.marca || {});
      entry[lector.campoTexto] = '';
      entry.esSoloEP = !!opts.esSoloEP;
      const t0 = Date.now();
      const result = await lector.leer(file, 1, lector.tanda, opts.onProgress, entry);
      const ms = Date.now() - t0;
      entry.numPages = result.numPages;
      aplicarResultado(entry, lector, result);
      medir(entry, lector, result, ms);
      const minTexto = opts.minTexto || 0;
      const corto = () => (entry[lector.campoTexto] || '').trim().length < minTexto;
      if (opts.extenderSiEscaso && corto() && entry.pagesRead < entry.numPages) {
        await paso(entry, file, lector, opts.onProgress);
      }
      if (corto()) return { vacio: true };
      if (opts.reanalizar) opts.reanalizar(entry);
      return { entry: entry, terminado: entry.pagesRead >= entry.numPages };
    } finally {
      delete enCurso[opts.id];
    }
  }

  // opts: { onProgress, reanalizar(entry) }
  async function avanzar(entry, file, lector, opts) {
    opts = opts || {};
    if (enCurso[entry.id]) return { enCurso: true };
    enCurso[entry.id] = true;
    try {
      const r = await paso(entry, file, lector, opts.onProgress);
      if (r.liberado) return { liberado: true };
      if (opts.reanalizar) opts.reanalizar(entry);
      return { terminado: entry.pagesRead >= entry.numPages };
    } finally {
      delete enCurso[entry.id];
    }
  }

  // opts: { onTanda(desde, hasta, tandaActual, tandasTotal), cancelado(), reanalizar(entry), onProgreso(entry) }
  // Reanaliza UNA vez al terminar, o al fallar a medias (el entry ya trae lo leído hasta ahí).
  async function leerTodo(entry, file, lector, opts) {
    opts = opts || {};
    if (enCurso[entry.id]) return { enCurso: true };
    enCurso[entry.id] = true;
    try {
      let liberado = false;
      try {
        while (entry.pagesRead < entry.numPages) {
          if (opts.cancelado && opts.cancelado()) break;
          const desde = entry.pagesRead + 1;
          const hasta = Math.min(entry.numPages, entry.pagesRead + lector.tanda);
          if (opts.onTanda) opts.onTanda(desde, hasta, Math.ceil(desde / lector.tanda), Math.ceil(entry.numPages / lector.tanda));
          const r = await paso(entry, file, lector, null);
          if (r.liberado) { liberado = true; break; }
          if (opts.onProgreso) opts.onProgreso(entry);
        }
      } catch (err) {
        if (opts.reanalizar) opts.reanalizar(entry);
        throw err;
      }
      if (liberado) return { liberado: true };
      if (opts.reanalizar) opts.reanalizar(entry);
      return { terminado: entry.pagesRead >= entry.numPages };
    } finally {
      delete enCurso[entry.id];
    }
  }

  const ETIQUETA_METODO = { texto: 'Texto', ocr: 'OCR', ia: 'IA' };
  // Texto corto para mostrar al usuario: "OCR: 30 páginas en 150 s (5 s/página)".
  function resumenTiempos(entry) {
    const m = entry && entry.lecturaMs;
    if (!m) return '';
    return Object.keys(m).map(k => {
      const u = m[k];
      const seg = Math.max(1, Math.round(u.ms / 1000));
      const porPagina = u.paginas > 0 && u.ms >= 2000 ? ' (' + Math.round(u.ms / 1000 / u.paginas * 10) / 10 + ' s/página)' : '';
      return (ETIQUETA_METODO[k] || k) + ': ' + u.paginas + ' páginas en ' + seg + ' s' + porPagina;
    }).join(' · ');
  }

  const Lectura = { enCurso: enCurso, resumenTiempos: resumenTiempos, iniciar: iniciar, avanzar: avanzar, leerTodo: leerTodo, acumularUso: acumularUso };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lectura;
  else root.Lectura = Lectura;
})(typeof window !== 'undefined' ? window : globalThis);
