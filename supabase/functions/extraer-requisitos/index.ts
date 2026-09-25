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
// - La empresa se resuelve SERVER-SIDE (company_members); cada `path` debe empezar por su
//   company_id, porque esta función lee Storage con service_role y sin esa validación un usuario
//   podría pedir el archivo de otra empresa.
// - Tope diario por empresa (ai_usage) para acotar el gasto.
// - ai_usage se incrementa DESPUÉS de la llamada exitosa.
// - Los PDFs se borran de Storage siempre (finally): el bucket es solo tránsito.
// - ?debug=1 o header x-debug: 1 devuelve detalles (log) sin cambiar el comportamiento normal.

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

  const debug = new URL(req.url).searchParams.get('debug') === '1' || req.headers.get('x-debug') === '1';
  const log: unknown[] = [];
  let pathsParaBorrar: string[] = [];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service_role: leer Storage/company_members y escribir ai_usage
  );

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

    // 2. Usuario y empresa (SERVER-SIDE, nunca del cliente)
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return json({ error: 'No autenticado' }, 401);

    const { data: membership, error: memberErr } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
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

    // 4. Tope diario por empresa
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usadas } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('function_name', FUNCTION_NAME)
      .gte('created_at', desde);
    if ((usadas ?? 0) >= LIMITE_DIARIO) {
      return json({ error: `Alcanzaste el máximo de ${LIMITE_DIARIO} extracciones con IA en 24 horas. Intenta de nuevo más tarde.` }, 429);
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY no configurada' }, 503);

    // 5. Bajar los PDFs de Storage y armar los bloques `document`
    const contenido: unknown[] = [];
    let bytesTotal = 0;
    for (const d of documentos) {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(d.path);
      if (dlErr || !blob) return json({ error: `No se pudo leer el documento "${d.nombre ?? d.path}" de Storage` }, 404);
      bytesTotal += blob.size;
      if (bytesTotal > MAX_BYTES_TOTAL) {
        return json({ error: 'Los PDFs suman más de 24 MB. Sube menos documentos o un archivo más liviano.' }, 413);
      }
      const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
      contenido.push({
        type: 'document',
        title: d.rol === 'pliego' ? 'Pliego de Condiciones' : (d.nombre || 'Adenda'),
        source: { type: 'base64', media_type: 'application/pdf', data: b64 },
      });
    }
    contenido.push({ type: 'text', text: INSTRUCCIONES });
    if (debug) log.push({ step: 'documentos', n: documentos.length, bytesTotal });

    // 6. Llamar a Claude (salida JSON estructurada)
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
      if (debug) log.push({ step: 'anthropic_error', status: anthropicResp.status, body: errText });
      const msg = anthropicResp.status === 400 && /credit balance/i.test(errText)
        ? 'La cuenta de Anthropic no tiene crédito suficiente.'
        : `Error de la API de Anthropic: ${anthropicResp.status}`;
      return json({ error: msg, ...(debug ? { log } : {}) }, 502);
    }

    const data = await anthropicResp.json();
    if (debug) log.push({ step: 'anthropic_response', usage: data.usage, stopReason: data.stop_reason });
    if (data.stop_reason === 'max_tokens') {
      return json({ error: 'La respuesta de la IA se cortó por longitud. Intenta con menos documentos.', ...(debug ? { log } : {}) }, 502);
    }
    if (data.stop_reason === 'refusal') {
      return json({ error: 'La IA rechazó procesar el documento.', ...(debug ? { log } : {}) }, 502);
    }

    const textBlock = (data.content ?? []).find((c: { type: string }) => c.type === 'text');
    let requisitos: unknown[] = [];
    try {
      const parsed = JSON.parse(textBlock?.text ?? '');
      requisitos = Array.isArray(parsed.requisitos) ? parsed.requisitos : [];
    } catch {
      return json({ error: 'Respuesta inesperada de la IA (JSON inválido)', ...(debug ? { log, raw: data } : {}) }, 502);
    }

    // 7. Registrar uso DESPUÉS del éxito (solo se cuenta lo que costó dinero)
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    await supabase.from('ai_usage').insert({
      company_id: companyId,
      function_name: FUNCTION_NAME,
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      results_count: requisitos.length,
    });

    return json({
      requisitos,
      uso: { input_tokens: inputTokens, output_tokens: outputTokens },
      modelo: MODEL,
      ...(debug ? { log } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `Error interno: ${msg}`, ...(debug ? { log } : {}) }, 500);
  } finally {
    // El bucket es solo tránsito: se borra siempre (éxito o fallo).
    if (pathsParaBorrar.length) {
      try { await supabase.storage.from(BUCKET).remove(pathsParaBorrar); } catch { /* best effort */ }
    }
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
