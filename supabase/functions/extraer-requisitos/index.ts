// extraer-requisitos — Supabase Edge Function
// Recibe: { documentos: [{ path, rol: 'pliego'|'adenda', nombre }] }  (PDFs ya subidos al
//         bucket privado `pliegos`, bajo `<company_id>/...`)
// Devuelve: { requisitos: [...], uso: {input_tokens, output_tokens}, modelo }
//
// Claude lee el/los PDF(s) y devuelve una tabla ESTRUCTURADA de requisitos habilitantes con
// página y cita textual. La IA SOLO extrae: la comparación contra la empresa (CUMPLE / NO CUMPLE
// / NO DETERMINABLE) la hace el motor determinístico del navegador, y el navegador verifica cada
// cita contra el texto real del PDF antes de confiar en ella.
//
// - verify_jwt = true (supabase-js adjunta el JWT del usuario).
// - La empresa se resuelve SERVER-SIDE (company_members; si el cliente manda company_id se valida);
//   cada `path` debe empezar por su company_id, porque esta función lee Storage con service_role y
//   sin esa validación un usuario podría pedir el archivo de otra empresa.
// - Tope diario por empresa (ai_usage): el cupo se RESERVA antes de llamar a Claude (así las
//   peticiones simultáneas no lo esquivan) y se consolida con los tokens reales; si la petición
//   se rechaza antes de gastar, la reserva se libera.
// - La llamada tarda 1-2 min: la respuesta es un stream con latidos (espacios) para no chocar con el
//   timeout de inactividad del gateway; los errores posteriores viajan como { error } con HTTP 200.
// - Los PDFs se borran de Storage siempre: el bucket es solo tránsito.
// - Modo debug: solo con el secret DEBUG_SECRET configurado y el header x-debug igual a él.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const BUCKET = 'pliegos';
const MAX_DOCUMENTOS = 6;                 // 1 pliego + hasta 5 adendas
const MAX_BYTES_TOTAL = 24 * 1024 * 1024; // 24 MB de PDF (base64 infla ~33%; el API acepta 32 MB por petición)
const LIMITE_DIARIO = 10;                 // extracciones por empresa en 24 h
const FUNCTION_NAME = 'extraer-requisitos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DocumentoEntrada {
  path: string;
  rol: 'pliego' | 'adenda';
  nombre?: string;
}

const CATEGORIAS = [
  'juridico', 'experiencia_general', 'experiencia_especifica', 'capacidad_financiera',
  'capacidad_organizacional', 'k_residual', 'clasificacion_unspsc', 'personal', 'garantias', 'otro',
];

// structured outputs: additionalProperties:false en todo objeto, sin minimum/maximum/minLength.
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

