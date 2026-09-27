// eliminar-cuenta — Supabase Edge Function (PRIV-002: derecho de supresión, Ley 1581 de 2012)
// Recibe: { confirmacion: 'ELIMINAR' }  con la sesión del usuario (verify_jwt = true).
//
// Borra, en este orden, todo lo que la cuenta tiene en el proyecto:
//   1. Storage: los PDF que pudieran haber quedado en el bucket `pliegos/<company_id>/`
//      (la extracción con IA los borra siempre, esto es una red de seguridad).
//   2. La empresa (`companies`) cuando el usuario es su ÚNICO miembro: la cascada elimina
//      `company_members`, `app_state` y `ai_usage`. Si la empresa tiene más miembros solo se
//      elimina la membresía de este usuario (sus datos de empresa siguen siendo de los demás).
//   3. El usuario de Auth (correo, contraseña y metadatos, incluido el registro de consentimiento).
// El usuario se borra AL FINAL: si un paso anterior falla, la cuenta sigue existiendo y puede
// reintentar; nunca queda una cuenta borrada con datos huérfanos.
//
// NO VERIFICADO hasta desplegarla: se escribió sin poder ejecutar Deno ni probar contra el proyecto real.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'pliegos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'La función no está configurada (faltan variables de Supabase).' }, 500);

  // Quién llama: se valida el JWT del propio usuario; nunca se acepta un user_id del cuerpo.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: sesion, error: errSesion } = await userClient.auth.getUser();
  if (errSesion || !sesion?.user) return json({ error: 'Sesión no válida. Inicia sesión de nuevo.' }, 401);
  const uid = sesion.user.id;

  let cuerpo: { confirmacion?: string } = {};
  try { cuerpo = await req.json(); } catch (_e) { /* cuerpo vacío */ }
  if (cuerpo.confirmacion !== 'ELIMINAR') return json({ error: 'Falta la confirmación explícita.' }, 400);

  const admin = createClient(url, service);
  try {
    const { data: membresias, error: errMiembros } = await admin.from('company_members').select('company_id').eq('user_id', uid);
    if (errMiembros) throw new Error('No se pudieron leer las empresas de la cuenta: ' + errMiembros.message);

    let empresasEliminadas = 0;
    for (const m of membresias ?? []) {
      const cid = m.company_id as string;
      const { count, error: errCuenta } = await admin.from('company_members').select('user_id', { count: 'exact', head: true }).eq('company_id', cid);
      if (errCuenta) throw new Error('No se pudo contar los miembros: ' + errCuenta.message);

      if ((count ?? 0) <= 1) {
        // Storage: cualquier PDF que haya quedado bajo <company_id>/ (paginado por si hubiera muchos).
        for (;;) {
          const { data: archivos, error: errList } = await admin.storage.from(BUCKET).list(cid, { limit: 100 });
          if (errList) throw new Error('No se pudo listar el almacenamiento: ' + errList.message);
          if (!archivos || archivos.length === 0) break;
          const { error: errRm } = await admin.storage.from(BUCKET).remove(archivos.map((a) => cid + '/' + a.name));
          if (errRm) throw new Error('No se pudo borrar el almacenamiento: ' + errRm.message);
          if (archivos.length < 100) break;
        }
        // La cascada elimina company_members, app_state y ai_usage de esta empresa.
        const { error: errEmp } = await admin.from('companies').delete().eq('id', cid);
        if (errEmp) throw new Error('No se pudo borrar la empresa: ' + errEmp.message);
        empresasEliminadas++;
      } else {
        const { error: errMem } = await admin.from('company_members').delete().eq('company_id', cid).eq('user_id', uid);
        if (errMem) throw new Error('No se pudo quitar tu membresía: ' + errMem.message);
      }
    }

    const { error: errUser } = await admin.auth.admin.deleteUser(uid);
    if (errUser) throw new Error('No se pudo eliminar el usuario: ' + errUser.message);

    return json({ ok: true, empresasEliminadas });
  } catch (e) {
    console.error('eliminar-cuenta:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
