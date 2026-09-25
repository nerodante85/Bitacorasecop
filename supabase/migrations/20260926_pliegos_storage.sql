-- Bucket privado para los PDFs de pliegos/adendas que se mandan a la IA
-- (Edge Function `extraer-requisitos`). El navegador sube el PDF aquí, la
-- función lo baja con service_role, se lo pasa a Claude y lo BORRA al terminar
-- (éxito o fallo) -- el bucket es solo tránsito, no archivo.
--
-- Aislamiento por empresa (mismo criterio que las políticas de app_state en
-- schema.sql): el primer segmento de la ruta es el company_id, y solo se puede
-- leer/escribir/borrar bajo el company_id de una empresa de la que se es miembro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pliegos', 'pliegos', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pliegos: subir en mi empresa" on storage.objects;
create policy "pliegos: subir en mi empresa" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pliegos'
    and (storage.foldername(name))[1] in (
      select company_id::text from public.company_members where user_id = auth.uid()
    )
  );

drop policy if exists "pliegos: leer de mi empresa" on storage.objects;
create policy "pliegos: leer de mi empresa" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pliegos'
    and (storage.foldername(name))[1] in (
      select company_id::text from public.company_members where user_id = auth.uid()
    )
  );

drop policy if exists "pliegos: borrar de mi empresa" on storage.objects;
create policy "pliegos: borrar de mi empresa" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pliegos'
    and (storage.foldername(name))[1] in (
      select company_id::text from public.company_members where user_id = auth.uid()
    )
  );
