// ============================================================================
// Bitácora SECOP — búsqueda en lenguaje natural (LLM). Diseñado originalmente
// y pospuesto por el usuario; retomado más adelante.
// ============================================================================
// POR QUÉ EXISTE ESTE ARCHIVO SEPARADO (no vive en index.html): a diferencia
// de la anon key de Supabase o el App Token de Socrata (credenciales
// PÚBLICAS por diseño, protegidas por RLS o por solo subir un límite de
// tasa), una API key de Anthropic es un secreto real y FACTURABLE por cada
// uso -- nunca puede ir embebida en código de cliente. Esta Edge Function es
// el único lugar donde vive esa key (`ANTHROPIC_API_KEY`, un Supabase
// secret, nunca en este repo).
//
// A diferencia de `daily-digest` (la invoca un cron, sin usuario detrás),
// a ÉSTA la llama el navegador directo, con la sesión de un usuario
// logueado -- por eso SÍ se deja la verificación de JWT de la plataforma en
// su valor por defecto (no se toca `verify_jwt` en config.toml para esta
// función): Supabase ya rechaza la solicitud antes de que corra este código
// si el `Authorization: Bearer <token>` no es un JWT válido, así que ni el
// año de la propuesta ni el resto del código necesitan revalidarlo.
//
// LÍMITE DIARIO POR EMPRESA (tabla `llm_usage`, ver supabase/schema.sql):
// SIN ninguna policy de RLS a propósito -- con RLS habilitado y CERO
// policies, ni siquiera el propio dueño de la empresa puede leer/escribir
// esa tabla con su JWT (RLS deniega todo por defecto sin una policy que lo
// permita). Solo esta función, usando la service_role key, puede tocarla.
// Así el contador de uso diario no se puede resetear ni falsear desde el
// cliente bajo ninguna circunstancia -- ni con inspección de red, ni
// llamando directo a la REST API de Supabase con la sesión propia.
//
// QUÉ HACE Y QUÉ NO: traduce una descripción en lenguaje natural a los
// MISMOS 4 campos que ya usa "Filtros de búsqueda" en index.html
// (especialidades, departamento, valor mínimo, valor máximo) -- no inventa
// un motor de búsqueda nuevo ni interpreta nada más allá de esos 4 campos.
// El resultado se le devuelve al navegador, que llena esos campos y corre
// runSearch() tal cual -- esta función nunca toca SECOP directamente.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

