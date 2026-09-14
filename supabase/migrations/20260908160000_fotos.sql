-- ============================================================================
-- Incremento 3 — Fotos de los reportes
--
-- El moderador necesita ver la foto: sin ella, validar es adivinar. Hasta aquí
-- la imagen se quedaba en el IndexedDB del teléfono que la capturó y el panel
-- mostraba "Sin foto".
--
-- El bucket es PRIVADO. Una foto puede traer rostros, placas o EXIF con
-- coordenadas, así que nunca se sirve por URL pública: el moderador obtiene una
-- URL firmada de un rato, y solo si su cuenta está dada de alta.
-- ============================================================================

-- ─── Bucket ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'reportes-fotos',
    'reportes-fotos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.es_moderador()
returns boolean
language sql
stable
security definer
set search_path = privado, public, pg_temp
as $fn$
    select privado.es_moderador();
$fn$;

revoke all on function public.es_moderador() from public;
grant execute on function public.es_moderador() to anon, authenticated;

drop policy if exists "fotos_subida_anonima" on storage.objects;
drop policy if exists "fotos_lectura_moderadores" on storage.objects;

create policy "fotos_subida_anonima"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'reportes-fotos');

create policy "fotos_lectura_moderadores"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'reportes-fotos' and public.es_moderador());

drop function if exists public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz);

create or replace function public.crear_reporte(
    p_id              uuid,
    p_categoria       public.categoria_reporte,
    p_colonia_id      integer default null,
    p_ubicacion_texto text default null,
    p_lat             double precision default null,
    p_lon             double precision default null,
    p_fecha           timestamptz default null,
    p_foto_ruta       text default null
)
returns uuid
language plpgsql
security definer
set search_path = privado, public, extensions, pg_temp
as $fn$
declare
    v_fecha timestamptz := coalesce(p_fecha, now());
    v_punto extensions.geography;
begin
    if p_id is null then
        raise exception 'El reporte necesita un id generado en el cliente.';
    end if;

    if p_lat is not null and (p_lat < -90 or p_lat > 90) then
        raise exception 'Latitud fuera de rango.';
    end if;

    if p_lon is not null and (p_lon < -180 or p_lon > 180) then
        raise exception 'Longitud fuera de rango.';
    end if;

    if v_fecha > now() + interval '1 day' then
        v_fecha := now();
    end if;

    if p_lat is not null and p_lon is not null then
        v_punto := extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography;
    end if;

    insert into privado.reportes (
        id, categoria, colonia_id, ubicacion_texto, coordenadas, codigo_postal,
        fecha, estado, foto_ruta
    )
    values (
        p_id, p_categoria, p_colonia_id,
        nullif(btrim(p_ubicacion_texto), ''),
        v_punto,
        privado.cp_de_punto(v_punto),
        v_fecha, 'pendiente',
        nullif(btrim(p_foto_ruta), '')
    )
    on conflict (id) do nothing;

    return p_id;
end;
$fn$;

revoke all on function public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz, text) from public;
grant execute on function public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz, text)
    to anon, authenticated;

create or replace function public.adjuntar_foto(p_id uuid, p_foto_ruta text)
returns boolean
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $fn$
declare
    v_actualizados integer;
begin
    if p_foto_ruta is null or btrim(p_foto_ruta) = '' then
        raise exception 'Falta la ruta de la foto.';
    end if;

    update privado.reportes
       set foto_ruta = btrim(p_foto_ruta)
     where id = p_id
       and foto_ruta is null
       and estado = 'pendiente';

    get diagnostics v_actualizados = row_count;
    return v_actualizados > 0;
end;
$fn$;

revoke all on function public.adjuntar_foto(uuid, text) from public;
grant execute on function public.adjuntar_foto(uuid, text) to anon, authenticated;
