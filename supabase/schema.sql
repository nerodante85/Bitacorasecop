-- ============================================================================
-- Bitácora SECOP — esquema de base de datos (Fase 1: cuentas y sincronización)
-- ============================================================================
-- Ejecutar completo, una sola vez, en el SQL Editor de tu proyecto de
-- Supabase (Project → SQL Editor → New query → pegar todo → Run).
-- Ver "Fase 1: cuentas y sincronización" en CLAUDE.md para el contexto
-- completo y los pasos de activación en el frontend (rellenar SUPABASE_URL /
-- SUPABASE_ANON_KEY en index.html).
--
-- Diseño deliberadamente simple para esta fase: en vez de normalizar cada
-- perfil/análisis/experiencia en tablas separadas (como sugiere el modelo de
-- 25 entidades de la plataforma completa), se usa UNA tabla genérica
-- clave-valor por empresa (`app_state`) que espeja 1:1 las claves que la app
-- ya guardaba en localStorage (historial, perfiles_empresa, analisis_pliegos,
-- experiencia_evaluacion, perfiles_profesionales, etc.). Así el frontend
-- cambia de respaldo (Supabase en vez de localStorage) sin reescribir ni una
-- línea de la lógica de negocio existente. Cuando una fase futura necesite de
-- verdad cruzar filas entre empresas o hacer consultas relacionales sobre
-- alguno de estos datos (ej. inteligencia competitiva, alertas por criterios
-- estructurados), esa clave puntual se normaliza a su propia tabla entonces;
-- no hace falta normalizar todo de una vez ahora ("no reescritura masiva sin
-- justificarla").
-- ============================================================================

create extension if not exists pgcrypto;

-- Una "empresa" (tenant). En esta fase, 1 usuario = 1 empresa (se crea sola al
-- registrarse, ver el trigger más abajo) -- company_members ya deja abierta
-- la puerta a varios usuarios por empresa (plan Enterprise) sin tener que
-- migrar el esquema más adelante.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi empresa',
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner', -- 'owner' | 'member' -- solo 'owner' se usa en Fase 1
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Todo lo que hoy vive en localStorage bajo 'bitacora_<key>' vive aquí bajo
-- (company_id, key), como el mismo texto (JSON.stringify para objetos/
-- arrays) -- sin reinterpretarlo en SQL.
create table if not exists public.app_state (
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

-- Row Level Security: un usuario solo puede leer/escribir datos de una
-- empresa de la que sea miembro. Esto es lo que hace cumplir "un usuario
-- nunca debe poder ver información de otra empresa" sin depender de que el
-- frontend se porte bien -- la política corre en la base de datos, no en el
-- navegador (la app es 100% cliente, sin backend propio que pudiera hacer
-- de segunda barrera).
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.app_state enable row level security;

create policy "ver mi empresa" on public.companies
  for select using (
    id in (select company_id from public.company_members where user_id = auth.uid())
  );

create policy "ver mi membresía" on public.company_members
  for select using (user_id = auth.uid());

create policy "leer datos de mi empresa" on public.app_state
  for select using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
create policy "insertar datos de mi empresa" on public.app_state
  for insert with check (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
create policy "actualizar datos de mi empresa" on public.app_state
  for update using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
create policy "borrar datos de mi empresa" on public.app_state
  for delete using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );

-- Nótese que NO hay políticas de insert/update/delete para companies ni
-- company_members: por diseño, el único punto de entrada para crear una
-- empresa y hacerse miembro de ella es el trigger de abajo (security
-- definer), disparado por Supabase Auth al registrarse -- nunca el cliente
-- directamente. Sin esas filas previas, tampoco podría insertar en
-- app_state (las políticas de arriba exigen ya ser miembro).

-- Al registrarse un usuario nuevo (auth.users), se le crea su empresa y se le
-- hace 'owner' automáticamente -- el frontend nunca crea la empresa por su
-- cuenta. security definer + search_path fijo para que el trigger pueda
-- saltarse RLS de forma controlada, sin quedar expuesto a "search path
-- hijacking" (recomendación estándar de Supabase/Postgres para funciones
-- security definer).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_empresa_id uuid;
begin
  insert into public.companies (name) values ('Mi empresa') returning id into nueva_empresa_id;
  insert into public.company_members (company_id, user_id, role) values (nueva_empresa_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Registro de uso de IA (Edge Function transcribir-pdf). RLS habilitado SIN
-- ninguna policy: ni el dueño autenticado puede leer/escribir directamente, solo
-- la Edge Function con service_role -- así el contador no puede manipularse desde
-- el cliente. (Misma definición que supabase/migrations/20260922_ai_usage.sql;
-- el bucket privado `pliegos` vive en supabase/migrations/20260926_pliegos_storage.sql.)
create table if not exists public.ai_usage (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  company_id     uuid        not null references public.companies(id) on delete cascade,
  function_name  text        not null,
  model          text        not null,
  input_tokens   integer     not null default 0,
  output_tokens  integer     not null default 0,
  results_count  integer     not null default 0
);
alter table public.ai_usage enable row level security;

-- ============================================================================
-- Monitor del correo diario (ESC-001 / OPS-007): espejo de supabase/migrations/20261014_digest_runs.sql
-- ============================================================================
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
