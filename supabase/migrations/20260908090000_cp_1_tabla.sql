-- ============================================================================
-- Incremento 3 · Etapa 1b — Códigos postales (1 de 8: tabla)
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

create table public.codigos_postales (
    codigo integer primary key,
    geom   extensions.geography(MultiPolygon, 4326) not null
);

comment on table public.codigos_postales is
    'Polígonos de código postal de Mexicali. Geografía pública, no datos de personas.';

alter table public.codigos_postales enable row level security;

create policy cp_lectura_publica
    on public.codigos_postales for select to anon, authenticated using (true);

grant select on public.codigos_postales to anon, authenticated;
