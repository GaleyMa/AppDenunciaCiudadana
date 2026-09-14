-- Simula el entorno de Supabase en un Postgres pelón:
--  · PostGIS instalado en el esquema `extensions` (como lo hace Supabase)
--  · los roles anon / authenticated / service_role
--  · el esquema auth con auth.uid()
drop extension if exists postgis cascade;
create schema if not exists extensions;
create extension postgis with schema extensions;

do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public to anon, authenticated;

create schema if not exists storage;

create table if not exists storage.buckets (
    id text primary key,
    name text,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
);

create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    created_at timestamptz default now()
);

alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
