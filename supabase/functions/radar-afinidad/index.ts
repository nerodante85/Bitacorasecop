// radar-afinidad — Supabase Edge Function
// Recibe: { resultados: [{id, objeto, entidad, valor, ...}] }
// Devuelve: { scores: [{id, score, razones}] }
//
// Modelo: claude-haiku-4-5 (más barato), tool_choice forzado (JSON estructurado siempre).
// Protegida con verify_jwt=true (supabase-js adjunta el JWT del usuario).
// La empresa se resuelve SERVER-SIDE vía company_members (nunca se confía en el cliente).
// El contador de ai_usage se incrementa DESPUÉS de la llamada exitosa.
// ?debug=1 devuelve detalles sin alterar el comportamiento normal.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_RESULTS_PER_CALL = 10; // limitar el batch para controlar costo

interface ResultadoSecop {
  id: string;
  objeto: string;
  entidad?: string;
  valor?: string | number;
  modalidad?: string;
}

interface ScoreAfinidad {
  id: string;
  score: number;   // 0-100
  razones: string[]; // 2-3 razones breves
}

// Invocada directo desde el navegador (supabase-js functions.invoke, con el
// JWT del usuario en Authorization) -- eso dispara una petición OPTIONS de
// verificación previa (CORS preflight) antes de la petición real. Sin
// responderla con estos headers, el navegador bloquea la llamada entera
// antes de que llegue a esta función, y supabase-js lo reporta como "Failed
// to send a request to the Edge Function" (sin más detalle del motivo real).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-radar-debug',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const debug = new URL(req.url).searchParams.get('debug') === '1' ||
    req.headers.get('x-radar-debug') === '1';
  const log: unknown[] = [];

  try {
    // 1. Parsear body
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.resultados) || body.resultados.length === 0) {
      return json({ error: 'Se requiere body.resultados (array no vacío)' }, 400);
    }
    const resultados: ResultadoSecop[] = body.resultados.slice(0, MAX_RESULTS_PER_CALL);

    // 2. Resolver empresa del usuario autenticado (SERVER-SIDE, nunca del cliente)
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service_role para poder leer company_members y escribir ai_usage
    );

    // Extraer el user_id del JWT (supabase-js lo pone en Authorization: Bearer <jwt>)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) {
      return json({ error: 'No autenticado' }, 401);
    }

    // Obtener company_id del usuario
    const { data: membership, error: memberErr } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    if (memberErr || !membership) {
      return json({ error: 'Usuario sin empresa asociada' }, 403);
    }
    const companyId = membership.company_id;
    if (debug) log.push({ step: 'auth', userId: user.id, companyId });

    // 3. Obtener objeto_social del perfil activo de la empresa (desde app_state)
    const { data: appStateRow } = await supabase
      .from('app_state')
      .select('value')
      .eq('company_id', companyId)
      .eq('key', 'perfiles_empresa')
      .limit(1)
      .single();

    let objetoSocial = '';
    if (appStateRow?.value) {
      try {
        const perfiles = JSON.parse(appStateRow.value);
        // Tomar el primer perfil que tenga objeto_social definido
        const perfil = Object.values(perfiles as Record<string, {objeto_social?: string}>)
          .find((p) => p.objeto_social?.trim());
        objetoSocial = (perfil as {objeto_social?: string} | undefined)?.objeto_social?.trim() ?? '';
      } catch { /* si falla el parse, objeto_social queda vacío */ }
    }
    if (debug) log.push({ step: 'objeto_social', objetoSocial: objetoSocial || '(no configurado)' });

    if (!objetoSocial) {
      return json({
        error: 'Configura el "Objeto social / actividad principal" en el Perfil de la empresa antes de usar el Radar de Afinidad IA.',
      }, 422);
    }

    // 4. Llamar a Claude Haiku con tool_choice forzado
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY no configurada' }, 503);
    }

    const toolName = 'reportar_afinidad';
    const toolSchema = {
      name: toolName,
      description: 'Reporta el puntaje de afinidad (0-100) y las razones para cada proceso de licitación evaluado.',
      input_schema: {
        type: 'object',
        properties: {
          scores: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id:      { type: 'string', description: 'ID del proceso (devolver exactamente como se recibió)' },
                score:   { type: 'integer', minimum: 0, maximum: 100, description: 'Puntaje de afinidad 0-100' },
                razones: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3, description: '2-3 razones breves en español' },
              },
              required: ['id', 'score', 'razones'],
            },
          },
        },
        required: ['scores'],
      },
    };

    const prompt = [
      `Eres un asesor experto en contratación pública colombiana.`,
      ``,
      `Objeto social / actividad principal de la empresa:`,
      `"${objetoSocial}"`,
      ``,
      `Evalúa la afinidad de la empresa con cada uno de los siguientes procesos de licitación (SECOP).`,
      `Para cada proceso devuelve:`,
      `- score: entero 0-100 (0 = sin relación alguna, 100 = coincidencia perfecta con el objeto social)`,
      `- razones: 2-3 frases MUY breves en español explicando el puntaje (máx 15 palabras cada una)`,
      ``,
      `Procesos a evaluar:`,
      ...resultados.map((r, i) =>
        `${i + 1}. ID: ${r.id}\n   Objeto: ${r.objeto}\n   Entidad: ${r.entidad ?? 'n/d'}\n   Valor: ${r.valor ?? 'n/d'}`
      ),
    ].join('\n');

    const anthropicResp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        tools: [toolSchema],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      if (debug) log.push({ step: 'anthropic_error', status: anthropicResp.status, body: errText });
      return json({ error: `Error de la API de Anthropic: ${anthropicResp.status}`, ...(debug ? { log } : {}) }, 502);
    }

    const anthropicData = await anthropicResp.json();
    if (debug) log.push({ step: 'anthropic_response', usage: anthropicData.usage, stopReason: anthropicData.stop_reason });

    // Extraer el resultado del tool_use (tool_choice forzado garantiza que siempre esté)
    const toolUse = anthropicData.content?.find((c: {type: string}) => c.type === 'tool_use');
    if (!toolUse?.input?.scores) {
      return json({ error: 'Respuesta inesperada de la API de Anthropic (sin scores)', ...(debug ? { log, raw: anthropicData } : {}) }, 502);
    }
    const scores: ScoreAfinidad[] = toolUse.input.scores;

    // 5. Incrementar ai_usage DESPUÉS del éxito (solo se cuenta lo que costó dinero)
    const inputTokens  = anthropicData.usage?.input_tokens  ?? 0;
    const outputTokens = anthropicData.usage?.output_tokens ?? 0;
    await supabase.from('ai_usage').insert({
      company_id:     companyId,
      function_name:  'radar-afinidad',
      model:          MODEL,
      input_tokens:   inputTokens,
      output_tokens:  outputTokens,
      results_count:  scores.length,
    });

    if (debug) log.push({ step: 'usage_saved', inputTokens, outputTokens, results: scores.length });

    return json({
      scores,
      ...(debug ? { log } : {}),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `Error interno: ${msg}`, ...(debug ? { log } : {}) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
