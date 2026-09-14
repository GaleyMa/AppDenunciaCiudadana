-- ============================================================================
-- Incremento 3 · Etapa 1 (backend) — Esquema base
--
-- ANONIMATO ESTRUCTURAL: la decisión de fondo es que los datos crudos NO viven
-- en un esquema expuesto por la API. Supabase (PostgREST) solo publica los
-- esquemas configurados —por omisión `public`—, así que una tabla en `privado`
-- es inalcanzable con la anon key, aunque alguien tenga la URL del proyecto.
-- Lo único público son agregados y funciones controladas.
--
-- Además, la tabla de reportes NO tiene ninguna columna que identifique a quien
-- reportó: no hay user_id, ni correo, ni IP, ni user agent. No es que se
-- oculten: no se recogen.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists privado;

comment on schema privado is
    'Datos crudos de reportes. NO exponer en la API: contiene coordenadas y '
    'texto libre. El acceso público pasa solo por las vistas y funciones de public.';

create type public.categoria_reporte as enum (
    'bache', 'alumbrado', 'basura', 'fuga-agua', 'vandalismo', 'punto-riesgo', 'otro'
);

create type public.estado_reporte as enum (
    'pendiente', 'validado', 'descartado', 'fusionado'
);

create type public.motivo_descarte as enum (
    'duplicado', 'sin-evidencia', 'spam'
);

create table public.colonias (
    id          integer generated always as identity primary key,
    nombre      text not null unique,
    municipio   text not null default 'Mexicali',
    entidad     text not null default 'Baja California',
    geom        extensions.geometry(MultiPolygon, 4326),
    creado_en   timestamptz not null default now()
);

comment on table public.colonias is
    'Catálogo de colonias de Mexicali. Lectura pública; escritura solo por el dueño de la base.';

create index colonias_geom_idx on public.colonias using gist (geom);

create table privado.reportes (
    id              uuid primary key default gen_random_uuid(),

    categoria       public.categoria_reporte not null,
    colonia_id      integer references public.colonias (id) on delete set null,

    ubicacion_texto text,

    coordenadas     extensions.geography(Point, 4326),

    fecha           timestamptz not null default now(),
    estado          public.estado_reporte not null default 'pendiente',

    motivo          public.motivo_descarte,
    ref_original    uuid references privado.reportes (id) on delete set null,

    foto_ruta       text,

    creado_en       timestamptz not null default now(),
    actualizado_en  timestamptz not null default now(),

    constraint descarte_exige_motivo
        check (estado <> 'descartado' or motivo is not null),
    constraint motivo_solo_al_descartar
        check (motivo is null or estado = 'descartado'),
    constraint fusion_exige_original
        check (estado <> 'fusionado' or ref_original is not null),
    constraint original_solo_al_fusionar
        check (ref_original is null or estado = 'fusionado'),
    constraint no_fusionar_consigo_mismo
        check (ref_original is distinct from id),
    constraint ubicacion_texto_acotado
        check (ubicacion_texto is null or char_length(ubicacion_texto) <= 200)
);

comment on table privado.reportes is
    'Reportes crudos. Sin columna de autor por diseño: no hay user_id, correo, IP ni user agent.';
comment on column privado.reportes.coordenadas is
    'Uso interno del servidor. NUNCA exponer en vistas ni en funciones.';

create index reportes_estado_idx on privado.reportes (estado);
create index reportes_colonia_idx on privado.reportes (colonia_id);
create index reportes_fecha_idx on privado.reportes (fecha desc);
create index reportes_categoria_idx on privado.reportes (categoria);
create index reportes_pendientes_idx on privado.reportes (fecha desc)
    where estado = 'pendiente';

create or replace function privado.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
    new.actualizado_en := now();
    return new;
end;
$$;

create trigger reportes_actualizado_en
    before update on privado.reportes
    for each row execute function privado.tocar_actualizado_en();
