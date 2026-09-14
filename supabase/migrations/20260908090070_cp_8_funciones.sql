-- ============================================================================
-- Incremento 3 · Etapa 1b — Códigos postales (8 de 8: derivación y vista)
--
-- El mapa del tablero es un coroplético por CÓDIGO POSTAL, no por colonia: el
-- GeoJSON público disponible (open-mexico/mexico-geojson) trae polígonos de CP
-- y no existe uno abierto de colonias de Mexicali. La colonia sigue siendo la
-- unidad de las tablas y del top 5.
--
-- Va partido en varios archivos porque el SQL Editor de Supabase rechaza
-- peticiones grandes con "Request Entity Too Large". Ejecútalos EN ORDEN.
-- ============================================================================

set search_path = public, extensions;

create index codigos_postales_geom_idx on public.codigos_postales using gist (geom);

-- ─── El reporte guarda su CP ────────────────────────────────────────────────

alter table privado.reportes
    add column codigo_postal integer references public.codigos_postales (codigo);

create index reportes_cp_idx on privado.reportes (codigo_postal);

comment on column privado.reportes.codigo_postal is
    'Derivado por el servidor desde las coordenadas. Es la forma agregada y publicable de la ubicación.';

-- ─── Derivación ─────────────────────────────────────────────────────────────

create or replace function privado.cp_de_punto(p extensions.geography)
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
    select coalesce(
        -- El punto cae dentro de un polígono.
        (select cp.codigo from public.codigos_postales cp
          where extensions.st_intersects(cp.geom, p) limit 1),
        -- O cayó en una rendija entre polígonos (van simplificados, así que las
        -- fronteras no encajan al milímetro): se toma el más cercano dentro de
        -- 1 km. Más lejos que eso, se deja nulo en vez de inventar ubicación.
        (select cp.codigo from public.codigos_postales cp
          where extensions.st_dwithin(cp.geom, p, 1000)
          order by extensions.st_distance(cp.geom, p) limit 1)
    );
$fn$;

-- ─── crear_reporte ahora calcula el CP ──────────────────────────────────────

create or replace function public.crear_reporte(
    p_id              uuid,
    p_categoria       public.categoria_reporte,
    p_colonia_id      integer default null,
    p_ubicacion_texto text default null,
    p_lat             double precision default null,
    p_lon             double precision default null,
    p_fecha           timestamptz default null
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
        id, categoria, colonia_id, ubicacion_texto, coordenadas, codigo_postal, fecha, estado
    )
    values (
        p_id, p_categoria, p_colonia_id,
        nullif(btrim(p_ubicacion_texto), ''),
        v_punto,
        privado.cp_de_punto(v_punto),
        v_fecha, 'pendiente'
    )
    on conflict (id) do nothing;

    return p_id;
end;
$fn$;

-- ─── Vista para el coroplético ──────────────────────────────────────────────
-- Devuelve TODOS los CP, incluidos los que van en cero: el mapa necesita
-- pintarlos también.

create or replace view public.estadisticas_por_cp as
select
    cp.codigo                                                        as codigo_postal,
    count(r.id)                                                      as validados,
    count(r.id) filter (where r.fecha >= now() - interval '30 days') as ultimos_30_dias
from public.codigos_postales cp
left join privado.reportes r
       on r.codigo_postal = cp.codigo
      and r.estado = 'validado'
group by cp.codigo;

grant select on public.estadisticas_por_cp to anon, authenticated;
