-- Tabla de registro de uso de IA (Fase C: Radar de Afinidad).
-- RLS habilitado SIN ninguna policy: ni el dueño autenticado puede leer/escribir
-- directamente, solo la Edge Function con service_role. Así el contador no puede
-- manipularse desde el cliente.
create table if not exists public.ai_usage (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  company_id     uuid        not null references public.companies(id) on delete cascade,
  function_name  text        not null,           -- 'radar-afinidad', 'vision-ia', etc.
  model          text        not null,
  input_tokens   integer     not null default 0,
  output_tokens  integer     not null default 0,
  results_count  integer     not null default 0  -- cuántos procesos se evaluaron
);

alter table public.ai_usage enable row level security;
-- Sin policies: acceso solo vía service_role (Edge Function).
