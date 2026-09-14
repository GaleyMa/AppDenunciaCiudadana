-- ============================================================================
-- Pruebas del backend (Incremento 3 · Etapa 1)
--
-- Se ejecutan contra un Postgres con PostGIS levantado con supabase/pruebas/correr.sh.
-- NO apuntar esto a la base de Supabase: crea datos y un esquema `pruebas`.
-- ============================================================================

create schema pruebas;
create table pruebas.resultados (n serial, ok boolean, etiqueta text);
create function pruebas.chk(cond boolean, etiqueta text) returns void language plpgsql as $f$
begin insert into pruebas.resultados (ok, etiqueta) values (coalesce(cond,false), etiqueta); end $f$;
grant usage on schema pruebas to anon, authenticated;
grant insert on pruebas.resultados to anon, authenticated;
grant usage on sequence pruebas.resultados_n_seq to anon, authenticated;
grant execute on function pruebas.chk(boolean, text) to anon, authenticated;

-- Datos base
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'mod@ejemplo.mx'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'curioso@ejemplo.mx');
insert into privado.moderadores (user_id, nombre) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Moderadora');

-- ══ 1. El esquema privado es inalcanzable para anon ══
do $$ declare v boolean; begin
  begin set local role anon; perform 1 from privado.reportes limit 1; v := false;
  exception when insufficient_privilege then v := true; end;
  reset role; perform pruebas.chk(v, 'anon NO puede leer privado.reportes');
end $$;

do $$ declare v boolean; begin
  begin set local role anon; perform 1 from privado.moderadores limit 1; v := false;
  exception when insufficient_privilege then v := true; end;
  reset role; perform pruebas.chk(v, 'anon NO puede leer privado.moderadores');
end $$;

do $$ declare v boolean; begin
  begin set local role authenticated; perform 1 from privado.reportes limit 1; v := false;
  exception when insufficient_privilege then v := true; end;
  reset role; perform pruebas.chk(v, 'una cuenta con sesion tampoco lee la tabla cruda');
end $$;

-- ══ 2. Captura anónima ══
do $$ declare v_ret uuid; v_col integer; begin
  select id into v_col from public.colonias where nombre = 'Nueva';
  set local role anon;
  v_ret := public.crear_reporte('11111111-1111-4111-8111-111111111111','bache',v_col,'Calle Merida 120',32.6245,-115.4523,now() - interval '2 days');
  perform public.crear_reporte('22222222-2222-4222-8222-222222222222','basura',v_col,'Av. Colon',null,null,now() - interval '3 days');
  perform public.crear_reporte('33333333-3333-4333-8333-333333333333','bache',v_col,'Calle Merida 122',32.6246,-115.4524,now() - interval '1 day');
  perform public.crear_reporte('44444444-4444-4444-8444-444444444444','punto-riesgo',v_col,'Baldio',null,null,now());
  reset role;
  perform pruebas.chk(v_ret = '11111111-1111-4111-8111-111111111111', 'anon puede crear reporte y recibe el id que envio');
  perform pruebas.chk((select count(*) from privado.reportes) = 4, 'los 4 reportes quedaron guardados');
  perform pruebas.chk((select estado from privado.reportes where id='11111111-1111-4111-8111-111111111111') = 'pendiente', 'nacen en estado pendiente');
  perform pruebas.chk((select coordenadas is not null from privado.reportes where id='11111111-1111-4111-8111-111111111111'), 'las coordenadas si se guardan del lado servidor');
end $$;

do $$ begin
  set local role anon;
  perform public.crear_reporte('11111111-1111-4111-8111-111111111111','otro',null,'reintento',null,null,null);
  reset role;
  perform pruebas.chk((select count(*) from privado.reportes) = 4, 'reintentar con el mismo id NO duplica (cola offline segura)');
  perform pruebas.chk((select categoria from privado.reportes where id='11111111-1111-4111-8111-111111111111') = 'bache', 'el reintento no pisa los datos originales');
end $$;

-- ══ 3. Anonimato estructural: nada de coordenadas ni texto libre en lo público ══
do $$ declare v integer; begin
  -- Nada de lo publico puede traer la ubicacion exacta ni el texto libre.
  -- `geom` solo se admite en los dos catalogos de geografia de la ciudad
  -- (colonias y codigos_postales), que son publicos a proposito y los necesita
  -- el mapa; en cualquier otra relacion seria una fuga.
  select count(*) into v from information_schema.columns
   where table_schema = 'public'
     and (column_name ilike '%coordenad%'
          or column_name in ('ubicacion_texto','lat','lon','latitud','longitud','geografia')
          or (column_name = 'geom' and table_name not in ('colonias','codigos_postales')));
  perform pruebas.chk(v = 0, 'ninguna vista/tabla publica expone coordenadas ni texto libre');
