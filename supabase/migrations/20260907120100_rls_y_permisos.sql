-- ============================================================================
-- Incremento 3 · Etapa 1 — RLS y permisos
--
-- Tres capas, de fuera hacia dentro:
--   1. `privado` no se expone en la API  → PostgREST ni siquiera lo ve.
--   2. Se revocan los permisos de los roles anónimo y autenticado sobre él.
--   3. RLS activo y SIN políticas en las tablas crudas → deny by default.
--
-- Con eso, la única puerta a los datos son las vistas de agregación y las
-- funciones SECURITY DEFINER de `public`, que devuelven exactamente lo que se
-- decidió publicar.
-- ============================================================================

-- ─── 1 y 2. El esquema privado no se toca desde la API ──────────────────────

revoke all on schema privado from public, anon, authenticated;
revoke all on all tables in schema privado from public, anon, authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;
revoke all on all sequences in schema privado from public, anon, authenticated;

alter default privileges in schema privado
    revoke all on tables from public, anon, authenticated;
alter default privileges in schema privado
    revoke all on functions from public, anon, authenticated;

alter table privado.reportes enable row level security;

alter table public.colonias enable row level security;

create policy colonias_lectura_publica
    on public.colonias
    for select
    to anon, authenticated
    using (true);

revoke insert, update, delete on public.colonias from anon, authenticated;
grant select on public.colonias to anon, authenticated;