const REQUISITOS_SCHEMA = {
  type: 'object',
  properties: {
    requisitos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoria: { type: 'string', enum: CATEGORIAS },
          descripcion: { type: 'string' },
          obligatoriedad: { type: 'string', enum: ['obligatorio', 'opcional', 'alternativo', 'complementario'] },
          documento: { type: 'string' },
          pagina: { type: 'integer' },
          cita_textual: { type: 'string' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
          modificado_por_adenda: { type: 'boolean' },
          min_contratos: nullable({ type: 'integer' }),
          valor_minimo_numero: nullable({ type: 'number' }),
          valor_minimo_unidad: nullable({ type: 'string', enum: ['COP', 'SMMLV'] }),
          valor_minimo_pct_presupuesto: nullable({ type: 'number' }),
          regla_conversion_smmlv: nullable({ type: 'string', enum: ['fecha_terminacion', 'fecha_inicio', 'otra'] }),
          cantidad_minima_numero: nullable({ type: 'number' }),
          cantidad_minima_unidad: nullable({ type: 'string' }),
          acumulable: nullable({ type: 'boolean' }),
          ventana_anios: nullable({ type: 'integer' }),
          indicador: nullable({
            type: 'string',
            enum: ['liquidez', 'endeudamiento', 'cobertura_intereses', 'patrimonio', 'capital_trabajo',
              'rentabilidad_patrimonio', 'rentabilidad_activo', 'k_residual', 'otro'],
          }),
          operador: nullable({ type: 'string', enum: ['>=', '<=', '>', '<', '='] }),
          valor_indicador: nullable({ type: 'number' }),
          unidad_indicador: nullable({ type: 'string' }),
          codigos_unspsc: { type: 'array', items: { type: 'string' } },
          grupo_alternativo: nullable({ type: 'string' }),
          notas: nullable({ type: 'string' }),
        },
        required: [
          'categoria', 'descripcion', 'obligatoriedad', 'documento', 'pagina', 'cita_textual', 'confianza',
          'modificado_por_adenda', 'min_contratos', 'valor_minimo_numero', 'valor_minimo_unidad',
          'valor_minimo_pct_presupuesto', 'regla_conversion_smmlv', 'cantidad_minima_numero', 'cantidad_minima_unidad', 'acumulable',
          'ventana_anios', 'indicador', 'operador', 'valor_indicador', 'unidad_indicador', 'codigos_unspsc',
          'grupo_alternativo', 'notas',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['requisitos'],
  additionalProperties: false,
};

const INSTRUCCIONES = `Eres un asesor experto en contratación pública colombiana (obra pública, Ley 80/1150, Decreto 1082 de 2015, Documentos Tipo de Colombia Compra Eficiente).

Los documentos adjuntos son el PLIEGO DE CONDICIONES de un proceso de contratación y, si los hay, sus ADENDAS (que modifican el pliego). Extrae TODOS los REQUISITOS HABILITANTES para participar, en una fila por requisito:
- juridico (capacidad jurídica, inhabilidades, certificados de existencia, RUP vigente, etc.)
- experiencia_general y experiencia_especifica (una fila por cada requisito o por cada fila de las tablas/matrices de experiencia)
- capacidad_financiera (liquidez, endeudamiento, cobertura de intereses, patrimonio, capital de trabajo)
- capacidad_organizacional (rentabilidad sobre patrimonio y sobre activos)
- k_residual (capacidad residual de contratación)
- clasificacion_unspsc (códigos UNSPSC exigidos)
- personal (equipo de trabajo mínimo, perfiles, años de experiencia de cada perfil)
- garantias (garantía de seriedad, cumplimiento, responsabilidad civil: porcentaje o valor y vigencia)
- otro (cualquier otro requisito habilitante que no encaje arriba)

Reglas estrictas:
1. Copia las cifras EXACTAS del documento. Nunca calcules, estimes ni conviertas. Los montos como número plano, sin separadores (1200000000, no 1.200.000.000). Indica la unidad tal cual: COP o SMMLV.
2. Lee con atención las TABLAS (por ejemplo "Matriz 1 - Experiencia", tablas de indicadores financieros, tablas de personal) y no mezcles filas ni columnas.
3. Si el pliego expresa el valor de experiencia como porcentaje del presupuesto oficial (ej. "100% del presupuesto oficial"), pon ese porcentaje en valor_minimo_pct_presupuesto y deja valor_minimo_numero en null.
4. "pagina" es el número de página del PDF de ese documento, contando desde 1 (posición dentro del archivo, no el número impreso en la hoja).
5. "cita_textual" es una copia LITERAL del texto del documento (máximo 300 caracteres) que contiene la cifra o la condición. No parafrasees ni corrijas ortografía. Si la fuente es una tabla, copia el texto de la fila tal como se lee.
6. "documento" es "Pliego de Condiciones" o "Adenda N" (usa el título del archivo). Si una adenda modifica un requisito, reporta SOLO el valor final vigente, pon modificado_por_adenda en true y cita la adenda.
7. Si un dato no aparece de forma explícita, déjalo en null. Si dudas de algo, pon confianza "baja" y explica en notas. NUNCA inventes un requisito ni una cifra.
8. descripcion es una frase breve y clara del requisito (para experiencia: el objeto/tipo de obra exigido, sin la cifra).
9. Para varias opciones equivalentes (basta acreditar una), usa obligatoriedad "alternativo" y el mismo grupo_alternativo en todas.
10. Cuando el requisito de experiencia esté expresado en SMMLV, indica en regla_conversion_smmlv con qué salario mínimo dice el pliego que se convierte el valor de cada contrato ("fecha_terminacion" o "fecha_inicio"); si el pliego no lo dice claramente, déjalo en null; si dice otra regla, "otra".
11. Devuelve únicamente el JSON pedido.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Modo debug: SOLO con el secret DEBUG_SECRET configurado y el header x-debug igual a él
  // (antes bastaba con ?debug=1 para cualquier usuario autenticado, y devolvía el cuerpo crudo
  // de los errores de Anthropic). Sin DEBUG_SECRET queda desactivado.
  const debugSecret = Deno.env.get('DEBUG_SECRET');
  const debug = !!debugSecret && req.headers.get('x-debug') === debugSecret;
  const log: unknown[] = [];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service_role: leer Storage/company_members y escribir ai_usage
  );

  let pathsParaBorrar: string[] = [];
  let reservaId: number | null = null;
  let delegadoAlStream = false;

  const limpiarPdfs = async () => {
    if (!pathsParaBorrar.length) return;
    try { await supabase.storage.from(BUCKET).remove(pathsParaBorrar); } catch { /* best effort */ }
    pathsParaBorrar = [];
  };
  const liberarReserva = async () => {
    if (reservaId == null) return;
    try { await supabase.from('ai_usage').delete().eq('id', reservaId); } catch { /* best effort */ }
    reservaId = null;
  };

  try {
    // 1. Parsear body
    const body = await req.json().catch(() => null);
    const documentos: DocumentoEntrada[] | null = body && Array.isArray(body.documentos) ? body.documentos : null;
    if (!documentos || documentos.length === 0 || documentos.length > MAX_DOCUMENTOS) {
      return json({ error: `Se requiere body.documentos (1 a ${MAX_DOCUMENTOS} PDFs)` }, 400);
    }
    if (documentos.filter((d) => d && d.rol === 'pliego').length !== 1) {
      return json({ error: 'Debe haber exactamente 1 documento con rol "pliego"' }, 400);
    }

    // 2. Usuario y empresa (SERVER-SIDE). Si el cliente manda company_id, se VALIDA contra
    // company_members (nunca se confía en él); si no, se toma una membresía de forma determinista.
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return json({ error: 'No autenticado' }, 401);

    let consultaMembresia = supabase.from('company_members').select('company_id').eq('user_id', user.id);
    if (body && typeof body.company_id === 'string') consultaMembresia = consultaMembresia.eq('company_id', body.company_id);
    const { data: membership, error: memberErr } = await consultaMembresia.order('company_id').limit(1).maybeSingle();
    if (memberErr || !membership) return json({ error: 'Usuario sin empresa asociada' }, 403);
    const companyId: string = membership.company_id;
    if (debug) log.push({ step: 'auth', userId: user.id, companyId });

    // 3. Validar rutas: deben pertenecer a la empresa del usuario (esta función lee con service_role)
    for (const d of documentos) {
      if (!d || typeof d.path !== 'string' || !d.path.startsWith(companyId + '/') || d.path.includes('..')) {
        return json({ error: 'Ruta de documento no permitida' }, 403);
      }
    }
    pathsParaBorrar = documentos.map((d) => d.path);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY no configurada' }, 503);

    // 4. Tope diario: se RESERVA el cupo (insert) ANTES de la llamada de 1-2 minutos y luego se
    // cuenta, así peticiones simultáneas no pueden esquivar el tope leyendo todas "0 usadas".
    const { data: reserva, error: reservaErr } = await supabase
      .from('ai_usage')
      .insert({ company_id: companyId, function_name: FUNCTION_NAME, model: MODEL, input_tokens: 0, output_tokens: 0, results_count: 0 })
      .select('id')
      .single();
    if (reservaErr || !reserva) {
      if (debug) log.push({ step: 'reserva_error', error: reservaErr?.message });
      return json({ error: 'No se pudo registrar el uso de IA. ¿Existe la tabla ai_usage? (migración 20260922_ai_usage.sql)', ...(debug ? { log } : {}) }, 500);
    }
    reservaId = reserva.id as number;
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usadas, error: countErr } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('function_name', FUNCTION_NAME)
      .gte('created_at', desde);
    if (countErr) {
      await liberarReserva();
      return json({ error: 'No se pudo verificar el tope diario de uso de IA.' }, 500);
    }
    if ((usadas ?? 0) > LIMITE_DIARIO) {
      await liberarReserva();
      return json({ error: `Alcanzaste el máximo de ${LIMITE_DIARIO} extracciones con IA en 24 horas. Intenta de nuevo más tarde.` }, 429);
    }

    // 5. Bajar los PDFs de Storage y armar los bloques `document`
    const contenido: unknown[] = [];
    let bytesTotal = 0;
    for (const d of documentos) {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(d.path);
      if (dlErr || !blob) return json({ error: 'No se pudo leer uno de los documentos de Storage' }, 404);
      bytesTotal += blob.size;
      if (bytesTotal > MAX_BYTES_TOTAL) {
        return json({ error: 'Los PDFs suman más de 24 MB. Sube menos documentos o un archivo más liviano.' }, 413);
      }
      const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
      // `nombre` viene del cliente y va al título del documento: se sanea y se acorta.
      const nombreSeguro = String(d.nombre ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 60);
      contenido.push({
        type: 'document',
        title: d.rol === 'pliego' ? 'Pliego de Condiciones' : (nombreSeguro || 'Adenda'),
        source: { type: 'base64', media_type: 'application/pdf', data: b64 },
      });
    }
    contenido.push({ type: 'text', text: INSTRUCCIONES });
    if (debug) log.push({ step: 'documentos', n: documentos.length, bytesTotal });

    // 6. Llamada a Claude. Tarda 1-2 min: la respuesta se devuelve como un STREAM que emite un
    // espacio cada 15 s (JSON válido admite espacios iniciales) para que el gateway de Supabase
    // no corte por inactividad (~150 s sin bytes -> 504). Una vez que empieza el stream el estado
    // HTTP ya es 200: los errores viajan dentro del cuerpo como { error }, y el cliente los revisa.
    const llamarAnthropic = async (): Promise<Record<string, unknown>> => {
      const anthropicResp = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16000,
          output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: REQUISITOS_SCHEMA },
          },
          messages: [{ role: 'user', content: contenido }],
        }),
      });

      if (!anthropicResp.ok) {
        const errText = await anthropicResp.text();
        await liberarReserva(); // la petición fue rechazada: no hubo gasto, no cuenta
        if (debug) log.push({ step: 'anthropic_error', status: anthropicResp.status, body: errText });
        let detalle = '';
        try { detalle = String(JSON.parse(errText)?.error?.message ?? '').slice(0, 200); } catch { /* sin detalle */ }
        const msg = anthropicResp.status === 400 && /credit balance/i.test(errText)
          ? 'La cuenta de Anthropic no tiene crédito suficiente.'
          : `Error de la API de Anthropic (${anthropicResp.status})` + (anthropicResp.status === 400 && detalle ? ': ' + detalle : '');
        return { error: msg, ...(debug ? { log } : {}) };
      }

      const data = await anthropicResp.json();
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      if (debug) log.push({ step: 'anthropic_response', usage: data.usage, stopReason: data.stop_reason });
      // Ya hubo gasto real: se consolida la reserva con los tokens aunque el resultado luego falle.
      if (reservaId != null) {
        await supabase.from('ai_usage').update({ input_tokens: inputTokens, output_tokens: outputTokens }).eq('id', reservaId);
      }
      if (data.stop_reason === 'max_tokens') {
        return { error: 'La respuesta de la IA se cortó por longitud. Intenta con menos documentos.', ...(debug ? { log } : {}) };
      }
      if (data.stop_reason === 'refusal') {
        return { error: 'La IA rechazó procesar el documento.', ...(debug ? { log } : {}) };
      }
      const textBlock = (data.content ?? []).find((c: { type: string }) => c.type === 'text');
      let requisitos: unknown[] = [];
      try {
        const parsed = JSON.parse(textBlock?.text ?? '');
        requisitos = Array.isArray(parsed.requisitos) ? parsed.requisitos : [];
      } catch {
        return { error: 'Respuesta inesperada de la IA (JSON inválido)', ...(debug ? { log, raw: data } : {}) };
      }
      if (reservaId != null) {
        await supabase.from('ai_usage').update({ results_count: requisitos.length }).eq('id', reservaId);
      }
      return {
        requisitos,
        uso: { input_tokens: inputTokens, output_tokens: outputTokens },
        modelo: MODEL,
        ...(debug ? { log } : {}),
      };
    };

    delegadoAlStream = true; // desde aquí el stream es responsable de borrar los PDFs y liberar la reserva
    const codificador = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const latido = setInterval(() => {
          try { controller.enqueue(codificador.encode(' ')); } catch { /* stream ya cerrado */ }
        }, 15000);
        let payload: Record<string, unknown>;
        try {
          payload = await llamarAnthropic();
        } catch (err) {
          await liberarReserva(); // falló antes de recibir respuesta (red): no hubo gasto
          const msg = err instanceof Error ? err.message : String(err);
          payload = { error: debug ? `Error interno: ${msg}` : 'Error interno al procesar el documento.' };
        } finally {
          clearInterval(latido);
          await limpiarPdfs();
        }
        controller.enqueue(codificador.encode(JSON.stringify(payload)));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: debug ? `Error interno: ${msg}` : 'Error interno al procesar la solicitud.', ...(debug ? { log } : {}) }, 500);
  } finally {
    // Si no se llegó a delegar en el stream, el bucket (solo tránsito) y la reserva se limpian aquí.
    if (!delegadoAlStream) {
      await limpiarPdfs();
      await liberarReserva();
    }
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