end $$;

do $$ declare v integer; begin
  select count(*) into v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and 'coordenadas' = any(coalesce(p.proargnames, '{}'));
  perform pruebas.chk(v = 0, 'ninguna funcion publica devuelve la columna coordenadas');
end $$;

do $$ declare v boolean; begin
  begin set local role anon; perform 1 from public.estadisticas_por_colonia limit 1; v := true;
  exception when others then v := false; end;
  reset role; perform pruebas.chk(v, 'anon SI puede leer los agregados');
end $$;

-- ══ 4. Moderación: hace falta sesión y alta de moderador ══
do $$ declare v boolean; begin
  begin set local role anon; perform public.validar_reporte('11111111-1111-4111-8111-111111111111'); v := false;
  exception when insufficient_privilege then v := true; end;
  reset role; perform pruebas.chk(v, 'anon NO puede ejecutar validar_reporte');
end $$;

do $$ declare v text; begin
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = '';
    perform public.validar_reporte('11111111-1111-4111-8111-111111111111'); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%sesion%' or v like '%sesión%', 'sin sesion se rechaza: ' || v);
end $$;

do $$ declare v text; begin
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
    perform public.validar_reporte('11111111-1111-4111-8111-111111111111'); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%permisos de moderaci%', 'cuenta con sesion pero sin alta de moderador se rechaza');
end $$;

