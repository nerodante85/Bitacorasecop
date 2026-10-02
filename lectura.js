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

  // Lee UNA tanda y la suma al entry. Devuelve { liberado: true } si el texto se liberó por
  // falta de espacio (no se puede seguir leyendo sobre un texto que ya no está).
  async function paso(entry, file, lector, onProgress) {
    const desde = entry.pagesRead + 1;
    const hasta = Math.min(entry.numPages, entry.pagesRead + lector.tanda);
    const result = await lector.leer(file, desde, hasta, onProgress, entry);
    if (entry.textoLiberado) return { liberado: true };
    const base = (entry[lector.campoTexto] || '').length;
    entry[lector.campoTexto] = (entry[lector.campoTexto] || '') + result.text;
    entry.paginaOffsets = (entry.paginaOffsets || []).concat(
      (result.paginaOffsets || []).map(p => ({ pagina: p.pagina, hasta: p.hasta + base }))
    );
    entry.pagesRead = result.pagesRead;
    entry.ts = Date.now();
    if (lector.metodo === 'ia') acumularUso(entry, result);
    if (lector.metodo === 'ocr' && result.rotacion != null && entry.ocrRotacion == null) entry.ocrRotacion = result.rotacion;
    return { liberado: false };
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

  const Lectura = { enCurso: enCurso, avanzar: avanzar, leerTodo: leerTodo, acumularUso: acumularUso };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lectura;
  else root.Lectura = Lectura;
})(typeof window !== 'undefined' ? window : globalThis);
