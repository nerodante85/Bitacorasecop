-- ARQ-003: versionado por elemento para "analisis_pliegos" (los procesos con pliego
-- analizado). Antes era UNA fila (company_id,'analisis_pliegos') en app_state con el JSON
-- completo adentro -- dos dispositivos guardando casi a la vez, aunque hubieran tocado
-- pliegos DISTINTOS, se pisaban entero (última escritura gana para TODO, no solo para lo
-- que cada uno cambió de verdad). Esta tabla nueva guarda cada pliego analizado en su
-- propia fila (company_id, item_id = id del proceso): dos dispositivos que editan procesos
-- distintos ya no colisionan; si editan EXACTAMENTE el mismo proceso, sigue siendo "última
-- escritura gana" para ESE elemento -- caso legítimo, no el bug que esto corrige.
--
-- Alcance de esta primera ronda (decisión explícita con el usuario): solo
-- "analisis_pliegos", la colección con más peso y ediciones concurrentes probables. El
-- resto de claves-colección (perfiles_empresa, perfiles_profesionales, alertas_guardadas)
-- se quedan con el comportamiento actual (un blob por clave) -- son más pequeñas y se
-- editan con menos frecuencia; si hace falta, se extienden con el mismo patrón más adelante.
create table if not exists public.app_state_analisis_items (
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id text not null,       -- id del proceso (el mismo que usa analisis[id] en el cliente)
  value text not null,         -- JSON del análisis de ESE proceso (sin el texto pesado del PDF -- ver PERF-005/IndexedDB)
  updated_at timestamptz not null default now(),
  primary key (company_id, item_id)
);

alter table public.app_state_analisis_items enable row level security;

-- Mismo criterio de aislamiento por empresa que app_state (ver schema.sql).
drop policy if exists "leer mis pliegos analizados" on public.app_state_analisis_items;
create policy "leer mis pliegos analizados" on public.app_state_analisis_items
  for select using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "insertar mis pliegos analizados" on public.app_state_analisis_items;
create policy "insertar mis pliegos analizados" on public.app_state_analisis_items
  for insert with check (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "actualizar mis pliegos analizados" on public.app_state_analisis_items;
create policy "actualizar mis pliegos analizados" on public.app_state_analisis_items
  for update using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "borrar mis pliegos analizados" on public.app_state_analisis_items;
create policy "borrar mis pliegos analizados" on public.app_state_analisis_items
  for delete using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );

create index if not exists app_state_analisis_items_company_idx
  on public.app_state_analisis_items (company_id);
