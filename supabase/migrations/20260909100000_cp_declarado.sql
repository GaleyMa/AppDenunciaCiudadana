-- ============================================================================
-- Incremento 3 — El ciudadano puede declarar su código postal
--
-- Problema observado al usar la app: solo aparecía en el mapa el reporte donde
-- se autorizó el GPS. Sin coordenadas no hay código postal, y sin código postal
-- no hay dónde pintarlo. La mayoría de los reportes se quedaban fuera.
--
-- Ahora el formulario ofrece un catálogo verificado de asentamientos con su CP,
-- así que el reporte puede traer el código postal aunque no haya GPS.
--
-- ORDEN DE CONFIANZA:
--   1. Coordenadas → el servidor deriva el CP (nadie puede mentirle).
--   2. Si no hay, el CP declarado, PERO solo si existe en el catálogo de
--      polígonos. Así el mapa siempre puede pintarlo y un número inventado no
--      entra a la base.
-- ============================================================================

drop function if exists public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz, text);

create or replace function public.crear_reporte(
    p_id              uuid,
    p_categoria       public.categoria_reporte,
    p_colonia_id      integer default null,
    p_ubicacion_texto text default null,
    p_lat             double precision default null,
    p_lon             double precision default null,
    p_fecha           timestamptz default null,
    p_foto_ruta       text default null,
    p_codigo_postal   integer default null
)
returns uuid
language plpgsql
security definer
set search_path = privado, public, extensions, pg_temp
as $fn$
declare
    v_fecha timestamptz := coalesce(p_fecha, now());
    v_punto extensions.geography;
    v_cp    integer;
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

    -- 1. Lo que dicen las coordenadas manda.
    v_cp := privado.cp_de_punto(v_punto);

    -- 2. Si no hubo GPS, se acepta el CP declarado siempre que sea uno real.
    if v_cp is null and p_codigo_postal is not null then
        select cp.codigo into v_cp
        from public.codigos_postales cp
        where cp.codigo = p_codigo_postal;
    end if;

    insert into privado.reportes (
        id, categoria, colonia_id, ubicacion_texto, coordenadas, codigo_postal,
        fecha, estado, foto_ruta
    )
    values (
        p_id, p_categoria, p_colonia_id,
        nullif(btrim(p_ubicacion_texto), ''),
        v_punto,
        v_cp,
        v_fecha, 'pendiente',
        nullif(btrim(p_foto_ruta), '')
    )
    on conflict (id) do nothing;

    return p_id;
end;
$fn$;

revoke all on function public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision,
    timestamptz, text, integer) from public;
grant execute on function public.crear_reporte(
    uuid, public.categoria_reporte, integer, text, double precision, double precision,
    timestamptz, text, integer) to anon, authenticated;

-- ─── Reparar los reportes que ya están sin CP ───────────────────────────────
--
-- Mismo criterio que adjuntar_foto: solo rellena lo que está vacío, nunca pisa
-- un CP ya derivado de coordenadas reales.

create or replace function public.declarar_codigo_postal(p_id uuid, p_codigo_postal integer)
returns boolean
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $fn$
declare
    v_actualizados integer;
begin
    update privado.reportes r
       set codigo_postal = p_codigo_postal
     where r.id = p_id
       and r.codigo_postal is null
       and r.coordenadas is null   -- si hubo GPS, el servidor ya decidió
       and r.estado in ('pendiente', 'validado')
       and exists (select 1 from public.codigos_postales cp where cp.codigo = p_codigo_postal);

    get diagnostics v_actualizados = row_count;
    return v_actualizados > 0;
end;
$fn$;

revoke all on function public.declarar_codigo_postal(uuid, integer) from public;
grant execute on function public.declarar_codigo_postal(uuid, integer) to anon, authenticated;
