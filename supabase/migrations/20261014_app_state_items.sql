-- ARQ-003 (ronda 2): versionado por elemento para las colecciones tipo "mapa id -> registro":
--   historial (Mis procesos: etapa, notas, resultado), perfiles_empresa y perfiles_profesionales.
-- Antes cada una era UNA fila (company_id, key) en app_state con el JSON completo: dos dispositivos que guardaban casi a la vez,
-- aunque hubieran tocado registros DISTINTOS, se pisaban entero. Ahora cada registro es su propia fila (company_id, coleccion, item_id):
-- el cliente sube solo lo que cambió y borra solo lo que ese dispositivo conocía y quitó. Si dos dispositivos editan EXACTAMENTE el
-- mismo registro, sigue siendo "última escritura gana" para ESE registro.
-- NO incluye alertas_guardadas: la Edge Function daily-digest la lee de app_state.
-- Migración de datos: la hace el cliente al leer cada colección por primera vez (toma el blob viejo de app_state, sube cada registro sin
-- pisar filas existentes, pone el marcador app_state.key = 'items_<coleccion>' y borra el blob). Se puede aplicar antes de publicar el cliente:
-- el cliente viejo sigue usando app_state y no toca esta tabla.
create table if not exists public.app_state_items (
  company_id uuid not null references public.companies(id) on delete cascade,
  coleccion text not null check (coleccion in ('historial', 'perfiles_empresa', 'perfiles_profesionales')),
  item_id text not null,       -- id del registro dentro de la colección (id de proceso, de perfil de empresa o de profesional)
  value text not null,         -- JSON del registro
  updated_at timestamptz not null default now(),
  primary key (company_id, coleccion, item_id)
);

alter table public.app_state_items enable row level security;

-- Mismo criterio de aislamiento por empresa que app_state y app_state_analisis_items.
drop policy if exists "leer mis registros" on public.app_state_items;
create policy "leer mis registros" on public.app_state_items
  for select using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "insertar mis registros" on public.app_state_items;
create policy "insertar mis registros" on public.app_state_items
  for insert with check (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "actualizar mis registros" on public.app_state_items;
create policy "actualizar mis registros" on public.app_state_items
  for update using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  ) with check (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
drop policy if exists "borrar mis registros" on public.app_state_items;
create policy "borrar mis registros" on public.app_state_items
  for delete using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );

create index if not exists app_state_items_company_idx
  on public.app_state_items (company_id, coleccion);
