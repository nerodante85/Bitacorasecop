-- ============================================================================
-- Bitácora SECOP — cron del resumen diario por correo (Fase 6 del prompt
-- maestro). Ejecutar UNA VEZ en el SQL Editor de tu proyecto de Supabase,
-- DESPUÉS de desplegar la Edge Function `daily-digest` (ver
-- supabase/functions/daily-digest/index.ts) y de configurar sus secrets.
-- Ver CLAUDE.md, "Fase 6: correo/job de alertas" para el paso a paso
-- completo (crear cuenta en Resend, conseguir el project ref, etc.).
-- ============================================================================

-- pg_cron programa la tarea; pg_net hace el POST HTTP a la Edge Function
-- desde dentro de Postgres -- ambas son extensiones oficiales de Supabase,
-- se activan con un toggle en Database → Extensions (o con este `create
-- extension` si tu plan lo permite desde el SQL Editor).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reemplaza los dos placeholders antes de correr esto (escribe el valor
-- real directo, SIN los símbolos < > -- dejarlos causa un error de sintaxis
-- distinto, no relacionado con este cron; es un error real que ya pasó
-- probando esto, ver CLAUDE.md):
--   TU_PROJECT_REF     -- el ID de tu proyecto (está en la URL del panel de
--                          Supabase: https://supabase.com/dashboard/project/TU_PROJECT_REF)
--   TU_CRON_SECRET     -- el MISMO valor que le pusiste al secret CRON_SECRET
--                          de la Edge Function (supabase secrets set CRON_SECRET=...)
--                          -- sin que coincidan, la función responde 401 y no
--                          envía nada (ver el checkeo al inicio de index.ts).
select cron.schedule(
  'bitacora-secop-daily-digest',
  '0 13 * * *', -- 13:00 UTC = 8:00 a.m. en Colombia (UTC-5) -- ajusta si quieres otra hora
  $$
  select net.http_post(
    url := 'https://TU_PROJECT_REF.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'TU_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- Para revisar que quedó programado:
--   select * from cron.job;
-- Para ver las últimas ejecuciones (útil para depurar sin esperar 24h --
-- también puedes invocar la función a mano con curl, ver CLAUDE.md):
--   select * from cron.job_run_details order by start_time desc limit 10;
-- Para desactivarlo si algún día ya no quieres el correo diario:
--   select cron.unschedule('bitacora-secop-daily-digest');
