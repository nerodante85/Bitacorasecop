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
// CÓDIGO COMPARTIDO CON index.html: las reglas de coincidencia (parseNumCO, normalizeGeo,
// matchesGeo, matchesTerm, findField, prepararBusquedaPorNombre, esEstadoNoVigente,
// consultasSecopII) viven en coincidencia.js, la misma fuente que carga el navegador. Esta carpeta
// lleva una copia idéntica (la CLI solo empaqueta lo que está bajo la carpeta de la función) y una
// prueba de tests/smoke.mjs falla si difieren. Lo que SÍ sigue duplicado a mano, por depender de
// cada runtime: fetchSecopDataset y pubRawDeSecopII.
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

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

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

// ---- Reglas de coincidencia compartidas con el navegador (un solo origen: coincidencia.js) ----
// La copia de esta carpeta debe ser idéntica a coincidencia.js de la raíz del repo (una prueba lo
// verifica). Es un script clásico que cuelga `Coincidencia` de globalThis.
import './coincidencia.js';
// deno-lint-ignore no-explicit-any
const { parseNumCO, normalizeGeo, matchesGeo, matchesTerm, findField, prepararBusquedaPorNombre, esEstadoNoVigente, consultasSecopII } = (globalThis as any).Coincidencia;

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

// = fetchSecopDataset en index.html (mismo $limit, mismo reintento sin orden si la columna no
// existe en ese dataset). Las dos consultas a SECOP II (vigentes + recientes, auditoría
// S2-001/S2-002) las arma consultasSecopII, del módulo compartido.
async function fetchSecopDataset(datasetId: string, qTerm: string | null, ordenCol: string): Promise<Record<string, unknown>[]> {
  const base = 'https://www.datos.gov.co/resource/' + datasetId + '.json?$limit=300' + (qTerm ? '&$q=' + encodeURIComponent(qTerm) : '');
  async function intentar(url: string) {
    const res = await fetch(url, { headers: socrataHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('respuesta inesperada');
    return data as Record<string, unknown>[];
  }
  if (datasetId === SECOP_II_DATASET && ordenCol === 'fecha_de_publicacion_del') {
    // Fecha de Colombia (UTC-5) para comparar contra la fecha de cierre.
    const hoyISO = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    const c = consultasSecopII(qTerm, hoyISO);
    const url = (p: string) => 'https://www.datos.gov.co/resource/' + datasetId + '.json?' + p;
    try {
      const [vigentes, recientes] = await Promise.all([intentar(url(c.vigentes)), intentar(url(c.recientes))]);
      // Un mismo proceso puede salir en ambas consultas: se une sin duplicar
      // (el digest cuenta filas, un duplicado inflaría el "N nuevos").
      const vistos = new Set<string>();
      return vigentes.concat(recientes).filter((r) => {
        const k = String(r['id_del_proceso'] ?? JSON.stringify(r));
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
    } catch (_e) {
      return await intentar(base);
    }
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
    if (esEstadoNoVigente(findField(r, ['estado_del_procedimiento', 'fase'], 'estado'))) return;
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
    // Auditoría TR-007: pie de trazabilidad (de dónde salen los conteos y cuándo se consultaron).
    body: JSON.stringify({ from, to: [to], subject: asunto, text: textoPlano + '\n\n--\nFuente: datos.gov.co, dataset SECOP II (p6dx-8zbt) -- consultado ' + new Date().toISOString() + ' -- modo: en vivo. Resumen orientativo: confirma en SECOP.' }),
  });
  if (!res.ok) throw new Error('Resend respondió ' + res.status + ': ' + (await res.text()));
}

// ---- Límites y saneamiento (auditoría SEG-003, SEG-004, ESC-001, OPS-007) ----------------

// Entrada del listado del bucket de Storage (la usa pliegosVencidos; va fuera del bloque que prueba el arnés).
interface ArchivoStorage { name: string; id?: string | null; created_at?: string | null }

// Un nombre de alerta o de empresa es TEXTO LIBRE del usuario y termina dentro de un correo: se quitan
// saltos de línea y caracteres de control, se neutralizan los enlaces (relay de phishing) y se acota.
function limpiarNombre(t: unknown): string {
  return String(t ?? '')
    .replace(/https?:\/\/[^\s]+/gi, '[enlace]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// Barrido de PDFs huérfanos del bucket `pliegos`. Las funciones de IA borran el PDF al terminar y el
// navegador lo borra si algo falla mientras la pestaña sigue abierta, pero una pestaña cerrada o un corte
// de red a mitad pueden dejar el archivo ahí (datos personales que no deben quedarse: Ley 1581).
// Pura (sin red) para poder probarla. Solo devuelve archivos con fecha legible Y más viejos que `horas`:
// una carpeta (id nulo) o una fecha ilegible NO se borran, porque no se puede asegurar que sobren.
function pliegosVencidos(archivos: ArchivoStorage[], carpeta: string, ahoraMs: number, horas: number): string[] {
  const limite = ahoraMs - horas * 3600 * 1000;
  const fuera = [];
  for (const a of archivos || []) {
    if (!a || a.id == null || !a.created_at) continue;
    const t = Date.parse(a.created_at);
    if (Number.isNaN(t)) continue;
    if (t < limite) fuera.push(carpeta + '/' + a.name);
  }
  return fuera;
}

const MAX_ALERTAS_POR_EMPRESA = 10;   // cota contra el fan-out hacia Socrata (SEG-004)
const MAX_EMPRESAS_POR_EMPRESA = 10;
const PRESUPUESTO_MS = 100_000;       // no se empiezan empresas nuevas pasado este tiempo (ESC-001)

// ---- Handler ----------------------------------------------------------------

const HORAS_VIDA_PDF = 24;          // ningún PDF legítimo vive más de unos minutos; 24 h deja margen de sobra
const MAX_CARPETAS_BARRIDO = 200;   // acota el trabajo de una corrida (cada carpeta es una empresa)

// Recorre el bucket `pliegos` (una carpeta por empresa) y borra los PDFs vencidos. Nunca lanza: un fallo
// aquí no debe impedir el resumen diario; el resultado se devuelve para verlo con ?debug=1.
async function barrerPliegosHuerfanos(admin: ReturnType<typeof createClient>): Promise<{ borrados: number; error?: string }> {
  try {
    const bucket = admin.storage.from('pliegos');
    const { data: carpetas, error } = await bucket.list('', { limit: MAX_CARPETAS_BARRIDO });
    if (error) return { borrados: 0, error: error.message };
    let borrados = 0;
    for (const c of carpetas || []) {
      if (c.id != null) continue;                 // un archivo suelto en la raíz no es de ninguna empresa: no se toca
      const { data: archivos } = await bucket.list(c.name, { limit: 1000 });
      const fuera = pliegosVencidos((archivos || []) as ArchivoStorage[], c.name, Date.now(), HORAS_VIDA_PDF);
      if (!fuera.length) continue;
      const { error: errBorrar } = await bucket.remove(fuera);
      if (errBorrar) return { borrados, error: errBorrar.message };
      borrados += fuera.length;
    }
    return { borrados };
  } catch (e) {
    return { borrados: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req: Request) => {
  // Falla CERRADA: sin CRON_SECRET configurado la función NO responde (antes quedaba pública, y
  // cualquiera podía disparar correos y ver en la respuesta los emails de los usuarios). La
  // comparación es de tiempo constante.
  const cronSecret = Deno.env.get('CRON_SECRET');
  const secretRecibido = req.headers.get('x-cron-secret') ?? '';
  let iguales = !!cronSecret && secretRecibido.length === cronSecret.length;
  if (cronSecret) {
    let dif = 0;
    for (let i = 0; i < cronSecret.length; i++) dif |= cronSecret.charCodeAt(i) ^ (secretRecibido.charCodeAt(i) || 0);
    iguales = iguales && dif === 0;
  }
  if (!iguales) {
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
  const errores: string[] = [];        // OPS-007: cualquier fallo real debe verse en la respuesta (y en el estado HTTP)
  const pendientes: string[] = [];     // ESC-001: empresas que no alcanzaron en esta corrida
  const inicio = Date.now();

  for (const [companyId, datosCompletos] of porEmpresa) {
    if (!datosCompletos.optin || (!datosCompletos.alertas.length && !datosCompletos.empresas.length)) continue;
    if (Date.now() - inicio > PRESUPUESTO_MS) { pendientes.push(companyId); continue; }
    const datos = {
      ...datosCompletos,
      alertas: datosCompletos.alertas.slice(0, MAX_ALERTAS_POR_EMPRESA),
      empresas: datosCompletos.empresas.slice(0, MAX_EMPRESAS_POR_EMPRESA),
    };
    try {
      const lineasAlertas: string[] = [];
      for (const a of datos.alertas) {
        let n = 0, err: string | null = null;
        try { n = await contarNuevosDeAlerta(a); } catch (e) { err = e instanceof Error ? e.message : String(e); errores.push('alerta ' + companyId + ': ' + err); }
        if (debug) debugInfo.push({ companyId, tipo: 'alerta', nombre: a.nombre, keywords: a.keywords, geos: a.geos, ultimaRevision: a.ultimaRevision, nuevos: n, error: err });
        if (n > 0) lineasAlertas.push('- "' + limpiarNombre(a.nombre) + '": ' + n + ' proceso(s) nuevo(s)');
      }
      const lineasEmpresas: string[] = [];
      for (const emp of datos.empresas) {
        let n = 0, err: string | null = null;
        try { n = await contarNuevosDeEmpresa(emp); } catch (e) { err = e instanceof Error ? e.message : String(e); errores.push('empresa seguida ' + companyId + ': ' + err); }
        if (debug) debugInfo.push({ companyId, tipo: 'empresa', nombre: emp.nombre, ultimaRevision: emp.ultimaRevision, nuevos: n, error: err });
        if (n > 0) lineasEmpresas.push('- ' + limpiarNombre(emp.nombre) + ': ' + n + ' contrato(s) nuevo(s)');
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
          errores.push('correo ' + companyId + ': ' + (mailErr instanceof Error ? mailErr.message : String(mailErr)));
          if (debug) debugInfo.push({ companyId, tipo: 'envio_correo', error: mailErr instanceof Error ? mailErr.message : String(mailErr) });
          continue;
        }
        correosEnviados++;
        detalles.push(userData.user.email + ': ' + totalNuevos + ' novedad(es)');
      }
    } catch (e) {
      console.error('daily-digest: falló la empresa ' + companyId, e);
      errores.push('empresa ' + companyId + ': ' + (e instanceof Error ? e.message : String(e)));
      if (debug) debugInfo.push({ companyId, tipo: 'error_empresa', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Barrido de PDFs huérfanos del bucket `pliegos` (corre una vez al día con el resto; ver pliegosVencidos).
  const barrido = await barrerPliegosHuerfanos(admin);
  if (barrido.error) errores.push('barrido de pliegos: ' + barrido.error);

  const body: Record<string, unknown> = { empresasRevisadas: porEmpresa.size, correosEnviados, errores: errores.length, pendientes: pendientes.length, pliegosBorrados: barrido.borrados };
  // Los correos de los usuarios (detalles) solo se devuelven en modo debug.
  if (debug) { body.detalles = detalles; body.debug = debugInfo; body.mensajesError = errores; }
  // OPS-007: con errores o empresas sin atender la respuesta es 500, para que quien invoque el cron
  // (pg_net, un monitor externo) lo detecte en vez de ver siempre un 200 aunque no se enviara nada.
  const huboProblemas = errores.length > 0 || pendientes.length > 0;
  if (huboProblemas) console.error('daily-digest: ' + errores.length + ' error(es), ' + pendientes.length + ' empresa(s) pendiente(s)');
  return new Response(JSON.stringify(body), {
    status: huboProblemas ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