// Tope conservador: a ~$0.001 USD por consulta con Claude Haiku 4.5 (ver
// CLAUDE.md, sección de esta fase, para el cálculo verificado contra
// claude.com/pricing), 20/día por empresa es <$0.60/mes en el peor caso de
// una empresa que la use a diario -- ajustable acá sin tocar nada más.
const LIMITE_DIARIO = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no soportado' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Cliente con el JWT del usuario (no el service role) -- resuelve quién es
  // y a qué empresa pertenece respetando RLS, sin confiar en nada que el
  // cliente pudiera mandar en el body (un companyId falso, por ejemplo).
  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData || !userData.user) {
    return jsonResponse({ error: 'Sesión inválida o expirada -- vuelve a iniciar sesión.' }, 401);
  }

  const { data: membership, error: memberErr } = await userClient
    .from('company_members')
    .select('company_id')
    .limit(1)
    .maybeSingle();
  if (memberErr || !membership) {
    return jsonResponse({ error: 'No se pudo resolver tu empresa.' }, 403);
  }
  const companyId = membership.company_id as string;

  let texto: string;
  try {
    const body = await req.json();
    texto = String(body.texto || '').trim();
  } catch (_e) {
    return jsonResponse({ error: 'Cuerpo de la solicitud inválido (se esperaba JSON con "texto").' }, 400);
  }
  if (!texto) return jsonResponse({ error: 'Escribe una descripción de lo que buscas.' }, 400);
  if (texto.length > 500) return jsonResponse({ error: 'Descripción demasiado larga (máximo 500 caracteres).' }, 400);

  // service_role: única identidad que puede tocar llm_usage (sin RLS/policies).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const { data: usoActual } = await admin
    .from('llm_usage')
    .select('count')
    .eq('company_id', companyId)
    .eq('day', hoy)
    .maybeSingle();
  const usados = (usoActual && usoActual.count) || 0;
  if (usados >= LIMITE_DIARIO) {
    return jsonResponse({
      error: 'Límite diario de búsquedas en lenguaje natural alcanzado (' + LIMITE_DIARIO + '/día). Usa los filtros manuales mientras tanto -- el límite se reinicia mañana.',
      usados, limite: LIMITE_DIARIO,
    }, 429);
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return jsonResponse({ error: 'La búsqueda en lenguaje natural no está configurada todavía (falta ANTHROPIC_API_KEY).' }, 500);
  }

  // tool_choice forzado: la respuesta SIEMPRE viene como el input de esta
  // herramienta (JSON estructurado), nunca como texto libre que haya que
  // parsear a mano -- evita la clase de bug de "el modelo no respondió
  // exactamente el formato esperado".
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'Extraes filtros de búsqueda de procesos de contratación pública colombiana (SECOP) a partir de una descripción en lenguaje natural, en español. Nunca inventes un departamento, valor o palabra clave que el texto no mencione -- si algo no se menciona, se deja vacío/cero.',
      messages: [{ role: 'user', content: texto }],
      tools: [{
        name: 'extraer_filtros',
        description: 'Registra los filtros de búsqueda detectados en la descripción del usuario.',
        input_schema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array', items: { type: 'string' }, maxItems: 4,
              description: 'Palabras clave de especialidad/objeto del contrato (ej. "pavimentación", "alcantarillado"). Como mucho 4, en español, sin acentos innecesarios de más.',
            },
            departamento: {
              type: 'string',
              description: 'Nombre de un departamento colombiano si el texto lo menciona explícitamente (ej. "Norte de Santander"). Cadena vacía si no se menciona ninguno.',
            },
            valorMinimo: {
              type: 'number',
              description: 'Valor mínimo en pesos colombianos SI el texto menciona un piso o "más de X" (convertir "millones"/"mil millones" al número completo). 0 si no se menciona.',
            },
            valorMaximo: {
              type: 'number',
              description: 'Valor máximo en pesos colombianos SI el texto menciona un techo o "menos de X"/"hasta X". 0 si no se menciona.',
            },
          },
          required: ['keywords', 'departamento', 'valorMinimo', 'valorMaximo'],
        },
      }],
      tool_choice: { type: 'tool', name: 'extraer_filtros' },
    }),
  });

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text();
    console.error('nl-search: Anthropic respondió ' + anthropicRes.status, errBody);
    return jsonResponse({ error: 'No se pudo interpretar la descripción (servicio de IA no disponible en este momento).' }, 502);
  }
  const anthropicData = await anthropicRes.json();
  const toolUse = (anthropicData.content || []).find((c: { type: string }) => c.type === 'tool_use');
  if (!toolUse) {
    console.error('nl-search: respuesta de Anthropic sin tool_use', JSON.stringify(anthropicData).slice(0, 500));
    return jsonResponse({ error: 'No se pudo interpretar la descripción -- intenta reformularla.' }, 502);
  }
  const filtros = toolUse.input;

  // Incrementa el contador SOLO si la llamada a Anthropic (la parte que
  // cuesta dinero) de verdad se hizo -- un 4xx/400 antes de llegar aquí
  // (sesión inválida, límite ya alcanzado, texto vacío) no consume cupo.
  await admin.from('llm_usage').upsert(
    { company_id: companyId, day: hoy, count: usados + 1 },
    { onConflict: 'company_id,day' }
  );

  return jsonResponse({ filtros, usados: usados + 1, limite: LIMITE_DIARIO });
});
