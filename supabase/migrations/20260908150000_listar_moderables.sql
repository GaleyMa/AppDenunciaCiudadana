-- ============================================================================
-- Incremento 3 · Moderación server-side — candidatos de fusión
--
-- listar_pendientes() solo devuelve lo que falta revisar, pero al fusionar hay
-- que poder señalar como original un reporte YA VALIDADO (el caso normal: llega
-- el duplicado de algo que ya se acepto). Esta función devuelve los dos estados
-- que el gestor admite como original.
--
-- Igual que las demás: exige sesión y alta de moderador, y NO devuelve
-- coordenadas.
-- ============================================================================

create or replace function public.listar_moderables(p_limite integer default 100)
returns table (
    id              uuid,
    categoria       public.categoria_reporte,
    colonia         text,
    ubicacion_texto text,
    fecha           timestamptz,
    estado          public.estado_reporte
)
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $fn$
begin
    perform privado.exigir_moderador();

    return query
    select r.id, r.categoria, c.nombre, r.ubicacion_texto, r.fecha, r.estado
    from privado.reportes r
    left join public.colonias c on c.id = r.colonia_id
    where r.estado in ('pendiente', 'validado')
    order by r.fecha desc
    limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$fn$;

revoke all on function public.listar_moderables(integer) from public;
grant execute on function public.listar_moderables(integer) to authenticated;
