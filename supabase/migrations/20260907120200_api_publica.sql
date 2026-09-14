-- ============================================================================
-- Incremento 3 · Etapa 1 — API pública (captura anónima + agregados)
--
-- Lo único que el cliente anónimo puede hacer es:
--   · llamar a public.crear_reporte(...)   → escribe, no lee
--   · leer las vistas de agregación        → conteos, nunca filas individuales
-- ============================================================================

-- ─── Captura anónima ────────────────────────────────────────────────────────

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
as $$
declare
    v_fecha timestamptz := coalesce(p_fecha, now());
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

    insert into privado.reportes (
        id, categoria, colonia_id, ubicacion_texto, coordenadas, fecha, estado
    )
    values (
        p_id,
        p_categoria,
        p_colonia_id,
        nullif(btrim(p_ubicacion_texto), ''),
        case
            when p_lat is not null and p_lon is not null
            then extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography
        end,
        v_fecha,
        'pendiente'
    )
    on conflict (id) do nothing;

    return p_id;
end;
$$;

comment on function public.crear_reporte is
    'Alta anónima de un reporte. Idempotente por id, para que la cola offline pueda reintentar.';

create or replace view public.estadisticas_por_colonia as
select
    c.id                as colonia_id,
    c.nombre            as colonia,
    count(r.id)         as validados,
    count(r.id) filter (where r.fecha >= now() - interval '7 days')  as ultimos_7_dias,
    count(r.id) filter (where r.fecha >= now() - interval '30 days') as ultimos_30_dias,
    max(r.fecha)        as reporte_mas_reciente
from public.colonias c
left join privado.reportes r
       on r.colonia_id = c.id
      and r.estado = 'validado'
group by c.id, c.nombre;

create or replace view public.estadisticas_por_categoria as
select
    r.categoria,
    count(*) as validados,
    count(*) filter (where r.fecha >= now() - interval '30 days') as ultimos_30_dias
from privado.reportes r
where r.estado = 'validado'
group by r.categoria;

create or replace view public.top_colonias as
select colonia_id, colonia, validados
from public.estadisticas_por_colonia
where validados > 0
order by validados desc, colonia asc
limit 5;

create or replace view public.serie_semanal as
select
    date_trunc('week', r.fecha)::date as semana,
    count(*)                          as validados
from privado.reportes r
where r.estado = 'validado'
  and r.fecha >= now() - interval '1 year'
group by 1
order by 1;

create or replace view public.duplicados_por_colonia as
select
    c.id        as colonia_id,
    c.nombre    as colonia,
    count(f.id) as fusionados
from public.colonias c
left join privado.reportes o on o.colonia_id = c.id and o.estado = 'validado'
left join privado.reportes f on f.ref_original = o.id and f.estado = 'fusionado'
group by c.id, c.nombre;

create or replace view public.resumen_general as
select
    (select count(*) from privado.reportes where estado = 'validado')            as validados,
    (select count(*) from privado.reportes
      where estado = 'validado' and fecha >= now() - interval '7 days')          as validados_ultimos_7_dias,
    (select count(distinct colonia_id) from privado.reportes
      where estado = 'validado' and colonia_id is not null)                      as colonias_afectadas,
    (select r.categoria from privado.reportes r
      where r.estado = 'validado'
      group by r.categoria order by count(*) desc, r.categoria asc limit 1)      as categoria_mas_reportada;

grant usage on schema public to anon, authenticated;

grant select on
    public.estadisticas_por_colonia,
    public.estadisticas_por_categoria,
    public.top_colonias,
    public.serie_semanal,
    public.duplicados_por_colonia,
    public.resumen_general
to anon, authenticated;

revoke all on function public.crear_reporte(uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz) from public;
grant execute on function public.crear_reporte(uuid, public.categoria_reporte, integer, text, double precision, double precision, timestamptz) to anon, authenticated;
