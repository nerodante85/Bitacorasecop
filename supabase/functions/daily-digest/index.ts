// ============================================================================
// Bitácora SECOP — resumen diario por correo (Fase 6 del prompt maestro:
// "correo/job programado" para Alertas guardadas y Empresas seguidas).
// ============================================================================
// POR QUÉ EXISTE ESTE ARCHIVO SEPARADO (no vive en index.html):
// la app es 100% estática (GitHub Pages, sin backend) -- lo único que puede
// "correr solo" en un horario, sin que el usuario tenga la pestaña abierta,
// es el servidor de Supabase. Esta Supabase Edge Function la dispara un cron
// de Postgres (pg_cron, ver supabase/cron.sql) una vez al día; por cada
// empresa que activó el resumen ("Tu cuenta" → el checkbox nuevo), revisa
// sus alertas guardadas y empresas seguidas contra SECOP EN VIVO y, si hay
// algo nuevo, envía un correo breve (vía Resend) con el conteo y un enlace a
// la app -- el detalle completo se ve adentro, este correo es solo el aviso.
//
// DUPLICACIÓN DELIBERADA, no descuido: las funciones de más abajo
// (parseNumCO, normalizeGeo, matchesGeo, matchesTerm, findField,
// prepararBusquedaPorNombre, fetchSecopDataset) son un puerto a Deno de las
// funciones del mismo nombre en index.html. Una Edge Function corre en un
// runtime completamente aparte del navegador -- no hay forma de "importar"
// código de un <script> de una página HTML sin meter un paso de build que
// esta app no tiene por diseño (ver CLAUDE.md, "por qué no hay backend").
// Si alguna de esas funciones cambia en index.html (ej. se ajusta la regla
// de la raíz de 6 letras en matchesTerm, o el orden de columnas de fecha en
// SECOP II), hay que replicar el cambio aquí a mano -- están comentadas con
// el nombre exacto de su contraparte para que sea fácil encontrarlas.
//
// SEGURIDAD: esta función NO usa la anon key -- usa la service_role key
// (inyectada automáticamente por Supabase como SUPABASE_SERVICE_ROLE_KEY en
// toda Edge Function desplegada) para poder leer app_state de TODAS las
// empresas y resolver el correo de cada usuario vía el Admin API de Auth.
// Por eso está protegida con un secreto compartido (CRON_SECRET) en vez de
// quedar abierta al público: cualquiera que descubriera la URL pública de
// una función sin esa protección podría forzar el envío de correos a todos
// los usuarios. Ver supabase/cron.sql para cómo se manda ese secreto.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SECOP_II_DATASET = 'p6dx-8zbt';
const SECOP_I_DATASET = 'f789-7hwg';
// Mismo token que SOCRATA_APP_TOKEN en index.html -- identifica a "esta app"
// ante Socrata (no es secreto: Socrata los diseña para ir embebidos en
// código de cliente, y aquí corre server-side igual). Compartir el mismo
// token entre el navegador y esta función es intencional: es la misma app.
const SOCRATA_APP_TOKEN = 'sLrsLl9JVOgiNtJUJLFM8mxiT';

function socrataHeaders(){
  return SOCRATA_APP_TOKEN ? { 'X-App-Token': SOCRATA_APP_TOKEN } : {};
}

// ---- Helpers puros portados de index.html (ver comentario de arriba) ------

// = parseNumCO en index.html
function parseNumCO(s: unknown): number | null {
  if (s == null) return null;
  let t = String(s).replace(/[^\d.,\-]/g, '');
  if (!/\d/.test(t)) return null;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}(\D|$)/.test(t + ' ')) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

// = normalizeGeo en index.html
function normalizeGeo(s: unknown): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/^\s*(departamento|dpto|depto)\s+(de\s+)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// = matchesGeo en index.html
function matchesGeo(departamento: string, term: string): boolean {
  const d = normalizeGeo(departamento);
  const t = normalizeGeo(term);
  return !!d && !!t && d === t;
}

