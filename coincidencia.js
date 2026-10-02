// Reglas compartidas de "¿este proceso coincide con mi búsqueda o alerta?": las usan el navegador
// (index.html) y la función diaria (supabase/functions/daily-digest). Un solo origen: este archivo.
// daily-digest necesita su propia copia dentro de su carpeta (la CLI de Supabase solo empaqueta lo
// que está bajo la carpeta de la función); una prueba de tests/smoke.mjs falla si las dos difieren
// -- para actualizarla: cp coincidencia.js supabase/functions/daily-digest/
// Sin DOM, sin red y sin estado global: funciones puras (se prueban en Node sin navegador).
(function (root) {
  'use strict';

  // Parsea un número en formato colombiano: "1.234.567,89" -> 1234567.89 ; "1,33" -> 1.33 ;
  // "3.500.000.000" -> 3500000000. Si hay coma, es el decimal (los puntos son miles); si no hay
  // coma pero sí puntos de miles, se quitan.
  function parseNumCO(s) {
    if (s == null) return null;
    let t = String(s).replace(/[^\d.,\-]/g, '');
    if (!/\d/.test(t)) return null;
    // MC-015: "1,234,567,890" (varias comas = miles) valía 1,234 y "1,500.50" (formato anglosajón)
    // valía 1,5005. Si hay coma Y punto, el separador que aparece ÚLTIMO es el decimal; con varias
    // comas todas son de miles. Una sola coma sigue siendo decimal (razones: "1,5").
    const nComas = (t.match(/,/g) || []).length;
    if (nComas > 0 && t.indexOf('.') !== -1) {
      if (t.lastIndexOf('.') > t.lastIndexOf(',')) t = t.replace(/,/g, '');
      else t = t.replace(/\./g, '').replace(',', '.');
    }
    else if (nComas > 1) t = t.replace(/,/g, '');
    else if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
    else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}(\D|$)/.test(t + ' ')) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  }

  // Coincidencia GEOGRÁFICA: igualdad exacta de departamento (sin acentos ni mayúsculas), NO
  // contención de texto. "Santander" no debe traer "Norte de Santander" ni al revés.
  function normalizeGeo(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')        // quita acentos
      .replace(/[^a-z\s]/g, ' ')                               // puntuación -> espacio
      .replace(/^\s*(departamento|dpto|depto)\s+(de\s+)?/, '') // "Departamento de X" -> "X"
      .replace(/\s+/g, ' ')
      .trim();
  }
  function matchesGeo(departamento, term) {
    const d = normalizeGeo(departamento);
    const t = normalizeGeo(term);
    return !!d && !!t && d === t;
  }

  // Coincidencia por término: frase completa literal, o TODAS las palabras del término (en
  // cualquier orden); las de 6+ letras también por su raíz de 6 caracteres (pavimento /
  // pavimentación, edificio / edificación, alcantarilla / alcantarillado). Las de <6 letras exigen
  // coincidencia exacta. `searchable` ya viene en minúsculas.
  function matchesTerm(searchable, term) {
    if (!term) return false;
    const t = String(term).toLowerCase().trim();
    if (!t) return false;
    if (searchable.includes(t)) return true; // frase completa literal
    const words = t.split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    return words.every(w =>
      searchable.includes(w) || (w.length >= 6 && searchable.includes(w.slice(0, 6)))
    );
  }

  function findField(record, exactCandidates, substrFallback) {
    const keys = Object.keys(record);
    for (const c of exactCandidates) {
      const k = keys.find(k => k.toLowerCase() === c.toLowerCase());
      if (k && record[k] !== null && record[k] !== undefined && record[k] !== '') return record[k];
    }
    if (substrFallback) {
      const k = keys.find(k => k.toLowerCase().includes(substrFallback));
      if (k && record[k]) return record[k];
    }
    return null;
  }

  // Ancla de búsqueda ($q: las 2 palabras más largas del nombre -- Socrata combina las de $q con
  // AND, así que menos palabras = más resultados; el filtro fino real lo hace `coincide`) +
  // coincidencia de nombre tolerante (nombre completo vs sigla, uno contenido en el otro, o todos
  // los tokens del más corto en el más largo) + una versión ESTRICTA (SI-001: todas las palabras
  // distintivas del nombre buscado deben estar en el candidato).
  function prepararBusquedaPorNombre(nombre) {
    const norm = s => normalizeGeo(s);
    const objetivo = norm(nombre);
    const toks = objetivo.split(' ').filter(w => w.length >= 4);
    const ancla = toks.slice().sort((a, b) => b.length - a.length).slice(0, 2).join(' ') || objetivo;
    const coincide = candidato => {
      const c = norm(candidato);
      if (!c) return false;
      if (c === objetivo || c.indexOf(objetivo) !== -1 || objetivo.indexOf(c) !== -1) return true;
      const a = c.split(' ').filter(w => w.length >= 4), b = toks;
      const chico = a.length <= b.length ? a : b, grande = a.length <= b.length ? b : a;
      return chico.length >= 2 && chico.every(w => grande.indexOf(w) !== -1);
    };
    const coincideEstricta = candidato => {
      const c = norm(candidato);
      if (!c) return false;
      if (c === objetivo || c.indexOf(objetivo) !== -1) return true;
      const tc = c.split(' ');
      return toks.length >= 2 && toks.every(w => tc.indexOf(w) !== -1);
    };
    return { ancla, coincide, coincideEstricta, palabras: toks.slice().sort((a, b) => b.length - a.length) };
  }

  // Un estado que ya NO es una oportunidad de participar (cancelado, borrador, ya
  // seleccionado/adjudicado, suspendido, en evaluación...) no debe presentarse como oportunidad,
  // aunque no tenga fecha de cierre (S2-003). Un estado desconocido o vacío NO se oculta: mejor
  // mostrar de más que perder un proceso abierto por un estado nuevo.
  function esEstadoNoVigente(estado) {
    const e = String(estado == null ? '' : estado)
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9%\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!e) return false;
    return /^(cancelad|borrador|seleccionad|suspendid|aprobad|en aprobacion|evaluacion|adjudicad|celebrad|liquidad|terminad|declarad|desiert|revocad|descartad)/.test(e);
  }

  // Parámetros de consulta a SECOP II en DOS consultas (S2-001): el orden DESC de Socrata pone los
  // NULL primero y ~127.000 procesos no tienen fecha de publicación, así que con una sola consulta
  // ningún proceso abierto llegaba. VIGENTES = cierre hoy o después (pocas, caben en 300);
  // RECIENTES = publicación no nula, más reciente primero. El término va sin tildes (el filtro fino
  // real es matchesTerm). Devuelve solo los parámetros; la URL base y el token los pone quien llama.
  function consultasSecopII(qTerm, hoyISO) {
    const q = qTerm
      ? '&$q=' + encodeURIComponent(String(qTerm).normalize('NFD').replace(/[̀-ͯ]/g, ''))
      : '';
    return {
      vigentes: '$limit=300' + q +
        '&$where=' + encodeURIComponent("fecha_de_recepcion_de >= '" + hoyISO + "'") +
        '&$order=' + encodeURIComponent('fecha_de_recepcion_de ASC'),
      recientes: '$limit=300' + q +
        '&$where=' + encodeURIComponent('fecha_de_publicacion_del IS NOT NULL') +
        '&$order=' + encodeURIComponent('fecha_de_publicacion_del DESC')
    };
  }

  const Coincidencia = {
    parseNumCO: parseNumCO, normalizeGeo: normalizeGeo, matchesGeo: matchesGeo, matchesTerm: matchesTerm,
    findField: findField, prepararBusquedaPorNombre: prepararBusquedaPorNombre,
    esEstadoNoVigente: esEstadoNoVigente, consultasSecopII: consultasSecopII
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Coincidencia;
  else root.Coincidencia = Coincidencia;
})(typeof window !== 'undefined' ? window : globalThis);
