-- ============================================================================
-- Incremento 3 · Etapa 1 — Moderación autenticada
--
-- Sustituye a la URL secreta del Incremento 2, que el propio código marcaba
-- como ofuscación y no como seguridad. Ahora moderar exige:
--   1. sesión iniciada (auth.uid() no nulo), y
--   2. estar dado de alta en privado.moderadores.
--
-- El moderador tampoco ve las coordenadas: le basta colonia, texto y fecha.
-- ============================================================================

create table privado.moderadores (
    user_id   uuid primary key references auth.users (id) on delete cascade,
    nombre    text,
    creado_en timestamptz not null default now()
);

comment on table privado.moderadores is
    'Altas manuales. Se administra desde el panel de Supabase o con la service_role key.';

alter table privado.moderadores enable row level security;

create or replace function privado.es_moderador()
returns boolean
language sql
stable
security definer
set search_path = privado, public, pg_temp
as $$
    select exists (
        select 1 from privado.moderadores m where m.user_id = auth.uid()
    );
$$;

create or replace function privado.exigir_moderador()
returns void
language plpgsql
stable
security definer
set search_path = privado, public, pg_temp
as $$
begin
    if auth.uid() is null then
        raise exception 'Se requiere sesión iniciada.' using errcode = '28000';
    end if;

    if not privado.es_moderador() then
        raise exception 'La cuenta no tiene permisos de moderación.' using errcode = '42501';
    end if;
end;
$$;

create or replace function public.listar_pendientes(p_limite integer default 50)
returns table (
    id              uuid,
    categoria       public.categoria_reporte,
    colonia_id      integer,
    colonia         text,
    ubicacion_texto text,
    fecha           timestamptz,
    foto_ruta       text
)
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $$
begin
    perform privado.exigir_moderador();

    return query
    select r.id, r.categoria, r.colonia_id, c.nombre, r.ubicacion_texto, r.fecha, r.foto_ruta
    from privado.reportes r
    left join public.colonias c on c.id = r.colonia_id
    where r.estado = 'pendiente'
    order by r.fecha desc
    limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$$;

create or replace function public.validar_reporte(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $$
declare
    v_id uuid;
begin
    perform privado.exigir_moderador();

    update privado.reportes
       set estado = 'validado', motivo = null, ref_original = null
     where id = p_id and estado = 'pendiente'
    returning id into v_id;

    if v_id is null then
        raise exception 'El reporte no existe o ya fue revisado.';
    end if;

    return v_id;
end;
$$;

create or replace function public.descartar_reporte(
    p_id     uuid,
    p_motivo public.motivo_descarte
)
returns uuid
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $$
declare
    v_id uuid;
begin
    perform privado.exigir_moderador();

    if p_motivo is null then
        raise exception 'Descartar exige un motivo.';
    end if;

    update privado.reportes
       set estado = 'descartado', motivo = p_motivo, ref_original = null
     where id = p_id and estado = 'pendiente'
    returning id into v_id;

    if v_id is null then
        raise exception 'El reporte no existe o ya fue revisado.';
    end if;

    return v_id;
end;
$$;

create or replace function public.fusionar_reporte(
    p_id           uuid,
    p_ref_original uuid
)
returns uuid
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $$
declare
    v_estado_original public.estado_reporte;
    v_id uuid;
begin
    perform privado.exigir_moderador();

    if p_ref_original is null then
        raise exception 'Fusionar exige el id del reporte original.';
    end if;

    if p_ref_original = p_id then
        raise exception 'Un reporte no puede ser duplicado de sí mismo.';
    end if;

    select estado into v_estado_original
    from privado.reportes where id = p_ref_original;

    if v_estado_original is null then
        raise exception 'El reporte original no existe.';
    end if;

    if v_estado_original not in ('pendiente', 'validado') then
        raise exception 'El original debe estar pendiente o validado.';
    end if;

    update privado.reportes
       set estado = 'fusionado', ref_original = p_ref_original, motivo = null
     where id = p_id and estado = 'pendiente'
    returning id into v_id;

    if v_id is null then
        raise exception 'El reporte no existe o ya fue revisado.';
    end if;

    return v_id;
end;
$$;

revoke all on function public.listar_pendientes(integer) from public;
revoke all on function public.validar_reporte(uuid) from public;
revoke all on function public.descartar_reporte(uuid, public.motivo_descarte) from public;
revoke all on function public.fusionar_reporte(uuid, uuid) from public;

grant execute on function public.listar_pendientes(integer) to authenticated;
grant execute on function public.validar_reporte(uuid) to authenticated;
grant execute on function public.descartar_reporte(uuid, public.motivo_descarte) to authenticated;
grant execute on function public.fusionar_reporte(uuid, uuid) to authenticated;
