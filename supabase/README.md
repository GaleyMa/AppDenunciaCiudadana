# Backend — Incremento 3, Etapa 1

Base de datos del tablero público. Todo lo de esta carpeta es SQL: no hay
servidor propio que mantener.

## Idea central: anonimato estructural

Los datos crudos **no viven en un esquema expuesto por la API**. Supabase publica
únicamente los esquemas configurados (por omisión `public`), así que la tabla
`privado.reportes` es inalcanzable con la anon key aunque alguien conozca la URL
del proyecto y la llave. Hacia afuera solo hay:

| Quién | Qué puede hacer |
|---|---|
| Anónimo (la PWA) | Llamar a `crear_reporte(...)` — escribe, no lee — y leer las vistas de agregación (conteos, nunca filas individuales). |
| Moderador con sesión | Listar pendientes y validar / descartar / fusionar, vía funciones que verifican su alta. |
| Nadie por la API | Leer `privado.reportes`, y en particular las **coordenadas**. |

Tres capas defienden lo mismo: el esquema no expuesto, los permisos revocados a
`anon` y `authenticated`, y RLS activo sin políticas (deny by default). Además,
la tabla **no tiene columna de autor**: no hay `user_id`, correo, IP ni user
agent. No es que se oculten — no se recogen.

Las coordenadas se guardan porque el servidor las necesita (asignar colonia,
mapas de calor agregados a futuro) pero no salen en ninguna vista ni en el
retorno de ninguna función, ni siquiera para un moderador.

## Puesta en marcha

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
   Guarda la contraseña de la base.
2. Ve a **SQL Editor** y ejecuta los archivos de `migrations/` **en orden por
   nombre**, uno por uno:

   | Archivo | Qué hace |
   |---|---|
   | `…_esquema.sql` | Esquema `privado`, tipos, tablas `colonias` y `reportes`, índices |
   | `…_rls_y_permisos.sql` | Revocaciones y RLS |
   | `…_api_publica.sql` | `crear_reporte()` y las vistas de agregación |
   | `…_moderacion.sql` | Tabla de moderadores y las acciones autenticadas |
   | `…_semilla_colonias.sql` | Las 37 colonias del catálogo del cliente |
   | `…_cp_1_tabla.sql` | Tabla de códigos postales |
   | `…_cp_2_datos_1_de_6.sql` … `…_cp_7_datos_6_de_6.sql` | Los 231 polígonos, en 6 partes |
   | `…_cp_8_funciones.sql` | Derivación del CP y vista del mapa |
   | `…_listar_moderables.sql` | Candidatos de fusión para el panel (incluye validados) |

   > Los polígonos van partidos en seis archivos a propósito: el SQL Editor
   > rechaza peticiones grandes con **"Request Entity Too Large"**, y el archivo
   > completo pesaba 300 KB. Cada parte ronda los 35 KB. Ejecútalas en orden;
   > la de funciones va al final porque necesita la tabla ya cargada.
   >
   > Si prefieres una sola pasada, con el CLI: `supabase link --project-ref
   > <ref>` y `supabase db push` aplican todo junto (pide la contraseña de la
   > base, la que definiste al crear el proyecto).

3. **Comprueba que `privado` NO esté expuesto**: Settings → API → *Exposed
   schemas* debe decir `public, graphql_public`. Si aparece `privado`, quítalo:
   ahí se cae todo el anonimato.
4. Copia **Project URL** y **anon public key** (Settings → API). Se usan en la
   Etapa 2.

Con el CLI de Supabase, en vez del paso 2: `supabase link` y `supabase db push`,
que toma los mismos archivos de `migrations/`.

## Por qué el mapa es por código postal

El coroplético agrupa por **código postal**, no por colonia: el GeoJSON público
disponible (`open-mexico/mexico-geojson`) trae polígonos de CP, y no existe un
GeoJSON abierto de colonias de Mexicali. La colonia sigue siendo la unidad de
las tablas y del top 5, que salen del catálogo del formulario.