// = matchesTerm en index.html (misma regla de raíz de 6 letras para
// pavimento/pavimentación, alcantarilla/alcantarillado, etc.)
function matchesTerm(searchable: string, term: string): boolean {
  if (!term) return false;
  const t = String(term).toLowerCase().trim();
  if (!t) return false;
  if (searchable.includes(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words.every((w) => searchable.includes(w) || (w.length >= 6 && searchable.includes(w.slice(0, 6))));
}

// = findField en index.html
function findField(record: Record<string, unknown>, exactCandidates: string[], substrFallback?: string): unknown {
  const keys = Object.keys(record);
  for (const c of exactCandidates) {
    const k = keys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (k && record[k] !== null && record[k] !== undefined && record[k] !== '') return record[k];
  }
  if (substrFallback) {
    const k = keys.find((k) => k.toLowerCase().includes(substrFallback));
    if (k && record[k]) return record[k];
  }
  return null;
}

// = prepararBusquedaPorNombre en index.html
function prepararBusquedaPorNombre(nombre: string) {
  const norm = (s: unknown) => normalizeGeo(s);
  const objetivo = norm(nombre);
  const toks = objetivo.split(' ').filter((w) => w.length >= 4);
  const ancla = toks.slice().sort((a, b) => b.length - a.length).slice(0, 2).join(' ') || objetivo;
  const coincide = (candidato: unknown) => {
    const c = norm(candidato);
    if (!c) return false;
    if (c === objetivo || c.indexOf(objetivo) !== -1 || objetivo.indexOf(c) !== -1) return true;
    const a = c.split(' ').filter((w) => w.length >= 4), b = toks;
    const chico = a.length <= b.length ? a : b, grande = a.length <= b.length ? b : a;
    return chico.length >= 2 && chico.every((w) => grande.indexOf(w) !== -1);
  };
  return { ancla, coincide };
}

// Extrae fecha de publicación y objeto/entidad/departamento de un registro
// crudo de SECOP II -- versión recortada de normalize() en index.html: solo
// lo que hace falta para evaluar una alerta (no arma toda la ficha visual).
function pubRawDeSecopII(record: Record<string, unknown>): string | null {
  const keys = Object.keys(record).filter((k) => /fecha/i.test(k));
  const exacta = keys.find((k) => /^fecha_de_publicacion_del(_proceso)?$/i.test(k));
  if (exacta && record[exacta]) return String(record[exacta]);
  const named = keys.filter((k) => /public/i.test(k)).map((k) => String(record[k])).filter(Boolean).sort();
  if (named.length) return named[0];
  const all = keys.map((k) => String(record[k])).filter(Boolean).sort();
  return all.length ? all[0] : null;
}

// = fetchSecopDataset en index.html (mismo $limit, mismo reintento sin
// orden si la columna no existe en ese dataset).
async function fetchSecopDataset(datasetId: string, qTerm: string | null, ordenCol: string): Promise<Record<string, unknown>[]> {
  const base = 'https://www.datos.gov.co/resource/' + datasetId + '.json?$limit=300' + (qTerm ? '&$q=' + encodeURIComponent(qTerm) : '');
  async function intentar(url: string) {
    const res = await fetch(url, { headers: socrataHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('respuesta inesperada');
    return data as Record<string, unknown>[];
  }
  try {
    return await intentar(base + '&$order=' + ordenCol + '%20DESC');
  } catch (_e) {
    return await intentar(base);
  }
}

async function fetchAllForDataset(datasetId: string, anchors: string[], ordenCol: string): Promise<Record<string, unknown>[]> {
  const list = anchors.length ? anchors : [null];
  const batches = await Promise.all(list.map((a) => fetchSecopDataset(datasetId, a, ordenCol)));
  return ([] as Record<string, unknown>[]).concat(...batches);
}

// ---- Tipos de lo que ya guarda el frontend en app_state --------------------

interface Alerta {
  id: string; nombre: string; keywords: string[]; geos: string[];
  minV?: number; maxV?: number; ultimaRevision?: string;
}
interface EmpresaSeguida {
  id: string; nombre: string; ultimaRevision?: string;
}

// = evaluarAlerta en index.html -- cuenta procesos de SECOP II que coinciden
// con los criterios de la alerta Y se publicaron después de ultimaRevision.
async function contarNuevosDeAlerta(alerta: Alerta): Promise<number> {
  const anchors = alerta.keywords.length ? alerta.keywords : alerta.geos;
  if (!anchors.length) return 0;
  const registros = await fetchAllForDataset(SECOP_II_DATASET, anchors, 'fecha_de_publicacion_del');
  const desde = alerta.ultimaRevision ? new Date(alerta.ultimaRevision).getTime() : 0;
  let nuevos = 0;
  registros.forEach((r) => {
    const searchable = JSON.stringify(r).toLowerCase();
    const departamento = String(findField(r, ['departamento', 'departamento_entidad'], 'departamento') || '');
    if (alerta.keywords.length && !alerta.keywords.some((k) => matchesTerm(searchable, k))) return;
    if (alerta.geos.length && !alerta.geos.some((g) => matchesGeo(departamento, g))) return;
    const valor = Number(findField(r, ['precio_base', 'valor_estimado', 'valor_del_contrato', 'valor_total_estimado'], 'precio'));
    if (alerta.minV && !isNaN(valor) && valor > 0 && valor < alerta.minV) return;
    if (alerta.maxV && !isNaN(valor) && valor > 0 && valor > alerta.maxV) return;
    const pub = pubRawDeSecopII(r);
    if (pub && !isNaN(new Date(pub).getTime()) && new Date(pub).getTime() > desde) nuevos++;
  });
  return nuevos;
}

// = buscarFichaEmpresa + revisarEmpresaSeguida en index.html -- cuenta
// contratos (SECOP I+II) donde esta empresa aparece como CONTRATISTA con
// fecha posterior a ultimaRevision. Mismo criterio de "es un contrato real"
// que el frontend: SECOP II exige adjudicado=sí + proveedor; SECOP I exige
// contratista o valor de contrato (esa tabla ya junta proceso + contrato).
async function contarNuevosDeEmpresa(empresa: EmpresaSeguida): Promise<number> {
  const { ancla, coincide } = prepararBusquedaPorNombre(empresa.nombre);
  const desde = empresa.ultimaRevision ? new Date(empresa.ultimaRevision).getTime() : 0;
  let nuevos = 0;

  try {
    const dataII = await fetchSecopDataset(SECOP_II_DATASET, ancla, 'fecha_adjudicacion');
    dataII.forEach((r) => {
      const prove = String(findField(r, ['nombre_del_proveedor', 'proveedor_adjudicado', 'nombre_del_adjudicatario'], 'proveedor') || '');
      if (!coincide(prove)) return;
      const adjudicado = String(findField(r, ['adjudicado'], 'adjudicad') || '').toLowerCase().trim();
      const valN = Number(findField(r, ['valor_total_adjudicacion', 'valor_adjudicacion', 'valor_del_contrato'], 'adjudicac'));
      if (!(adjudicado === 'si' || adjudicado === 'sí') && !(valN > 0)) return;
      const fecha = findField(r, ['fecha_adjudicacion', 'fecha_de_publicacion_del'], 'fecha');
      if (fecha && !isNaN(new Date(String(fecha)).getTime()) && new Date(String(fecha)).getTime() > desde) nuevos++;
    });
  } catch (e) {
    console.error('daily-digest: falló SECOP II para empresa ' + empresa.nombre, e);
  }

  try {
    const dataI = await fetchSecopDataset(SECOP_I_DATASET, ancla, 'fecha_de_cargue_en_el_secop');
    dataI.forEach((r) => {
      const prove = String(findField(r, ['nom_razon_social_contratista'], 'contratista') || '');
      if (!coincide(prove)) return;
      const valN = Number(findField(r, ['valor_contrato_con_adiciones', 'cuantia_contrato'], 'contrato'));
      if (!prove && !(valN > 0)) return;
      const fecha = findField(r, ['fecha_de_firma_del_contrato', 'fecha_de_cargue_en_el_secop'], 'fecha');
      if (fecha && !isNaN(new Date(String(fecha)).getTime()) && new Date(String(fecha)).getTime() > desde) nuevos++;
    });
  } catch (e) {
    console.error('daily-digest: falló SECOP I para empresa ' + empresa.nombre, e);
  }

  return nuevos;
}

// ---- Correo (Resend) -------------------------------------------------------

async function enviarCorreo(to: string, asunto: string, textoPlano: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY no está configurado (supabase secrets set RESEND_API_KEY=...)');
  const from = Deno.env.get('DIGEST_FROM_EMAIL') || 'Bitácora SECOP <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: asunto, text: textoPlano }),
  });
  if (!res.ok) throw new Error('Resend respondió ' + res.status + ': ' + (await res.text()));
}

// ---- Handler ----------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('No autorizado', { status: 401 });
  }
  // ?debug=1 (o header x-digest-debug: 1): agrega detalle diagnóstico a la
  // respuesta (conteo crudo por alerta/empresa, y cualquier error atrapado)
  // -- pensado para invocar la función a mano y confirmar que la lógica de
  // conteo funciona, sin esperar al cron diario ni revisar logs aparte.
  // Nunca cambia si se envía o no un correo, solo qué tan detallada es la
  // respuesta JSON.
  const debug = new URL(req.url).searchParams.get('debug') === '1' || req.headers.get('x-digest-debug') === '1';
  const debugInfo: Record<string, unknown>[] = [];

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const appUrl = Deno.env.get('APP_URL') || 'https://nerodante85.github.io/Bitacorasecop/';

  // Una sola consulta para las 3 claves de todas las empresas -- más barato
  // que una consulta por empresa, y de todos modos hay que revisarlas todas.
  const { data: filas, error } = await admin
    .from('app_state')
    .select('company_id, key, value')
    .in('key', ['correo_digest_activo', 'alertas_guardadas', 'empresas_seguidas']);
  if (error) {
    console.error('daily-digest: no se pudo leer app_state', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const porEmpresa = new Map<string, { optin: boolean; alertas: Alerta[]; empresas: EmpresaSeguida[] }>();
  (filas || []).forEach((f) => {
    if (!porEmpresa.has(f.company_id)) porEmpresa.set(f.company_id, { optin: false, alertas: [], empresas: [] });
    const e = porEmpresa.get(f.company_id)!;
    try {
      if (f.key === 'correo_digest_activo') e.optin = f.value === 'true';
      else if (f.key === 'alertas_guardadas') e.alertas = JSON.parse(f.value) || [];
      else if (f.key === 'empresas_seguidas') e.empresas = JSON.parse(f.value) || [];
    } catch (_err) { /* JSON corrupto -- se ignora esa clave para esta empresa, no tumba el resto */ }
  });

  let correosEnviados = 0;
  const detalles: string[] = [];

  for (const [companyId, datos] of porEmpresa) {
    if (!datos.optin || (!datos.alertas.length && !datos.empresas.length)) continue;
    try {
      const lineasAlertas: string[] = [];
      for (const a of datos.alertas) {
        let n = 0, err: string | null = null;
        try { n = await contarNuevosDeAlerta(a); } catch (e) { err = e instanceof Error ? e.message : String(e); }
        if (debug) debugInfo.push({ companyId, tipo: 'alerta', nombre: a.nombre, keywords: a.keywords, geos: a.geos, ultimaRevision: a.ultimaRevision, nuevos: n, error: err });
        if (n > 0) lineasAlertas.push('- "' + a.nombre + '": ' + n + ' proceso(s) nuevo(s)');
      }
      const lineasEmpresas: string[] = [];
      for (const emp of datos.empresas) {
        let n = 0, err: string | null = null;
        try { n = await contarNuevosDeEmpresa(emp); } catch (e) { err = e instanceof Error ? e.message : String(e); }
        if (debug) debugInfo.push({ companyId, tipo: 'empresa', nombre: emp.nombre, ultimaRevision: emp.ultimaRevision, nuevos: n, error: err });
        if (n > 0) lineasEmpresas.push('- ' + emp.nombre + ': ' + n + ' contrato(s) nuevo(s)');
      }
      if (!lineasAlertas.length && !lineasEmpresas.length) continue;

      // Miembros de la empresa (normalmente uno solo, ver Fase 1) -- el
      // correo de cada uno sale del Admin API de Auth (service_role), no de
      // una columna propia: no se duplica el email en ningún lado nuevo.
      const { data: miembros, error: miembrosErr } = await admin.from('company_members').select('user_id').eq('company_id', companyId);
      if (debug) debugInfo.push({ companyId, tipo: 'miembros', cantidad: (miembros || []).length, error: miembrosErr ? miembrosErr.message : null });
      for (const m of miembros || []) {
        const { data: userData, error: userErr } = await admin.auth.admin.getUserById(m.user_id);
        if (debug) debugInfo.push({ companyId, tipo: 'usuario', userId: m.user_id, tieneEmail: !!(userData && userData.user && userData.user.email), error: userErr ? userErr.message : null });
        if (userErr || !userData || !userData.user || !userData.user.email) continue;
        const totalNuevos = lineasAlertas.length + lineasEmpresas.length;
        const cuerpo = [
          'Hola,', '',
          'Tienes novedades en tu cuenta de Bitácora SECOP:', '',
          ...(lineasAlertas.length ? ['Alertas guardadas:', ...lineasAlertas, ''] : []),
          ...(lineasEmpresas.length ? ['Empresas seguidas:', ...lineasEmpresas, ''] : []),
          'Abre la app para ver el detalle: ' + appUrl, '',
          '— Bitácora SECOP (resumen automático diario)',
        ].join('\n');
        try {
          await enviarCorreo(userData.user.email, 'Bitácora SECOP: ' + totalNuevos + ' novedad(es) hoy', cuerpo);
        } catch (mailErr) {
          if (debug) debugInfo.push({ companyId, tipo: 'envio_correo', error: mailErr instanceof Error ? mailErr.message : String(mailErr) });
          continue;
        }
        correosEnviados++;
        detalles.push(userData.user.email + ': ' + totalNuevos + ' novedad(es)');
      }
    } catch (e) {
      console.error('daily-digest: falló la empresa ' + companyId, e);
      if (debug) debugInfo.push({ companyId, tipo: 'error_empresa', error: e instanceof Error ? e.message : String(e) });
    }
  }

  const body: Record<string, unknown> = { empresasRevisadas: porEmpresa.size, correosEnviados, detalles };
  if (debug) body.debug = debugInfo;
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
});
