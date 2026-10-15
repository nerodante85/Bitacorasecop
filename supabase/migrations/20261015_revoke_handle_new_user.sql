-- RA2-7 (reauditoría 2026-10-15): public.handle_new_user() es una función de disparador (on_auth_user_created en auth.users) con
-- SECURITY DEFINER. Supabase la exponía por la API REST (/rest/v1/rpc/handle_new_user) a los roles anon y authenticated. Un disparador
-- no necesita EXECUTE para dispararse (Postgres lo comprueba solo al crearlo), así que se revoca. Se conservan postgres y service_role.
-- Aplicado en el proyecto real el 2026-10-15 y comprobado: el registro de un usuario sigue creando su empresa y su membresía.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
