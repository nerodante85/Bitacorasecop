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
  // Nombres con los que la gente escribe un departamento a mano y que SECOP II guarda distinto
  // («Bogotá» -> "Distrito Capital de Bogotá"; con el texto crudo el servidor y matchesGeo daban 0 resultados).
  // Cualquier otro texto se devuelve tal cual lo escribió el usuario. Claves ya normalizadas con normalizeGeo.
  const DEPARTAMENTOS_ALIAS = {
    'bogota': 'Distrito Capital de Bogotá', 'bogota d c': 'Distrito Capital de Bogotá', 'bogota dc': 'Distrito Capital de Bogotá',
    'distrito capital': 'Distrito Capital de Bogotá', 'distrito capital de bogota': 'Distrito Capital de Bogotá',
    'san andres': 'San Andrés, Providencia y Santa Catalina', 'san andres y providencia': 'San Andrés, Providencia y Santa Catalina',
    'san andres providencia y santa catalina': 'San Andrés, Providencia y Santa Catalina',
    'guajira': 'La Guajira'
  };
  function departamentoSecop(texto) {
    return DEPARTAMENTOS_ALIAS[normalizeGeo(texto)] || texto;
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
  //
  // DEPARTAMENTO EN EL SERVIDOR: con `geos`, las dos consultas filtran por departamento_entidad. Sin esto la
  // muestra era de TODO el país (o de todo lo que menciona el nombre) y el filtro fino del navegador trabajaba
  // sobre 300 filas: en Boyacá (~9.500 procesos en 60 días) esas 300 eran contratación directa y mínima cuantía,
  // y las 30 licitaciones de obra quedaban fuera (0 de 300). Las vocales se vuelven comodín `_` para no depender
  // de las tildes del dato ("BOYAC_" casa con "Boyacá"); matchesGeo sigue siendo el filtro exacto del navegador.
  function filtroDepartamento(geos, conSinDepartamento) {
    const patrones = [];
    (geos || []).forEach(g => {
      const n = normalizeGeo(g);
      if (n.replace(/\s/g, '').length < 3) return;
      // La N también es comodín: «Nariño» llega como «narino» y el dato tiene Ñ ("NARIÑO"), que no casa con N.
      const p = n.toUpperCase().replace(/[AEIOUN]/g, '_').replace(/ +/g, '%').replace(/'/g, "''");
      if (patrones.indexOf(p) === -1) patrones.push(p);
    });
    if (!patrones.length) return '';
    const cond = patrones.map(p => "upper(departamento_entidad) like '" + p + "'");
    // Algunas entidades (Otanche) vienen con departamento «No Definido» y solo el municipio en
    // ciudad_de_la_unidad_de: en las VIGENTES (pocas: ~60 en todo el país) se traen también y el
    // navegador las resuelve por municipio con ubicacionDeRegistro (nunca si el municipio es ambiguo).
    if (conSinDepartamento) cond.push("departamento_entidad = 'No Definido'");
    return cond.length === 1 ? cond[0] : '(' + cond.join(' OR ') + ')';
  }

  // Municipio EN EL SERVIDOR (superconjunto del filtro exacto del navegador, matchesMunicipio): cada palabra de 4+ letras
  // debe aparecer en la ciudad de la entidad o en la de la unidad de contratación. Como el dato lleva tildes y Ñ
  // ("Ocaña", "CÚCUTA") y LIKE no las ignora, cada vocal se vuelve el comodín '_' (una vocal con tilde sigue siendo UN
  // carácter: "cucuta" -> %C_C_T_%); la N se prueba como N y como Ñ (una Ñ escrita por el usuario queda literal).
  function patronesMunicipio(palabra) {
    const base = String(palabra).toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\u0001]/g, '');
    const ns = (base.match(/n/g) || []).length;
    let patrones = [''];
    base.split('').forEach(ch => {
      let opciones;
      if (ch === '\u0001') opciones = ['Ñ'];
      else if (/[aeiou]/.test(ch)) opciones = ['_'];
      else if (ch === 'n') opciones = ns <= 2 ? ['N', 'Ñ'] : ['_'];
      else opciones = [ch.toUpperCase()];
      const sig = [];
      patrones.forEach(pt => opciones.forEach(o => sig.push(pt + o)));
      patrones = sig;
    });
    return patrones.map(pt => '%' + pt + '%');
  }
  function filtroMunicipio(municipios) {
    const grupos = [];
    (municipios || []).forEach(m => {
      const t = normalizeGeo(m);
      let palabras = t.split(' ').filter(w => w.length >= 4);
      if (!palabras.length && t.replace(/\s/g, '').length >= 3) palabras = [t.replace(/\s/g, '')];
      if (!palabras.length) return;
      const conds = palabras.map(w => {
        const ps = patronesMunicipio(String(m).toLowerCase().split(/\s+/).find(x => normalizeGeo(x) === w) || w);
        const porColumna = ['ciudad_entidad', 'ciudad_de_la_unidad_de'].map(col => ps.map(p => "upper(" + col + ") like '" + p + "'"));
        return '(' + porColumna[0].concat(porColumna[1]).join(' OR ') + ')';
      });
      grupos.push(conds.length === 1 ? conds[0] : '(' + conds.join(' AND ') + ')');
    });
    if (!grupos.length) return '';
    return grupos.length === 1 ? grupos[0] : '(' + grupos.join(' OR ') + ')';
  }

  // Palabras de «Entidad (contiene)». «Alcaldía» y «municipio» son la MISMA entidad con nombres distintos en el dataset
  // (la alcaldía de Cúcuta es «MUNICIPIO DE SAN JOSE DE CUCUTA.», la de Ocaña «ALCALDIA MUNICIPAL DE OCAÑA»): si el
  // texto trae una de las dos, basta que el nombre traiga cualquiera (`generica`) y «municipal» deja de exigirse.
  // Un «instituto municipal…» o la policía de Cúcuta NO son la alcaldía (no traen alcaldía ni municipio).
  function palabrasDeEntidad(texto) {
    const ws = normalizeGeo(texto).split(' ').filter(w => w.length >= 2);
    const generica = ws.some(w => w === 'alcaldia' || w === 'municipio');
    const requeridas = ws.filter(w => w !== 'alcaldia' && w !== 'municipio' && !(generica && w === 'municipal'));
    return { requeridas: requeridas, generica: generica };
  }

  // Entidad EN EL SERVIDOR (superconjunto de coincideEntidad del navegador): basta con exigir las palabras largas
  // (4+ letras; si no hay, las de 3 o 2), cada una con las vocales como comodín '_'. Con la entidad solo en el navegador la
  // UFPS tenía 385 procesos en 60 días y llegaban 3 (INVÍAS: ninguno de ~5.000).
  function filtroEntidad(texto) {
    const e = palabrasDeEntidad(texto);
    if (!e.requeridas.length && !e.generica) return '';
    let palabras = e.requeridas.filter(w => w.length >= 4);
    if (!palabras.length) palabras = e.requeridas.filter(w => w.length >= 3);
    if (!palabras.length) palabras = e.requeridas;
    const como = w => '(' + patronesMunicipio(w).map(p => "upper(entidad) like '" + p + "'").join(' OR ') + ')';
    const conds = palabras.map(como);
    if (e.generica) conds.push('(' + como('alcaldia') + ' OR ' + como('municipio') + ')');
    return conds.length === 1 ? conds[0] : '(' + conds.join(' AND ') + ')';
  }

  // "Cúcuta" también debe encontrar "San José de Cúcuta" -- una comparación EXACTA (como matchesGeo, adecuada para
  // departamento) sería demasiado estricta para municipios, que casi siempre traen un nombre oficial más largo del
  // que la gente usa a diario: toda palabra significativa (>=4 letras) del término debe aparecer en el nombre.
  function matchesMunicipio(ciudad, term) {
    const c = normalizeGeo(ciudad);
    const t = normalizeGeo(term);
    if (!c || !t) return false;
    if (c === t) return true;
    const palabras = t.split(' ').filter(w => w.length >= 4);
    if (!palabras.length) return c.indexOf(t) !== -1;
    return palabras.every(w => c.indexOf(w) !== -1);
  }

  // «Entidad (contiene)»: todas las palabras del texto deben estar en el nombre de la entidad (alcaldía = municipio).
  function coincideEntidad(entidad, texto) {
    const p = palabrasDeEntidad(texto);
    if (!p.requeridas.length && !p.generica) return true;
    const e = ' ' + normalizeGeo(entidad) + ' ';
    if (p.generica && e.indexOf('alcaldia') === -1 && e.indexOf('municipio') === -1) return false;
    return p.requeridas.every(w => e.indexOf(w) !== -1);
  }

  // «Solo Licitación Pública (Obra pública)»: la modalidad dice «licitación pública» Y «obra» (las variantes
  // «Licitación pública Obra Publica» entran; la licitación genérica o la contratación directa, no).
  function esLicitacionObra(modalidad) {
    const m = String(modalidad == null ? '' : modalidad);
    return /licitaci[oó]n\s*p[uú]blica/i.test(m) && /obra/i.test(m);
  }

  // Filtros de una alerta guardada que van más allá de palabras clave, departamento y valor: municipios, entidad y
  // «solo licitación de obra». Una alerta guardada antes de existir estos campos no los trae y no filtra por ellos.
  // Las mismas opciones viajan al servidor (consultasSecopII) y se vuelven a aplicar fila por fila (coincideFiltrosAlerta).
  function opcionesDeAlerta(alerta) {
    const a = alerta || {};
    return {
      soloLicitacionObra: !!a.soloLicitacion,
      municipios: (Array.isArray(a.municipios) ? a.municipios : []).filter(m => typeof m === 'string' && m.trim()).map(m => m.trim()),
      entidad: typeof a.entidad === 'string' ? a.entidad.trim() : '',
      minV: Number(a.minV) > 0 ? Number(a.minV) : 0,
      maxV: Number(a.maxV) > 0 ? Number(a.maxV) : 0
    };
  }
  function coincideFiltrosAlerta(alerta, reg) {
    const o = opcionesDeAlerta(alerta);
    const r = reg || {};
    if (o.municipios.length && !o.municipios.some(m => matchesMunicipio(r.ciudad, m))) return false;
    if (o.entidad && !coincideEntidad(r.entidad, o.entidad)) return false;
    if (o.soloLicitacionObra && !esLicitacionObra(r.modalidad)) return false;
    return true;
  }

  // Rango de valor EN EL SERVIDOR (precio_base es numérico). Misma regla que cumpleRangoValor del navegador: un proceso
  // sin valor (nulo o 0) NO se oculta por el rango. Con el rango solo en el navegador llegaba ~6 % de los procesos que
  // cumplen (Norte de Santander 500–3.000 M: 10 de 165); los sin valor son pocos (~1,5 % de los publicados en 60 días).
  function filtroValor(minV, maxV) {
    const n = v => { const x = Number(v); return isFinite(x) && x > 0 && x < 1e15 ? String(Math.floor(x)) : ''; };
    const a = n(minV), b = n(maxV);
    if (!a && !b) return '';
    const rango = [a ? 'precio_base >= ' + a : '', b ? 'precio_base <= ' + b : ''].filter(Boolean).join(' AND ');
    return '(precio_base IS NULL OR precio_base <= 0 OR (' + rango + '))';
  }

  // Adjudicaciones de una entidad (base de la sugerencia de oferta). Antes eran 400 filas por palabra clave, sin orden ni
  // filtro, y la app veía 43 de 5.829 adjudicaciones de la Gobernación de Norte de Santander y 0 de 612 de la Alcaldía de
  // Ocaña. Ahora en dos pasos: 1) `consultaNombresEntidad` agrupa los adjudicados por nombre de entidad con un filtro
  // flojo (vocales comodín) y el navegador se queda con los nombres que `coincide`; 2) `consultaAdjudicacionesDe`
  // pide, por nombre EXACTO, sus adjudicaciones más recientes (con el patrón flojo solo, una "OCAÑA" traía 500 filas y
  // 24 eran de la alcaldía). Devuelven null si no hay con qué consultar (quien llama usa la ancla de siempre).
  function consultaNombresEntidad(nombre) {
    // Sin ninguna palabra de 4+ letras (o sin «alcaldía/municipio») el filtro sería casi todo el dataset.
    const e = palabrasDeEntidad(nombre);
    if (!e.generica && !e.requeridas.some(w => w.length >= 4)) return null;
    const ent = filtroEntidad(nombre);
    if (!ent) return null;
    return '$select=' + encodeURIComponent('entidad,count(*) as n') +
      '&$where=' + encodeURIComponent("adjudicado = 'Si' AND " + ent) +
      '&$group=entidad&$order=' + encodeURIComponent('n DESC') + '&$limit=40';
  }
  function consultaAdjudicacionesDe(nombres) {
    const lista = (Array.isArray(nombres) ? nombres : []).filter(n => typeof n === 'string' && n.trim()).slice(0, 10);
    if (!lista.length) return null;
    const en = lista.map(n => "'" + n.replace(/'/g, "''") + "'").join(', ');
    return '$limit=500&$where=' + encodeURIComponent("adjudicado = 'Si' AND fecha_de_publicacion_del IS NOT NULL AND entidad IN (" + en + ")") +
      '&$order=' + encodeURIComponent('fecha_de_publicacion_del DESC');
  }

  // Mapa municipio -> departamento sacado del propio dataset (pares ciudad_entidad/departamento_entidad
  // de las entidades que sí traen ambos). Un municipio que aparece en MÁS de un departamento (Caldas,
  // Belén, Santa María...) queda en null: no se adivina. Claves sin tildes ni mayúsculas.
  const SIN_DEPARTAMENTO = 'nodefinido';
  const sinDef = v => { const t = normalizeGeo(v); return !t || t.replace(/\s/g, '') === SIN_DEPARTAMENTO; };
  function mapaMunicipios(filas) {
    const vistos = {};
    (filas || []).forEach(f => {
      if (!f || sinDef(f.ciudad_entidad) || sinDef(f.departamento_entidad)) return;
      const c = normalizeGeo(f.ciudad_entidad);
      const d = String(f.departamento_entidad).trim();
      if (!vistos[c]) vistos[c] = {};
      vistos[c][normalizeGeo(d)] = d;
    });
    const mapa = {};
    Object.keys(vistos).forEach(c => {
      const ds = Object.keys(vistos[c]);
      mapa[c] = ds.length === 1 ? vistos[c][ds[0]] : null;
    });
    return mapa;
  }

  // Departamento y ciudad de un registro de SECOP II. Si el dataset ya trae departamento se respeta; si dice
  // «No Definido» se deduce por el municipio de la unidad de contratación SOLO cuando ese municipio es de un
  // único departamento. `deducido` avisa de que no es un dato del dataset.
  function ubicacionDeRegistro(rec, mapa) {
    const r = rec || {};
    const dep = sinDef(r.departamento_entidad) ? null : String(r.departamento_entidad).trim();
    const ciu = !sinDef(r.ciudad_entidad) ? String(r.ciudad_entidad).trim()
      : (!sinDef(r.ciudad_de_la_unidad_de) ? String(r.ciudad_de_la_unidad_de).trim() : null);
    if (dep) return { departamento: dep, ciudad: ciu, deducido: false };
    const clave = sinDef(r.ciudad_entidad) ? r.ciudad_de_la_unidad_de : r.ciudad_entidad;
    const d = mapa && !sinDef(clave) ? mapa[normalizeGeo(clave)] : null;
    return { departamento: d || null, ciudad: ciu, deducido: !!d };
  }

  // `opciones.soloLicitacionObra`: «Solo Licitación Pública (Obra pública)» se filtra en el servidor (misma regla que el
  // navegador: la modalidad dice «licitación pública» Y «obra»). Antes se aplicaba tras traer 300 filas y solo llegaba
  // ~25 % de las licitaciones de obra de los últimos 60 días (Norte de Santander 5 de 21, Bogotá 5 de 80).
  function consultasSecopII(qTerm, hoyISO, geos, opciones) {
    // Las tildes se quitan (pavimentación = pavimentacion) pero la Ñ NO: en $q "señalización" trae 4.789 procesos y
    // "senalizacion" 128 ("diseño" 144.804 contra "diseno" 2.220).
    const q = qTerm
      ? '&$q=' + encodeURIComponent(String(qTerm).replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002').normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ'))
      : '';
    const dep = filtroDepartamento(geos);
    const lic = opciones && opciones.soloLicitacionObra
      ? " AND upper(modalidad_de_contratacion) like '%LICITACI%BLICA%' AND upper(modalidad_de_contratacion) like '%OBRA%'" : '';
    const mun = filtroMunicipio(opciones && opciones.municipios);
    const ent = filtroEntidad(opciones && opciones.entidad);
    const val = filtroValor(opciones && opciones.minV, opciones && opciones.maxV);
    const resto = lic + (mun ? ' AND ' + mun : '') + (ent ? ' AND ' + ent : '') + (val ? ' AND ' + val : '');
    const y = (dep ? ' AND ' + dep : '') + resto;
    const yVigentes = (dep ? ' AND ' + filtroDepartamento(geos, true) : '') + resto;
    return {
      vigentes: '$limit=300' + q +
        '&$where=' + encodeURIComponent("fecha_de_recepcion_de >= '" + hoyISO + "'" + yVigentes) +
        '&$order=' + encodeURIComponent('fecha_de_recepcion_de ASC'),
      recientes: '$limit=300' + q +
        '&$where=' + encodeURIComponent('fecha_de_publicacion_del IS NOT NULL' + y) +
        '&$order=' + encodeURIComponent('fecha_de_publicacion_del DESC')
    };
  }

  const Coincidencia = {
    parseNumCO: parseNumCO, normalizeGeo: normalizeGeo, palabrasDeEntidad: palabrasDeEntidad, matchesMunicipio: matchesMunicipio, coincideEntidad: coincideEntidad,
    esLicitacionObra: esLicitacionObra, consultaNombresEntidad: consultaNombresEntidad, consultaAdjudicacionesDe: consultaAdjudicacionesDe, opcionesDeAlerta: opcionesDeAlerta, coincideFiltrosAlerta: coincideFiltrosAlerta, departamentoSecop: departamentoSecop, matchesGeo: matchesGeo, matchesTerm: matchesTerm,
    findField: findField, prepararBusquedaPorNombre: prepararBusquedaPorNombre,
    mapaMunicipios: mapaMunicipios, ubicacionDeRegistro: ubicacionDeRegistro,
    esEstadoNoVigente: esEstadoNoVigente, consultasSecopII: consultasSecopII
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Coincidencia;
  else root.Coincidencia = Coincidencia;
})(typeof window !== 'undefined' ? window : globalThis);
