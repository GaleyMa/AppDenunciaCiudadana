-- ============================================================================
-- Incremento 3 · Etapa 1 — Semilla de colonias
--
-- Mismo catálogo que src/reportes/datos/colonias-mexicali.js, para que el
-- colonia_id del servidor y las sugerencias del formulario hablen de lo mismo.
--
-- OJO: sigue siendo una lista de arranque, no un catálogo oficial. Falta
-- contrastarla con el Ayuntamiento de Mexicali / INEGI y cargar los polígonos
-- (columna geom) para el mapa coroplético de la Etapa 2.
-- ============================================================================

insert into public.colonias (nombre) values
    ('Aviación'),
    ('Alamitos'),
    ('Baja California'),
    ('Burócrata'),
    ('Centro Cívico'),
    ('Cuauhtémoc Norte'),
    ('Cuauhtémoc Sur'),
    ('Esperanza'),
    ('Ex Ejido Chapultepec'),
    ('Ex Ejido Coahuila'),
    ('Ex Ejido Zacatecas'),
    ('González Ortega'),
    ('Guajardo'),
    ('Hidalgo'),
    ('Independencia'),
    ('Industrial'),
    ('Islas Agrarias A'),
    ('Islas Agrarias B'),
    ('Lázaro Cárdenas'),
    ('Los Pinos'),
    ('Miguel Alemán'),
    ('Nacionalista'),
    ('Nueva'),
    ('Nuevo Mexicali'),
    ('Orizaba'),
    ('Primera Sección (Zona Centro)'),
    ('Pro Hogar'),
    ('Progreso'),
    ('Pueblo Nuevo'),
    ('Robledo'),
    ('Santo Niño'),
    ('Segunda Sección'),
    ('Solidaridad'),
    ('Villa Residencial del Prado'),
    ('Villafontana'),
    ('Villas del Rey'),
    ('Xochimilco')
on conflict (nombre) do nothing;
