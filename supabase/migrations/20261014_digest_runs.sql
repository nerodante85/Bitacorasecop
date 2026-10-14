-- ESC-001 / OPS-007: monitor del correo diario (`daily-digest`).
-- Problema: si el digest falla (o el cron deja de correr, o se rota el secreto), nadie se entera: pg_cron marca "succeeded"
-- apenas encola la llamada y la respuesta real (500/401) queda en net._http_response, que se purga en horas.
-- Solución: la función deja UNA FILA por ejecución en `digest_runs` (solo si arrancó y autenticó) y un SEGUNDO job de pg_cron,
-- independiente de la función, llama a `revisar_salud_digest()` 30 minutos después: si falta la fila, quedó colgada o no
-- terminó bien, envía un correo de alerta por Resend (pg_net). Un día sin novedades es "ok" y NO envía nada.
--
-- Pasos manuales (los haces tú; el repo nunca lleva estos valores). En Supabase > Project Settings > Vault, o con SQL:
--   select vault.create_secret('TU_CLAVE_DE_RESEND', 'resend_api_key');   -- mejor una clave nueva de solo envío
--   select vault.create_secret('TU_CORREO', 'monitor_alert_to');           -- a quién llega la alerta
--   select vault.create_secret('Nombre <remitente verificado>', 'monitor_alert_from');  -- OPCIONAL: sin esto se usa el de pruebas de Resend
-- Prueba sin enviar nada:  select public.revisar_salud_digest(true);   (devuelve 'ok', 'sin_ejecucion', 'colgada' o el estado)
create table if not exists public.digest_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'ok', 'degradado', 'falla')),
  empresas_revisadas integer,
  empresas_con_optin integer,
  correos_enviados integer,
  errores integer,
  pendientes integer,
  pliegos_borrados integer,
  duracion_ms integer,
  motivos text[] not null default '{}'   -- códigos fijos (errores, pendientes, lectura_estado): nunca correos ni mensajes de error
);

create index if not exists digest_runs_started_idx on public.digest_runs (started_at desc);

-- Mismo patrón que ai_usage: RLS activo y SIN políticas. Solo service_role (la Edge Function) lee y escribe; el navegador no.
alter table public.digest_runs enable row level security;
revoke all on public.digest_runs from anon, authenticated;

create or replace function public.revisar_salud_digest(p_dry_run boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.digest_runs%rowtype;
  v_motivo text := 'ok';
  v_clave text;
  v_para text;
  v_de text;
begin
  select * into v_fila from public.digest_runs
   where started_at > now() - interval '3 hours'
   order by started_at desc
   limit 1;

  if not found then
    v_motivo := 'sin_ejecucion';
  elsif v_fila.estado = 'en_curso' and v_fila.started_at < now() - interval '10 minutes' then
    v_motivo := 'colgada';
  elsif v_fila.estado in ('degradado', 'falla') then
    v_motivo := v_fila.estado || ': ' || array_to_string(v_fila.motivos, ', ');
  end if;

  if v_motivo <> 'ok' and not p_dry_run then
    select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    select decrypted_secret into v_para from vault.decrypted_secrets where name = 'monitor_alert_to' limit 1;
    select decrypted_secret into v_de from vault.decrypted_secrets where name = 'monitor_alert_from' limit 1;
    if v_clave is not null and v_para is not null then
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_clave),
        body := jsonb_build_object(
          'from', coalesce(v_de, 'Bitácora SECOP <onboarding@resend.dev>'),
          'to', jsonb_build_array(v_para),
          'subject', 'Bitácora SECOP: el correo diario necesita revisión',
          'text', 'El monitor del correo diario encontró un problema: ' || v_motivo || E'.\n\n'
            || 'Qué revisar: Supabase > Edge Functions > daily-digest > Logs, y la tabla digest_runs (select * from public.digest_runs order by started_at desc limit 5).' || E'\n'
            || 'Causas frecuentes: sin_ejecucion = el cron no corrió, la función está caída o el secreto CRON_SECRET no coincide (401); colgada = se agotó el tiempo; degradado = errores o empresas pendientes.' || E'\n\n'
            || '-- Monitor de Bitácora SECOP (aviso automático, una vez al día como máximo).'
        )
      );
    else
      v_motivo := v_motivo || ' (faltan los secretos resend_api_key / monitor_alert_to en el Vault: no se pudo enviar el aviso)';
    end if;
  end if;

  delete from public.digest_runs where started_at < now() - interval '90 days';
  return v_motivo;
end;
$$;

-- Solo el cron (que corre como dueño de la base) y service_role pueden ejecutarla: no se expone por /rest/v1/rpc.
revoke execute on function public.revisar_salud_digest(boolean) from public, anon, authenticated;