El CP lo calcula **el servidor** a partir de las coordenadas del reporte
(`privado.cp_de_punto`). No se acepta el CP que mande el cliente: sería trivial
sesgar el mapa. Las coordenadas siguen sin exponerse — el CP es su versión
agregada, y convertir un punto exacto en un área es parte de la anonimización.

Un reporte sin coordenadas (el ciudadano negó el permiso de ubicación) se queda
sin CP: cuenta en las tablas por colonia, pero no aparece en el mapa.

Los polígonos vienen simplificados a ~22 m con Douglas-Peucker. Como las
fronteras ya no encajan al milímetro, si un punto cae en una rendija entre dos
polígonos se le asigna el CP más cercano dentro de 1 km; más lejos, se deja
nulo.

## Dar de alta un moderador

1. Authentication → Users → **Add user** (correo y contraseña).
2. Copia su UUID y en el SQL Editor:

   ```sql
   insert into privado.moderadores (user_id, nombre)
   values ('<uuid-del-usuario>', 'Nombre');
   ```

Sin ese renglón, la cuenta inicia sesión pero **no puede moderar**: las funciones
lo verifican.

Esto sustituye a la URL secreta del Incremento 2 como control real. El token de
la URL se conserva únicamente para que el panel no sea descubrible por curiosear
la app; quien llegue a esa ruta se topa con la pantalla de acceso, y sin sesión
válida el servidor no devuelve ni un reporte. Dicho de otro modo: la URL oculta,
el login protege.

## API que consumirá el cliente (Etapa 2)

```js
// Alta de un reporte (anónimo). El id es el que ya genera ReporteStore.
await supabase.rpc('crear_reporte', {
  p_id: reporte.id, p_categoria: reporte.categoria, p_colonia_id: coloniaId,
  p_ubicacion_texto: reporte.ubicacion, p_lat: lat, p_lon: lon, p_fecha: reporte.fecha,
});

// Tablero
await supabase.from('resumen_general').select('*');
await supabase.from('estadisticas_por_colonia').select('*');
await supabase.from('estadisticas_por_categoria').select('*');
await supabase.from('top_colonias').select('*');
await supabase.from('serie_semanal').select('*');
await supabase.from('duplicados_por_colonia').select('*');

// Moderación (con sesión iniciada)
await supabase.rpc('listar_pendientes', { p_limite: 50 });
await supabase.rpc('validar_reporte',  { p_id });
await supabase.rpc('descartar_reporte', { p_id, p_motivo: 'spam' });
await supabase.rpc('fusionar_reporte',  { p_id, p_ref_original });
```

`crear_reporte` es **idempotente por id**: reintentar el envío de la cola
offline no duplica reportes.

## Pruebas

```bash
./supabase/pruebas/correr.sh     # necesita podman o docker
```

Levanta un Postgres con PostGIS, simula el entorno de Supabase (roles `anon` /
`authenticated`, esquema `auth`), aplica las migraciones y corre **44
comprobaciones**: que `anon` no pueda leer la tabla cruda, que la captura anónima
funcione y sea idempotente, que ninguna vista exponga coordenadas, que moderar
exija sesión **y** alta de moderador, que descartar exija motivo, que no se
puedan encadenar fusiones, y que los agregados cuenten solo reportes validados.

## Pendientes conocidos

- **Polígonos de colonias.** `colonias.geom` sigue vacío: el mapa usa códigos
  postales justamente porque no hay GeoJSON abierto de colonias. Si consigues
  el del Ayuntamiento o INEGI, el coroplético puede pasar a colonia. El catálogo
  de 37 nombres también sigue sin contrastar.
- **Abuso en la captura anónima.** Hoy cualquiera con la anon key puede insertar
  reportes en volumen. Falta limitar por IP con una Edge Function o un captcha;
  no se resuelve con RLS.
- **Fotos.** `foto_ruta` está previsto pero Storage no se configura todavía. El
  bucket debe ser privado: una foto puede traer rostros, placas o EXIF con
  ubicación.
- **Vistas SECURITY DEFINER.** El linter de Supabase las marca. Aquí es
  intencional: es el mecanismo que permite agregar sin exponer la tabla.
