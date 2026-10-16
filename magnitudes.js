// ============================================================================
// Magnitudes de experiencia específica (documentos tipo CCE): cruce DETERMINISTA
// entre lo que exige el pliego ("longitud de tubería ≥ 965,21 ml en PVC ≥ 8"",
// "129 conexiones domiciliarias", "19 pozos de inspección", "entibados") y las
// CANTIDADES por ítem que el usuario cargó de cada contrato (hoja CANTIDADES del
// Formato Maestro, sacadas de actas finales).
//
// Reglas de diseño (cero tolerancia a falsos "Cumple"):
//  - Solo se suma un ítem si se reconoce SIN ambigüedad: actividad, y para tubería
//    también material y diámetro. Lo que no se reconoce no cuenta y se reporta.
//  - "Por lo menos uno de los contratos": se evalúa contrato por contrato, no se
//    suman contratos distintos.
//  - En consorcio / unión temporal el pliego no dice si la cantidad se cuenta
//    completa o prorrateada por participación: si el resultado cambia según la base,
//    es NO DETERMINABLE y se explica. Solo se afirma con una base explícita.
//  - NO CUMPLE solo cuando todos los contratos con cantidades cargadas se evaluaron
//    con ítems reconocidos y ninguno alcanza; con datos faltantes es NO DETERMINABLE.
// Sin dependencias. Corre en el navegador (root.Magnitudes) y en Node (module.exports).
// ============================================================================
(function (root) {
  'use strict';

  const UNIDAD_LONGITUD = /^(ml|m|mts?|metros?|metros?\s+lineales?|m\.l\.?)$/i;
  const UNIDAD_KM = /^(km|kms|kil[oó]metros?)$/i;
  const UNIDAD_CONTEO = /^(und?\.?|u\.?|unid(?:ades?)?\.?|uni\.?|no\.?|n[°º]|conexi[oó]n(?:es)?|pozos?)$/i;
  // Ítems que NO son obra instalada (RA2-2): retiro, demolición, excavación, relleno... Solo cuando el ítem EMPIEZA así
  // (un «Conexión domiciliaria… incluye excavación» sigue siendo una conexión).
  const NO_INSTALADA = /^\W*(?:retiros?|retirada|desmontes?|desmontaje|demolici[oó]n(?:es)?|demoler|rotura|excavaci[oó]n(?:es)?|excavar|rellenos?|desinstalaci[oó]n|levantamiento)\b/i;
  // Filas de total/subtotal repetidas por quien arma la hoja (RA2-1): no son una obra más.
  const FILA_TOTAL = /^\W*(?:sub\s*-?\s*)?total(?:es)?\b|\btotal(?:\s+general)?\s*:?\s*$|^\W*suma(?:toria)?\b/i;

  const norm = s => String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ' ').trim();
  const sinTildes = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Número en formato colombiano o con punto decimal. Devuelve { valor, ambiguo }.
  //  "2.004,64" -> 2004.64 | "965.21" -> 965.21 | "1.378" -> 1378 (miles) pero ambiguo si no hay coma.
  function numero(s) {
    const t = norm(s).replace(/[^\d.,-]/g, '');
    if (!/\d/.test(t)) return { valor: null, ambiguo: false };
    const tienePunto = t.includes('.'), tieneComa = t.includes(',');
    let v, ambiguo = false;
    if (tienePunto && tieneComa) {
      const decComa = t.lastIndexOf(',') > t.lastIndexOf('.');
      v = parseFloat(decComa ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
    } else if (tieneComa) {
      v = parseFloat(t.replace(',', '.'));
    } else if (tienePunto) {
      if (/^\d{1,3}(\.\d{3})+$/.test(t)) { v = parseFloat(t.replace(/\./g, '')); ambiguo = true; }
      else v = parseFloat(t);
    } else v = parseFloat(t);
    return { valor: isFinite(v) ? v : null, ambiguo: ambiguo };
  }

  // ── Actividad de un ítem de cantidades ────────────────────────────────────────
  // Devuelve { actividad, material, diametroPulg, certeza, nota }.
  // actividad: 'tuberia' | 'pozos' | 'conexiones' | 'accesorio_domiciliario' | 'entibados' | null
  function diametroPulgadas(t) {
    // Ø16", D=8", diámetro 12", 12 pulgadas, 160 mm, DN 200
    let m = t.match(/(?:[øØ]|\bd\s*=|\bdi[aá]m(?:etro)?\.?|\bdn)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*("|”|''|pulg(?:adas?)?|in\b|mm)?/i);
    if (!m) m = t.match(/(\d+(?:[.,]\d+)?)\s*("|”|''|pulg(?:adas?)?)/i);
    if (!m) { const mm = t.match(/(\d{2,4})\s*mm\b/i); if (mm) return Math.round(parseFloat(mm[1]) / 25.4 * 10) / 10; return null; }
    const n = numero(m[1]).valor;
    if (n == null) return null;
    const u = (m[2] || '').toLowerCase();
    if (u === 'mm') return Math.round(n / 25.4 * 10) / 10;
    if (!u && n > 60) return Math.round(n / 25.4 * 10) / 10; // número suelto grande: milímetros
    return n;
  }

  function materialDe(t) {
    const s = sinTildes(t).toLowerCase();
    const hallados = [];
    if (/\bpvc\b|policloruro/.test(s)) hallados.push('PVC');
    if (/\bgres\b/.test(s)) hallados.push('GRES');
    if (/concreto|hormigon/.test(s) && /tuber|colector|alcantarill/.test(s)) hallados.push('CONCRETO');
    if (/\bpead\b|polietileno/.test(s)) hallados.push('PEAD');
    if (/\bpex\b/.test(s)) hallados.push('PEX');
    if (/novafort|novafor[dt]/.test(s)) hallados.push('NOVAFORT');
    return Array.from(new Set(hallados));
  }

  function clasificarItem(item, unidad) {
    const t = norm(item), s = sinTildes(t).toLowerCase(), u = norm(unidad);
    if (/entibad/.test(s)) return { actividad: 'entibados', certeza: 'alta' };
    if (NO_INSTALADA.test(s)) return { actividad: null, certeza: 'alta', nota: 'No es obra instalada (retiro, demolición, excavación o relleno).' };
    // Accesorios del domiciliario: NO son conexiones (silla yee, codos, cajas, collares).
    if (/\b(silla|yee|codo|caja|collar|tee|reduccion|abrazadera)\b/.test(s) && /domicili|conexi|acometida|alcantarill/.test(s))
      return { actividad: 'accesorio_domiciliario', certeza: 'alta' };
    if (/conexi\w*\s+domicili|acometida\s+domicili|domiciliari/.test(s) && !/\b(silla|yee|codo|caja|collar)\b/.test(s)) {
      // "Instalación domiciliarias D=2"x1/2"" es de acueducto: solo cuenta si el propio ítem dice alcantarillado/sanitari.
      const alta = /alcantarill|sanitari|aguas\s+(?:negras|residuales|servidas)/.test(s);
      // Una conexión se cuenta en unidades: medida en m, m² o m³ no es una conexión (RA2-2); sin unidad no se afirma.
      if (u && !UNIDAD_CONTEO.test(u)) return { actividad: null, certeza: 'alta', nota: 'Medido en ' + u + ': no es un conteo de conexiones.' };
      return { actividad: 'conexiones', certeza: alta && u ? 'alta' : 'baja', nota: !alta ? 'El ítem no dice que sea de alcantarillado.' : (u ? '' : 'El ítem no trae unidad: no se sabe si cuenta conexiones.') };
    }
    // CR2-6: componentes de un pozo (cono, anillo, brocal, escalones, losa, cañuela) y otros «pozos» (séptico, de bombeo, húmedo) o
    // ajustes a pozos existentes no son pozos de inspección nuevos: sumarlos al pozo duplicaba la cuenta.
    if (/\bpozos?\b|\b(?:cono|conos|anillo|anillos|brocal|escalon|escalones|peldano|peldanos)\b/.test(s) &&
        /\b(?:cono|conos|anillo|anillos|brocal|escalon|escalones|peldano|peldanos|losa|canuela|canuelas|septic\w*|bombeo|elevacion|humedo|aforo|ajuste|ajustes|existentes?)\b/.test(s))
      return { actividad: null, certeza: 'alta', nota: 'Componente de un pozo, otro tipo de pozo o ajuste a un pozo existente: no cuenta como pozo de inspección nuevo.' };
    if (/\bpozos?\b/.test(s) && !/adecuacion|reparacion|tapa|cuerpo\s+de/.test(s)) {
      // Un pozo se cuenta en unidades: 40 m³ de excavación no son 40 pozos (RA2-2); sin unidad no se afirma.
      if (u && !UNIDAD_CONTEO.test(u)) return { actividad: null, certeza: 'alta', nota: 'Medido en ' + u + ': no es un conteo de pozos.' };
      return { actividad: 'pozos', certeza: u ? 'alta' : 'baja', nota: u ? '' : 'El ítem no trae unidad: no se sabe si cuenta pozos.' };
    }
    // Longitud de vía: solo ítems medidos en longitud (ml, m, km) que hablan de vía/carretera/pavimento. Los medidos en m² o m³ no dan longitud.
    if ((UNIDAD_LONGITUD.test(u) || UNIDAD_KM.test(u)) && /\b(vias?|viales?|vial|carreteras?|calzadas?|pavimentos?|placa\s*huella|carpeta\s+asfaltica)\b/.test(s) &&
        !/tuber|colector|alcantarill|acueduct|bordill|sardinel|anden|cuneta|ducto|cable|cerca|senaliz|demarcacion|baranda|muro|box\s*culvert|alcantarilla/.test(s))
      return { actividad: 'via', certeza: 'alta' };
    const matsPrev = materialDe(t);
    const pareceTuberia = /tuber|colector|interceptor|emisario/.test(s) || (UNIDAD_LONGITUD.test(u) && matsPrev.length === 1 && diametroPulgadas(t) != null && /alcantarill|sanitari|pluvial|colector/.test(s));
    if (pareceTuberia && (UNIDAD_LONGITUD.test(u) || !u)) {
      const mats = materialDe(t), d = diametroPulgadas(t);
      return {
        actividad: 'tuberia',
        material: mats.length === 1 ? mats[0] : null,
        materialesHallados: mats,
        diametroPulg: d,
        certeza: (mats.length === 1 && d != null) ? 'alta' : 'baja',
        nota: mats.length > 1 ? 'El ítem menciona más de un material.' : (mats.length === 0 ? 'El ítem no dice el material.' : (d == null ? 'El ítem no dice el diámetro.' : ''))
      };
    }
    return { actividad: null, certeza: 'alta' };
  }

  // ── Lectura de la exigencia del pliego ─────────────────────────────────────────
  // frase: texto de "Por lo menos uno (1) de los contratos válidos aportados ..."
  function parsearExigencia(frase) {
    const f = norm(frase), s = sinTildes(f).toLowerCase();
    const out = { actividad: null, cifra: null, unidad: null, material: null, diametroMinPulg: null, diametroMaxPulg: null, materiales: null, soloAcreditar: false, ambiguo: false };
    const ultimaCifra = re => { const all = Array.from(f.matchAll(re)); return all.length ? all[all.length - 1] : null; };
    if (/entibad/.test(s)) { out.actividad = 'entibados'; out.soloAcreditar = true; return out; }
    if (/conexion(?:es)?\s+domiciliari/.test(s)) {
      out.actividad = 'conexiones';
      const c = ultimaCifra(/(\d[\d.,]*)\s*(?:und|unid(?:ades)?)\b/gi);
      if (c) { const n = numero(c[1]); out.cifra = n.valor; out.unidad = 'und'; out.ambiguo = n.ambiguo; }
      return out;
    }
    if (/pozos?\s+de\s+inspecci/.test(s)) {
      out.actividad = 'pozos';
      const c = ultimaCifra(/(\d[\d.,]*)\s*(?:und|unid(?:ades)?)\b/gi);
      if (c) { const n = numero(c[1]); out.cifra = n.valor; out.unidad = 'und'; out.ambiguo = n.ambiguo; }
      return out;
    }
    if (/longitud\s+intervenida/.test(s)) {
      out.actividad = 'via';
      const c = ultimaCifra(/(\d[\d.,]*)\s*(?:ml|km)\b/gi);
      if (c) { const n = numero(c[1]); out.cifra = n.valor; out.unidad = 'ml'; out.ambiguo = n.ambiguo; }
      const pctM = f.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
      const totM = f.match(/(?:valor\s+referente\s+es|la\s+cual\s+es\s+de|equivale\s+a)\s*\(?\s*(\d[\d.,]*)\s*ml/i);
      if (pctM && totM && out.cifra != null) {
        const tot = numero(totM[1]).valor, pct = numero(pctM[1]).valor;
        if (tot != null && pct != null) {
          const esperado = pct / 100 * tot;
          if (Math.abs(out.cifra - esperado) <= 1) out.ambiguo = false;
          else { out.ambiguo = true; out.avisoCifra = 'La cifra exigida (' + fmt(out.cifra) + ' ml) no coincide con el ' + pctM[1] + ' % del total declarado (' + fmt(tot) + ' ml = ' + fmt(esperado) + ' ml): el pliego tiene una incoherencia, pídele aclaración a la entidad.'; }
        }
      }
      return out;
    }
    if (/longitud\s+de\s+tuber/.test(s)) {
      out.actividad = 'tuberia';
      const c = ultimaCifra(/(\d[\d.,]*)\s*ml\b/gi);
      if (c) { const n = numero(c[1]); out.cifra = n.valor; out.unidad = 'ml'; out.ambiguo = n.ambiguo; }
      // Control cruzado: la cifra exigida debe ser el N % del total que el propio pliego declara.
      // Confirma el separador de miles (3.627 = 50 % de 7.254) y detecta cifras que no cuadran.
      const pctM = f.match(/\((\d{1,3}(?:[.,]\d+)?)\s*%\)/);
      const totM = f.match(/(?:la\s+cual\s+es\s+de|es\s+de|equivale\s+a)\s*\(?\s*(\d[\d.,]*)\s*ml/i);
      if (pctM && totM && out.cifra != null) {
        const tot = numero(totM[1]).valor, pct = numero(pctM[1]).valor;
        if (tot != null && pct != null) {
          const esperado = pct / 100 * tot;
          if (Math.abs(out.cifra - esperado) <= 1) out.ambiguo = false;
          else { out.ambiguo = true; out.avisoCifra = 'La cifra exigida (' + fmt(out.cifra) + ' ml) no coincide con el ' + pctM[1] + ' % del total declarado (' + fmt(tot) + ' ml = ' + fmt(esperado) + ' ml): el pliego tiene una incoherencia, pídele aclaración a la entidad.'; }
        }
      }
      const mm = f.match(/el\s+cual\s+corresponde\s+a\s+([^.;]{2,60}?)(?=,|\.|;|\s+por\s+lo\s+anterior|\s+y\s+cuyo|$)/i);
      if (mm) {
        const mats = Array.from(new Set((mm[1].toUpperCase().match(/\b(PVC|PEAD|PEX|HD|GRP|ACCP|CONCRETO|GRES|ACERO)\b/g) || [])));
        if (mats.length) { out.materiales = mats; out.material = mats[0]; }
        else { const m1 = mm[1].match(/^([A-ZÁÉÍÓÚ]{2,12})/i); if (m1) out.material = m1[1].toUpperCase(); }
      }
      const md = f.match(/(?:mayor\s+o\s+igual\s+a|igual\s+o\s+superior\s+a|>=|≥)\s*(\d+(?:[.,]\d+)?)\s*("|”|''|pulg)/i);
      if (md) out.diametroMinPulg = numero(md[1]).valor;
      // FI2-7: «mayor o igual a 8" y menor o igual a 12"» ignoraba el máximo y una tubería de 24" cumplía.
      const mx = f.match(/(?:menor\s+o\s+igual\s+a|igual\s+o\s+inferior\s+a|no\s+(?:mayor|superior)\s+a|<=|≤)\s*(\d+(?:[.,]\d+)?)\s*("|”|''|pulg)/i);
      if (mx) { const hi = numero(mx[1]).valor; if (hi != null && (out.diametroMinPulg == null || hi >= out.diametroMinPulg)) out.diametroMaxPulg = hi; }
      const mr = f.match(/(?:di[aá]metros?[^.]{0,40}?)?entre\s+(?:el\s+siguiente\s+rango\s+)?(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:"|”|''|pulg(?:adas?)?)?\s*y\s*(\d+(?:[.,]\d+)?)\s*("|”|''|pulg)/i);
      if (mr) { const lo = numero(mr[1]).valor, hi = numero(mr[2]).valor; if (lo != null && hi != null && lo <= hi) { out.diametroMinPulg = lo; out.diametroMaxPulg = hi; } }
      return out;
    }
    return out; // no modelada (p. ej. longitud de vía): el cruce responde NO DETERMINABLE
  }

  // ── Evaluación contra los contratos de la empresa ──────────────────────────────
  // contratos: [{ numeroContrato, objeto, participacion:{valor}|null, formatoMaestro:{cantidades:[{item,cantidad,unidad}]} }]
  // opciones.base: 'total' | 'prorrata' | null (null = no se asume)
  function evaluarContrato(ex, c, base) {
    const items = (c.formatoMaestro && c.formatoMaestro.cantidades) || [];
    const id = c.numeroContrato || (c.formatoMaestro && c.formatoMaestro.idContrato) || (c.objeto || '').slice(0, 40) || 'contrato';
    if (!items.length) return { id: id, estado: 'sin_datos', detalle: 'no tiene cantidades cargadas.' };
    let total = 0, usados = [], dudosos = [], descartados = [], viaCants = [], viaItems = [], cand = [];
    items.forEach(it => {
      if (FILA_TOTAL.test(sinTildes(it.item).toLowerCase())) { descartados.push(it.item + ' (fila de total)'); return; }
      const cl = clasificarItem(it.item, it.unidad);
      if (cl.actividad !== ex.actividad) {
        if (ex.actividad === 'conexiones' && cl.actividad === 'accesorio_domiciliario') descartados.push(it.item + ' (accesorio: no es una conexión certificada)');
        return;
      }
      // RA2-6: «1.000» / «1,000» escrito como texto puede ser mil o uno con decimales: no se adivina, queda dudoso.
      if (typeof it.cantidad === 'string' && /^\s*\d{1,3}[.,]\d{3}\s*$/.test(it.cantidad)) {
        dudosos.push(it.item + ' — cantidad «' + it.cantidad.trim() + '» ambigua (¿mil o uno con decimales?): escríbela como número (' + (it.unidad || '') + ')');
        return;
      }
      let cant = typeof it.cantidad === 'number' ? it.cantidad : numero(it.cantidad).valor;
      if (cant == null || cant <= 0) return;
      if (ex.actividad === 'via' && UNIDAD_KM.test(norm(it.unidad))) cant = cant * 1000;
      let ok = cl.certeza === 'alta';
      let motivo = cl.nota || '';
      if (ex.actividad === 'tuberia' && ok) {
        const mats = ex.materiales && ex.materiales.length ? ex.materiales : (ex.material ? [ex.material] : []);
        if (mats.length && mats.indexOf(cl.material) === -1) {
          ok = false; motivo = 'material ' + (cl.material || '?') + ' (se exige ' + mats.join(' o ') + ')';
          if (!(cl.material === 'NOVAFORT' && mats.indexOf('PVC') !== -1)) { descartados.push(it.item + ': ' + motivo); return; } // material conocido y distinto: no es dudoso, no cuenta
          motivo += '; Novafort es tubería corrugada de PVC pero confirma si el pliego la acepta como tal';
        }
        else if (ex.diametroMinPulg != null && cl.diametroPulg < ex.diametroMinPulg) { ok = false; motivo = 'diámetro ' + cl.diametroPulg + '" (se exige ≥ ' + ex.diametroMinPulg + '")'; if (cl.diametroPulg != null) { descartados.push(it.item + ': ' + motivo); return; } }
        else if (ex.diametroMaxPulg != null && cl.diametroPulg > ex.diametroMaxPulg) { ok = false; motivo = 'diámetro ' + cl.diametroPulg + '" (se exige entre ' + ex.diametroMinPulg + '" y ' + ex.diametroMaxPulg + '")'; descartados.push(it.item + ': ' + motivo); return; }
      }
      if (ex.actividad === 'tuberia' && cl.certeza !== 'alta') { dudosos.push(it.item + ' — ' + (motivo || 'no se pudo leer material o diámetro') + ' (' + cant + ' ' + (it.unidad || '') + ')'); return; }
      if (!ok) { dudosos.push(it.item + ' — ' + (motivo || 'no reconocido') + ' (' + cant + ' ' + (it.unidad || '') + ')'); return; }
      if (ex.actividad === 'via') { viaCants.push(cant); viaItems.push(it.item + ' ' + fmt(cant) + ' ml'); return; }
      cand.push({ item: it.item, cant: cant, unidad: it.unidad || '', cl: cl });
    });
    // Consolidación (RA2-1): el mismo tubo puede estar en dos líneas del acta (suministro e instalación) o repetido; sumarlas
    // sobrestimaría. Se cuenta lo prudente (filas repetidas una vez; suministro vs instalación, el mayor) y, si solo la suma
    // plana alcanzaría la cifra, el contrato queda para confirmar (mismo criterio que las capas de vía).
    if (cand.length) {
      const suma = a => a.reduce((x, y) => x + y.cant, 0);
      const vistos = new Set(), unicos = [];
      cand.forEach(x => { const k = sinTildes(x.item).toLowerCase().replace(/\s+/g, ' ') + '|' + x.cant + '|' + norm(x.unidad).toLowerCase(); if (!vistos.has(k)) { vistos.add(k); unicos.push(x); } });
      const repetidas = cand.length - unicos.length;
      let prudente = 0, solapa = false;
      if (ex.actividad === 'tuberia') {
        const grupos = new Map();
        unicos.forEach(x => { const g = (x.cl.material || '') + '|' + x.cl.diametroPulg; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(x); });
        grupos.forEach(arr => {
          const rol = x => { const t = sinTildes(x.item).toLowerCase(), su = /suministro/.test(t), ins = /instalaci|colocaci|tendido/.test(t); return su && !ins ? 'sum' : (ins ? 'ins' : 'otro'); };
          const sum = arr.filter(x => rol(x) === 'sum'), ins = arr.filter(x => rol(x) === 'ins'), otro = arr.filter(x => rol(x) === 'otro');
          if (sum.length && ins.length) { solapa = true; prudente += suma(otro) + Math.max(suma(sum), suma(ins)); }
          else prudente += suma(arr);
        });
      } else if (ex.actividad === 'pozos' || ex.actividad === 'conexiones') {
        // CR2-6: «Suministro de conexión» + «Instalación de conexión» del acta son la MISMA conexión (un solo grupo por actividad).
        const rol = x => { const t = sinTildes(x.item).toLowerCase(), su = /suministro/.test(t), ins = /instalaci|colocaci|construccion/.test(t); return su && !ins ? 'sum' : (ins ? 'ins' : 'otro'); };
        const sum = unicos.filter(x => rol(x) === 'sum'), ins = unicos.filter(x => rol(x) === 'ins'), otro = unicos.filter(x => rol(x) === 'otro');
        if (sum.length && ins.length) { solapa = true; prudente = suma(otro) + Math.max(suma(sum), suma(ins)); }
        else prudente = suma(unicos);
      } else prudente = suma(unicos);
      const plana = suma(cand);
      if (!ex.soloAcreditar && ex.cifra != null && prudente < ex.cifra && plana >= ex.cifra && (repetidas || solapa)) {
        const motivos = [];
        if (solapa) motivos.push('hay líneas de suministro y de instalación del mismo material y diámetro que podrían ser el mismo tubo');
        if (repetidas) motivos.push(repetidas + ' fila(s) repetida(s) con el mismo ítem y cantidad');
        const lista = cand.map(x => x.item + ' ' + fmt(x.cant) + ' ' + x.unidad);
        return { id: id, estado: 'item_dudoso', detalle: 'sumando todas sus filas (' + lista.join('; ') + ') se alcanzaría ' + fmt(ex.cifra) + ' ' + (ex.unidad || '') + ', pero ' + motivos.join(' y ') + ': confirma la cantidad real del acta final.', dudosos: lista };
      }
      total = prudente;
      unicos.forEach(x => usados.push(x.item + ' ' + x.cant + ' ' + x.unidad));
    }
    // Vía: ítems de longitud del mismo contrato pueden ser capas o frentes del MISMO tramo (base, subbase, carpeta), así que no se suman:
    // se toma el mayor (nunca sobrestima). Si solo la suma alcanzaría, no se asume: queda para confirmar.
    if (ex.actividad === 'via' && viaCants.length) {
      const mx = Math.max.apply(null, viaCants), suma = viaCants.reduce((x, y) => x + y, 0);
      total = mx; usados.push(viaItems[viaCants.indexOf(mx)]);
      if (ex.cifra != null && mx < ex.cifra && suma >= ex.cifra) {
        return { id: id, estado: 'item_dudoso', detalle: 'sus ítems de vía (' + viaItems.join('; ') + ') solo alcanzan ' + fmt(ex.cifra) + ' ml si se suman, y podrían ser capas o frentes del mismo tramo: confirma la longitud intervenida del contrato.', dudosos: viaItems };
      }
    }
    if (ex.soloAcreditar) {
      return usados.length
        ? { id: id, estado: 'cumple', detalle: 'tiene ' + usados.join('; ') + '.' }
        : { id: id, estado: dudosos.length ? 'item_dudoso' : 'sin_actividad', detalle: dudosos.length ? 'solo ítems dudosos: ' + dudosos.join('; ') : 'ninguno de sus ítems es de esta actividad.', dudosos: dudosos };
    }
    const pct = c.participacion && c.participacion.valor != null ? c.participacion.valor : null;
    const consorcio = pct != null && pct < 100;
    const prorrata = pct != null ? total * pct / 100 : null;
    const nada = total === 0;
    if (nada) return { id: id, estado: dudosos.length ? 'item_dudoso' : 'sin_actividad', detalle: dudosos.length ? 'solo ítems dudosos: ' + dudosos.join('; ') : 'ninguno de sus ítems es de esta actividad.', dudosos: dudosos, descartados: descartados };
    const cifra = ex.cifra;
    const baseUsada = base || (consorcio ? null : 'total');
    const alcanzaTotal = total >= cifra;
    const alcanzaProrrata = prorrata == null ? null : prorrata >= cifra;
    const resumen = usados.join('; ') + ' = ' + fmt(total) + ' ' + (ex.unidad || '') + (consorcio ? ' (participación ' + pct + ' %: prorrateado ' + fmt(prorrata) + ')' : '');
    if (consorcio && !base) {
      if (alcanzaTotal && alcanzaProrrata) return { id: id, estado: 'cumple', detalle: resumen + ' — alcanza con cualquiera de las dos bases.', total: total, prorrata: prorrata };
      if (alcanzaTotal && !alcanzaProrrata) return { id: id, estado: 'depende_base', detalle: resumen + ' — alcanza si se cuenta completo, no si se prorratea por participación.', total: total, prorrata: prorrata, dudosos: dudosos };
      return { id: id, estado: dudosos.length ? 'item_dudoso' : 'insuficiente', detalle: resumen + ' — no alcanza ' + fmt(cifra) + '.' + (dudosos.length ? ' Hay ítems dudosos: ' + dudosos.join('; ') : ''), total: total, prorrata: prorrata, dudosos: dudosos };
    }
    if (pct == null && consorcio === false && base === 'prorrata') return { id: id, estado: 'sin_datos', detalle: 'sin porcentaje de participación para prorratear.' };
    const q = baseUsada === 'prorrata' ? prorrata : total;
    if (q == null) return { id: id, estado: 'sin_datos', detalle: 'sin porcentaje de participación para prorratear.' };
    if (q >= cifra) return { id: id, estado: 'cumple', detalle: resumen + ' (base: ' + (baseUsada === 'prorrata' ? 'prorrateado' : 'completo') + ').' + (ex.actividad === 'via' ? ' Verifica que el contrato sea de la actividad de vías que pide el pliego.' : ''), total: total, prorrata: prorrata };
    return { id: id, estado: dudosos.length ? 'item_dudoso' : 'insuficiente', detalle: resumen + ' — no alcanza ' + fmt(cifra) + '.' + (dudosos.length ? ' Hay ítems dudosos: ' + dudosos.join('; ') : ''), total: total, prorrata: prorrata, dudosos: dudosos };
  }

  function fmt(n) { return n == null ? '—' : (Math.round(n * 100) / 100).toLocaleString('es-CO'); }

  // Resultado agregado de una exigencia. estado: CUMPLE | NO CUMPLE | NO DETERMINABLE
  function evaluar(ex, contratos, opciones) {
    const base = opciones && opciones.base || null;
    if (!ex || !ex.actividad) return { estado: 'NO DETERMINABLE', detalle: 'Esta exigencia de magnitud no se cruza automáticamente: verifícala contra las cantidades de tus contratos.', porContrato: [] };
    if (!ex.soloAcreditar && (ex.cifra == null || ex.ambiguo)) return { estado: 'NO DETERMINABLE', detalle: ex.ambiguo ? (ex.avisoCifra || 'La cifra del documento es ambigua (separador de miles o decimales): confírmala en el pliego.') : 'No se leyó la cifra exigida.', porContrato: [] };
    if (ex.actividad === 'tuberia' && (!ex.material || ex.diametroMinPulg == null)) return { estado: 'NO DETERMINABLE', detalle: 'No se leyó con certeza el material o el diámetro mínimo exigidos.', porContrato: [] };
    const lista = (contratos || []).filter(c => c && c.enEjecucion !== true);
    if (!lista.length) return { estado: 'NO DETERMINABLE', detalle: 'Tu perfil no tiene contratos de experiencia cargados.', porContrato: [] };
    const por = lista.map(c => evaluarContrato(ex, c, base));
    const con = e => por.filter(x => x.estado === e);
    if (con('cumple').length) {
      const x = con('cumple')[0];
      return { estado: 'CUMPLE', detalle: 'Contrato ' + x.id + ': ' + x.detalle + ' (según las cantidades que cargaste; verifica contra el acta final).', porContrato: por };
    }
    if (con('depende_base').length) {
      const x = con('depende_base')[0];
      return { estado: 'NO DETERMINABLE', detalle: 'Contrato ' + x.id + ': ' + x.detalle + ' El pliego no dice cómo se cuentan las cantidades en consorcio: confirma con la entidad.', porContrato: por };
    }
    const falta = por.filter(x => x.estado === 'sin_datos' || x.estado === 'item_dudoso');
    const nota = ex.soloAcreditar ? ' El pliego solo pide acreditar esta experiencia (no exige cantidad): registra un ítem de ' + ex.actividad + ' en la hoja CANTIDADES del contrato que lo acredite.' : '';
    if (falta.length) {
      const sinDatos = por.filter(x => x.estado === 'sin_datos').length;
      const dudosos = falta.filter(x => x.estado === 'item_dudoso');
      const conDatos = por.length - sinDatos;
      let det = conDatos === 0 ? 'Ningún contrato del perfil tiene cantidades cargadas (0 de ' + por.length + ').' : (conDatos === por.length ? 'Todos los contratos del perfil tienen cantidades cargadas.' : 'Solo ' + conDatos + ' de ' + por.length + ' contratos del perfil tienen cantidades cargadas.');
      if (dudosos.length) det += ' Ítems dudosos: ' + dudosos.slice(0, 3).map(x => x.id + ' (' + x.detalle + ')').join(' · ') + (dudosos.length > 3 ? ' …' : '') + '.';
      else if (conDatos > 0) det += ' Ninguno de los cargados tiene ítems de esta actividad.';
      return { estado: 'NO DETERMINABLE', detalle: det + ' Carga las cantidades de los contratos que podrían acreditarlo.' + nota, porContrato: por };
    }
    const alguno = por.filter(x => x.estado === 'insuficiente');
    if (alguno.length) {
      const mejor = alguno.slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0];
      return { estado: 'NO CUMPLE', detalle: 'Con las cantidades cargadas ningún contrato alcanza. El más cercano: ' + mejor.id + ': ' + mejor.detalle, porContrato: por };
    }
    return { estado: 'NO DETERMINABLE', detalle: 'Ningún contrato cargado tiene ítems de esta actividad (' + por.length + ' revisado(s)). Registra las cantidades en la hoja CANTIDADES.' + nota, porContrato: por };
  }

  const Magnitudes = { numero: numero, clasificarItem: clasificarItem, parsearExigencia: parsearExigencia, evaluar: evaluar, evaluarContrato: evaluarContrato };
  if (typeof module !== 'undefined' && module.exports) module.exports = Magnitudes;
  else root.Magnitudes = Magnitudes;
})(typeof window !== 'undefined' ? window : globalThis);