-- ══ 5. Acciones del moderador ══
do $$ declare v_cols text; begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
  perform pruebas.chk((select count(*) from public.listar_pendientes()) = 4, 'el moderador ve los 4 pendientes');
  perform public.validar_reporte('11111111-1111-4111-8111-111111111111');
  perform public.descartar_reporte('22222222-2222-4222-8222-222222222222','spam');
  perform public.fusionar_reporte('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
  perform pruebas.chk((select count(*) from public.listar_pendientes()) = 1, 'tras moderar queda 1 pendiente');
  reset role;
  perform pruebas.chk((select estado from privado.reportes where id='11111111-1111-4111-8111-111111111111') = 'validado', 'validar deja estado validado');
  perform pruebas.chk((select estado::text || '/' || motivo::text from privado.reportes where id='22222222-2222-4222-8222-222222222222') = 'descartado/spam', 'descartar guarda estado y motivo');
  perform pruebas.chk((select estado::text || '/' || ref_original::text from privado.reportes where id='33333333-3333-4333-8333-333333333333') = 'fusionado/11111111-1111-4111-8111-111111111111', 'fusionar guarda estado y ref_original');
end $$;

do $$ declare v text; begin
  set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin perform public.descartar_reporte('44444444-4444-4444-8444-444444444444', null); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%exige un motivo%', 'descartar sin motivo se rechaza: ' || v);
end $$;

do $$ declare v text; begin
  set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin perform public.fusionar_reporte('44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444'); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%si mismo%' or v like '%sí mismo%', 'no se puede fusionar consigo mismo');
end $$;

do $$ declare v text; begin
  set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin perform public.fusionar_reporte('44444444-4444-4444-8444-444444444444','99999999-9999-4999-8999-999999999999'); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%original no existe%', 'no se puede fusionar contra un id inexistente');
end $$;

do $$ declare v text; begin
  set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin perform public.fusionar_reporte('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222'); v := 'no fallo';
  exception when others then v := sqlerrm; end;
  reset role; perform pruebas.chk(v like '%pendiente o validado%', 'no se puede fusionar contra un descartado (sin cadenas A->B->C)');
end $$;

-- ══ 6. Reglas de integridad en la propia tabla ══
do $$ declare v boolean; begin
  begin insert into privado.reportes (id, categoria, estado) values (gen_random_uuid(), 'bache', 'descartado'); v := false;
  exception when check_violation then v := true; end;
  perform pruebas.chk(v, 'la tabla rechaza un descartado sin motivo aunque se inserte directo');
end $$;

do $$ declare v boolean; begin
  begin insert into privado.reportes (id, categoria, estado) values (gen_random_uuid(), 'bache', 'fusionado'); v := false;
  exception when check_violation then v := true; end;
  perform pruebas.chk(v, 'la tabla rechaza un fusionado sin ref_original');
end $$;

-- ══ 7. Agregados del tablero ══
do $$ declare v_col integer; begin
  select id into v_col from public.colonias where nombre = 'Nueva';
  perform pruebas.chk((select validados from public.estadisticas_por_colonia where colonia_id = v_col) = 1,
    'estadisticas_por_colonia cuenta solo validados (1 de 4)');
  perform pruebas.chk((select count(*) from public.estadisticas_por_categoria) = 1, 'estadisticas_por_categoria solo trae la categoria validada');
  perform pruebas.chk((select validados from public.resumen_general) = 1, 'resumen_general cuenta 1 validado');
  perform pruebas.chk((select categoria_mas_reportada from public.resumen_general)::text = 'bache', 'resumen_general identifica la categoria mas reportada');
  perform pruebas.chk((select colonias_afectadas from public.resumen_general) = 1, 'resumen_general cuenta las colonias afectadas');
  perform pruebas.chk((select fusionados from public.duplicados_por_colonia where colonia_id = v_col) = 1, 'duplicados_por_colonia cuenta el reporte fusionado');
  perform pruebas.chk((select count(*) from public.serie_semanal) >= 1, 'serie_semanal agrupa por semana');
  perform pruebas.chk((select colonia from public.top_colonias limit 1) = 'Nueva', 'top_colonias encabeza con la colonia con mas reportes');
end $$;

-- ══ 8. Catálogo de colonias ══
do $$ declare v boolean; begin
  perform pruebas.chk((select count(*) from public.colonias) = 37, 'la semilla cargo las 37 colonias');
  begin set local role anon; insert into public.colonias (nombre) values ('Colonia Pirata'); v := false;
  exception when others then v := true; end;
  reset role; perform pruebas.chk(v, 'anon NO puede escribir en el catalogo de colonias');
end $$;


-- ══ 9. Códigos postales y derivación server-side ══
do $$ begin
  perform pruebas.chk((select count(*) from public.codigos_postales) = 231, 'se cargaron los 231 poligonos de CP');
end $$;

do $$ declare v integer; begin
  -- El reporte 1 se creo con coordenadas del centro de Mexicali.
  select codigo_postal into v from privado.reportes where id = '11111111-1111-4111-8111-111111111111';
  perform pruebas.chk(v is not null and v between 21000 and 21999, 'el servidor derivo el CP desde las coordenadas: ' || coalesce(v::text,'NULO'));
end $$;

do $$ declare v integer; begin
  select codigo_postal into v from privado.reportes where id = '22222222-2222-4222-8222-222222222222';
  perform pruebas.chk(v is null, 'un reporte sin coordenadas queda sin CP (contara en tablas, no en el mapa)');
end $$;

do $$ declare v_id uuid := gen_random_uuid(); v integer; begin
  -- Punto en medio del mar de Cortes: no cae en ningun CP ni cerca.
  set local role anon;
  perform public.crear_reporte(v_id, 'otro', null, 'fuera del area', 28.0, -112.0, null);
  reset role;
  select codigo_postal into v from privado.reportes where id = v_id;
  perform pruebas.chk(v is null, 'un punto fuera de Mexicali no recibe CP inventado');
  delete from privado.reportes where id = v_id;
end $$;

do $$ declare v boolean; begin
  begin set local role anon; perform 1 from public.estadisticas_por_cp limit 1; v := true;
  exception when others then v := false; end;
  reset role; perform pruebas.chk(v, 'anon puede leer el agregado por CP');
end $$;

do $$ declare v_cp integer; begin
  select codigo_postal into v_cp from privado.reportes where id = '11111111-1111-4111-8111-111111111111';
  perform pruebas.chk((select validados from public.estadisticas_por_cp where codigo_postal = v_cp) = 1,
    'estadisticas_por_cp cuenta el reporte validado en su CP');
  perform pruebas.chk((select count(*) from public.estadisticas_por_cp) = 231,
    'el agregado por CP devuelve todos los poligonos, tambien los que van en cero');
end $$;

do $$ declare v integer; begin
  select count(*) into v from information_schema.columns
   where table_schema = 'public' and table_name = 'estadisticas_por_cp'
     and column_name ilike '%coordenad%';
  perform pruebas.chk(v = 0, 'el agregado por CP no arrastra coordenadas');
end $$;

select case when ok then 'PASS' else 'FALLO' end as r, etiqueta from pruebas.resultados order by n;
select count(*) filter (where ok) || ' pasadas, ' || count(*) filter (where not ok) || ' fallidas' as resumen from pruebas.resultados;
