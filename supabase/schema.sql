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
