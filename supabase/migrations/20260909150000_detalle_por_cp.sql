-- ============================================================================
-- Incremento 3 — Detalle por zona del mapa
--
-- Al tocar una zona del coroplético hay que poder decir de QUÉ fueron los
-- reportes, no solo cuántos. Este desglose sigue siendo agregado: conteos por
-- código postal y categoría, nunca reportes individuales.
-- ============================================================================

create or replace view public.estadisticas_por_cp_categoria as
select
    r.codigo_postal,
    r.categoria,
    count(*) as validados
from privado.reportes r
where r.estado = 'validado'
  and r.codigo_postal is not null
group by r.codigo_postal, r.categoria;

grant select on public.estadisticas_por_cp_categoria to anon, authenticated;

-- La fecha del último reporte de la zona da idea de si el problema es actual.
-- create or replace permite agregar columnas al final, no en medio.
create or replace view public.estadisticas_por_cp as
select
    cp.codigo                                                        as codigo_postal,
    count(r.id)                                                      as validados,
    count(r.id) filter (where r.fecha >= now() - interval '30 days') as ultimos_30_dias,
    max(r.fecha)                                                     as reporte_mas_reciente
from public.codigos_postales cp
left join privado.reportes r
       on r.codigo_postal = cp.codigo
      and r.estado = 'validado'
group by cp.codigo;

grant select on public.estadisticas_por_cp to anon, authenticated;
