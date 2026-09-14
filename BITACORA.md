# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 1

Herramienta: Continue + Qwen2.5-Coder 7B (local vía Ollama)
Fecha: 1 de septiembre de 2026
Historia implementada:HT-01 — ReporteForm (formulario de captura de reportes)


## PROMPTS UTILIZADOS

### Prompt 1:  Esqueleto base de la PWA

"Estoy empezando una PWA con vanilla JS, HTML y CSS (sin frameworks). Ayúdame a crear la estructura base: 1. Un index.html mínimo y semántico, con un `<main>` vacío donde luego irá  el contenido, que enlace style.css y app.js, y que incluya el link al manifest.json y la meta theme-color. 2. Un manifest.json básico para una app llamada "Denuncia Ciudadana" (short_name, start_url, display standalone, background y theme color). Dime qué íconos y tamaños necesito y cómo referenciarlos, pero no inventes rutas a archivos que no existen.
 3. El código en app.js para registrar el service-worker, envuelto en la  comprobación de que el navegador lo soporte. Explícame qué hace cada parte, no solo me des el código.

**Resultado:** Generó `index.html`, `manifest.json` y
el registro del service worker en `app.js`. El registro vino más completo de lo pedido (envuelto en la comprobación de soporte y en el evento `load`). Quedaron dos pendientes: el manifest referenciaba íconos que aún no existían, y el archivo `service-worker.js` estaba por crear (`app.js` lo registraba pero no existía aún).

### Prompt 2 — Service worker mínimo

"Necesito un service-worker.js mínimo para mi PWA de reportes ciudadanos vanilla JS, sin frameworks). Requisitos:
- En el evento 'install': cachear el app shell (index.html, style.css,app.js, manifest.json).
- En el evento 'activate': eliminar cachés antiguos que no coincidan con
la versión actual.
- En el evento 'fetch': estrategia cache-first (responder desde caché, y
si no está, ir a la red).
- Usa una constante con el nombre y versión del caché (ej. 'denuncia-v1')
para poder invalidarlo después.

**Resultado:** Generó un `service-worker.js` con los tres eventos del ciclo de vida (install cachea el app shell, activate limpia cachés viejos, fetch responde
cache-first) y una constante de versión (`denuncia-v1`). Al probar, el service worker se registró con éxito.

### Prompt 3 — Formulario ReporteForm (HT-01)

Necesito un formulario de captura de reportes para una PWA de denuncia ciudadana. HTML y CSS vanilla, sin frameworks, usando Flexbox. Debe ser  mobile-first (flujo vertical de una sola columna, sin pasos multipágina).

El formulario (con id "reporte-form") lleva:
- Foto: `<input type="file" accept="image/*">` con id "reporte-foto" (obligatorio)
- Ubicación: un `<input type="text">` con id "reporte-ubicacion" (obligatorio, placeholder por ahora; la captura GPS real es otra historia)
- Categoría: un `<select>` con id "reporte-categoria" y opciones: bache, alumbrado, basura, fuga de agua, otro (obligatorio)
- Botón "Enviar" con id "btn-enviar"

Comportamiento en app.js (vanilla JS):
- Al enviar, prevenir la recarga de la página.
- Si algún campo obligatorio está vacío, mostrar un mensaje de error visible y NO continuar. 
- Si todo está lleno, por ahora solo hacer console.log con los tres datos (foto, ubicación, categoría). El guardado real es otra historia.

Restricciones importantes: NO pedir datos personales ni credenciales (la app es anónima).


**Resultado:** Cumplió los **dos criterios de aceptación**: dispara la creación
del reporte con los tres datos (vía `console.log`) y bloquea el envío mostrando
error si falta un campo. Dos detalles a corregir: (a) el mensaje de error salía
como `alert()` del navegador, no visible dentro de la interfaz; y (b) los campos
tenían `required` en HTML *además* de la validación en JS, por lo que el navegador
mostraba su propio mensaje antes de que corriera mi código.


## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

El `index.html` quedó semántico y respetó los IDs que pedí. La validación en JS
chequeó los tres campos —incluida la foto, que es fácil de olvidar—. Respetó los
límites con otras historias: usó `console.log` en vez de guardar, y dejó la
ubicación como placeholder. El registro del service worker vino más completo de
lo que pedí.

**¿Qué aprendiste sobre prompt engineering?**

Que anticipar los errores dentro del prompt ahorra correcciones después: al pedir explícitamente los campos del manifest, el `if` de soporte del service worker, y frenar rutas de íconos inventadas, el resultado vino casi limpio. Un prompt específico produce mejor código que uno genérico.



## MODIFICACIONES MANUALES

1. Rutas de íconos en el manifest: Agregué la ruta real de la carpeta de
imágenes, donde guardé archivos temporales de íconos de 192x192 y 512x512, para
que el manifest no apuntara a archivos inexistentes.

2. Validación controlada por JS (refinamiento de HT-01).Reemplacé la validación nativa por una controlada desde mi propio código:
- Quité el atributo `required` de los tres campos en el HTML.
- Agregué un elemento `<p id="error-msg"></p>` para mostrar el error dentro de
  la interfaz.
- En `app.js`, cambié el `alert()` por escribir el mensaje en `#error-msg` con
  `.textContent`, y agregué una línea que limpia el mensaje cuando la validación
  ya pasa.

para tener control sobre la presentación del error y que la app no
dependa del mensaje del navegador



**TIEMPO TOTAL:** 3h 15m

**SATISFACCIÓN CON EL PROCESO (1-5):** 4

**JUSTIFICACIÓN:**

Las respuestas de la IA fueron bastante acertadas, y al pedirle que me explicara cada sección fui aprendiendo el porqué de las cosas en vez de solo copiar. Fue una experiencia muy grata. No le doy 5 porque tardaba muchisimo en generar las respuestas, 28 minutos de una sola fue una exageracion. Fuera de eso siento que aprendi mucho acerca de como sacarle mejor provecho a los prompt.





# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 2

Herramienta: Claude Code (Claude Opus 5) dentro de VS Code
Fecha: 6 de septiembre de 2026
Historias implementadas: HT-02 — ReporteStore (persistencia en IndexedDB),
cierre de HT-01 (conectar el formulario al guardado) y preparación del
Incremento 2.


## PROMPTS UTILIZADOS

### Prompt 1 — Contexto del proyecto y corrección de tres bugs del ReporteStore

"Estoy terminando el Incremento 2 de una PWA de denuncias ciudadanas. Antes de construir el Incremento 2 (ValidacionPanel + GestorValidacion), hay que corregir dos bugs en ReporteStore.js que ya detecté:
1. Falta el índice `estado`. `getReportsByState` usa `objectStore.index('estado')`
   pero ese índice nunca se crea en `onupgradeneeded`. Hay que crearlo y subir
   DATABASE_VERSION a 2 para que corra la migración.
2. Race condition al abrir la base. Está generando con autoIncrement (números secuenciales que
revelan el orden de los reportes). Cámbialo a `crypto.randomUUID(). Es requisito de anonimato del proyecto.
Muéstrame el plan antes de editar. No construyas el panel todavía 

**Resultado:** Antes de escribir código leyó el contexto y todo el proyecto, y
devolvió el plan pedido. Encontró tres cosas que yo no había visto:

- **El formulario no estaba conectado en realidad.** `ReporteForm.js` importaba
  `'../store/ReporteStore.js'`, una ruta que no existía (los dos archivos estaban
  en la raíz), y el `index.html` cargaba `app.js` como script clásico, no como
  módulo. Lo que corría era el `console.log` de la sesión 1: **no se guardaba
  nada en IndexedDB**.
- **IndexedDB no permite cambiar `keyPath` ni `autoIncrement`** de un object
  store que ya existe. Para pasar del id numérico al UUID no basta con subir la
  versión: la migración tiene que borrar y recrear el store (y con él los datos
  de prueba de la v1).
- **La foto se guardaba como `ArrayBuffer`** por un `FileReader` innecesario. Un
  `File` ya es un `Blob`, y con `ArrayBuffer` la miniatura del ValidacionPanel no
  iba a poder generarse con `URL.createObjectURL`.

Propuso además dos funciones que faltaban para el Incremento 2: `getAllReports()`
y un `updateReport(id, cambios)` genérico, porque descartar necesita guardar
estado + motivo y fusionar estado + refOriginal en una sola transacción.

### Prompt 2 — Aprobación del plan

"sAplica los cambios Antes mencionados"

**Resultado:** Creó `src/reportes/store/` y `src/reportes/form/`, movió los
módulos y reescribió el cableado completo:

- `app.js` quedó como punto de entrada: registra el service worker, crea una sola
  instancia del store y se la pasa al formulario. Eliminó el listener duplicado
  que hacía `console.log`.
- `ReporteForm.js` ahora recibe el store por parámetro (inyección de dependencia),
  guarda la foto como Blob y muestra la confirmación en la interfaz.
- `index.html` carga `app.js` con `type="module"`.
- `service-worker.js` subió a `denuncia-v3` y agregó los módulos ES6 al caché:
  el navegador los pide por separado, sin ellos la app no abre offline.
- Encontró que `manifest.json` seguía roto (`start_url: "/img"` e íconos
  apuntando a `icon-192x192.png`, que no existe) pese a que en la bitácora de la
  sesión 1 yo lo había dado por corregido.

Lo más útil: **probó todo en un Firefox headless**, no solo revisó el código.
La suite del store pasó 11 de 11 y la del formulario 13 de 13 (submit vacío,
guardado real, campos que quedan en IndexedDB, y que ninguno identifique al
autor). Dejó la suite como `pruebas/ReporteStore.prueba.html` para volver a
correrla.

### Prompt 3 — Colonias de Mexicali, diseño y categorías de inseguridad

"En ubicación puedes poner un listado de colonias de Mexicali, Baja California, que la persona sea capaz de escribir y aparezcan las opciones de colonias que hacen match con lo que va escribiendo. Además, agrégale un poco de diseño a la
página del formulario, un título 'Denuncia Ciudadana Mexicali, B.C.', 'Por un
mejor Mexicali' o algo donde explique un poco de qué es esta página. También estaría bien expandir un poco más las categorías, unas dos más relacionadas con
inseguridad."

**Resultado:** Hizo el autocompletado sin librerías y sin `<datalist>` (explicó
que su apariencia cambia mucho entre navegadores móviles). Ignora acentos y
mayúsculas, prioriza las colonias que empiezan con lo escrito, limita a 8
sugerencias, se navega con flechas / Enter / Escape y lleva atributos ARIA de
combobox. El campo sigue aceptando texto libre, para poder escribir una calle o
un cruce que no esté en el catálogo. Las 37 colonias quedaron aisladas en
`src/reportes/datos/colonias-mexicali.js` para poder editarlas sin tocar el
formulario.

Rediseñó la portada (encabezado, lema, tarjeta de "¿Qué es esto?") y agregó las
categorías **vandalismo** y **punto de riesgo**. Por su cuenta añadió un aviso de
que la app no sustituye al 911, argumentando que con categorías de inseguridad
alguien podría esperar una respuesta de emergencia que la app no puede dar; me
avisó que lo había agregado sin que yo lo pidiera, por si lo quería quitar.
Las pruebas de interfaz pasaron 16 de 16.

Fue honesto con una limitación importante: **la lista de colonias la escribió de
memoria, no de una fuente oficial**, y me dijo explícitamente que hay que
contrastarla con el directorio del Ayuntamiento de Mexicali o el marco
geoestadístico del INEGI antes de entregar.


## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

Que las pruebas fueran ejecución real y no revisión de código. Corriendo el proyecto en un navegador headless salió un bug que ninguna lectura del código habría mostrado: al borrar la base desde DevTools con la app abierta l flujo que la propia IA me había recomendado para probar el manejador.  También funcionó que respetara el alcance. Le pedí explícitamente que no construyera el ValidacionPanel todavía y no lo hizo, aunque ya tenía todo el contexto para hacerlo; se limitó a dejar el store con las funciones que ese panel va a necesitar.

**¿Qué aprendiste sobre prompt engineering?**

Que dar el archivo de contexto completo al inicio cambia la calidad de las respuestas: no tuve que repetir la filosofía técnica (vanilla, cero librerías, offline-first, anonimato) en cada prompt, y las decisiones venían ya alineadas con ella.

Que pedir el plan antes del código es lo que más ahorra trabajo. Ahí fue donde aparecieron los tres hallazgos que yo no tenía en el radar, incluido que mi formulario no guardaba nada. Si hubiera pedido "arregla estos dos bugs" a secas, habría tardado mas y causado mas problemas.

Y que conviene desconfiar de mi propia bitácora: yo había registrado como corregidas las rutas de los íconos del manifest y no lo estaban. Vale más verificar el archivo que confiar en la nota.


## MODIFICACIONES MANUALES

En esta sesión no hice modificaciones manuales al código: todo se hizo desde Claude Code y quedó verificado en el navegador. Lo que sí quedó pendiente de mi lado:

Validar la lista de colonias de colonias-mexicali.js contra una fuente oficial (Ayuntamiento de Mexicali / INEGI) y completarla.

Antes de cada prueba: borrar la base en DevTools (Application, IndexedDB , denuncia_ciudadana, Delete database).


**TIEMPO TOTAL:** Aprox. 1h 20m de trabajo con la herramienta

**SATISFACCIÓN CON EL PROCESO (1-5):** 5

**JUSTIFICACIÓN:**  Al cambiar de Un agente local a uno en la nube, se aprecio no solo una mejora en tiempo de respuesta, si no en la calidad de los resultados. La explicación que solicito antes de aplicar cambios son precisamente para poder identificar hasta que punto sigue mis instrucciones, en donde comienza a separarse del concepto principal de la aplicación, En este caso no sentí divergencia alguna. El flujo de trabajo fue mejor, entendi mas y sentí que el avance fué bueno.



---

# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 3

Herramienta: Claude Code (Claude Opus 5) dentro de VS Code
Fecha: 7 de septiembre de 2026
Historias implementadas: HT-03 — ValidacionPanel y HT-04 — GestorValidacion
(Incremento 2 completo), más la corrección del service worker.


## PROMPTS UTILIZADOS

### Prompt 1 

"Pasemos al Incremento 2 con ValidacionPanel y GestorValidacion. El panel lista los reportes pendientes leyendo por estado desde IndexedDB y muestra por cada uno la miniatura de la foto, la ubicación, la categoría y la fecha, nunca datos del autor. El acceso es por URL secreta con un token en el hash: si el token falta o es incorrecto, no se renderiza el panel ni se revela que existe. El gestor permite validar, descartar con motivo (duplicado/sin evidencia/spam) y fusionar guardando la referencia al id del reporte original."

**Resultado:** Separó las dos capas como pedía el proyecto: `GestorValidacion.js`
con la lógica (sin tocar el DOM) y `ValidacionPanel.js` con la interfaz (sin
reglas de negocio). El token quedó en `src/config.js` con el comentario de que
**esto no es seguridad real**, porque viaja en el código del cliente.

Decisiones que tomó y explicó:

- Para fusionar puso un `<select>` con los otros reportes (categoría, colonia, fecha e id corto) en vez de un campo para teclear el UUID a mano.
- Agregó tres reglas que yo no había pedido: no fusionar un reporte consigo mismo, no fusionar contra un id inexistente y no fusionar contra un reporte ya  descartado o fusionado. El argumento fue evitar cadenas A→B→C que romperían el conteo del tablero del Incremento 3.
- Pinta todo el texto del ciudadano con `textContent` y nunca con `innerHTML`, porque el panel es justo donde un moderador lee texto escrito por un desconocido. Dejó una prueba que mete `<img src=x onerror=...>` como ubicación y verifica que se muestre como texto.
- Creó `datos/categorias.js` como catálogo único: antes las categorías estaban escritas a mano en el HTML y ahora el formulario arma su `<select>` desde ahí y el panel saca de ahí las etiquetas, para que no se desincronicen.

Probó las 29 comprobaciones manejando el `index.html` real dentro de un iframe:
control de acceso con token ausente / falso / correcto, que solo se listen
pendientes, las tres acciones, el bloqueo del descarte sin motivo y las reglas del gestor. Quedó como `pruebas/ValidacionPanel.prueba.html`.

### Prompt 2 

"Subí los reportes, pero no aparecen en el panel de validación." (Después le pasé la salida del `console.table` que me pidió correr, y las dos URLs que estaba usando.)

**Resultado:** En vez de suponer, primero reprodujo mi flujo exacto —capturar por el formulario y luego abrir el panel— y le pasaron las 7 comprobaciones. Con eso descartó el código y buscó en el entorno. Encontró dos problemas distintos:

1. **El service worker envenenaba su propio caché.** Al diagnosticar dentro del navegador salió que el service worker nuevo estaba activo y ya había borrado l caché viejo, pero seguía sirviendo el `index.html` anterior. La causa:
   `cache.addAll()` pide los archivos pasando por el caché HTTP del navegador, así que la versión nueva se instalaba guardando copias viejas. Lo arregló con `new Request(ruta, { cache: 'reload' })`, más `skipWaiting()` y `clients.claim()` para que la actualización tome el control al recargar en vez de esperar a que se cierren todas las pestañas.

De paso admitió un error propio: la página `pruebas/ReporteStore.prueba.html` que había entregado en la sesión anterior decía "base de prueba" pero borraba la base real. La cambió para que use una base aparte
(`denuncia_ciudadana_pruebas`) y puso la suite del panel —que sí necesita la base real— detrás de un botón con aviso en rojo, para que no se ejecute sola al abrir la página. También agregó al panel vacío una línea que dice de qué origen está leyendo, para que ese síntoma se explique solo la próxima vez.


## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

La forma de depurar. Ante "no aparecen los reportes" no propuso arreglos a ciegas: reprodujo el flujo, comprobó que el código funcionaba, y solo entonces fue por el entorno, midiendo el estado real del service worker y de los cachés dentro del navegador. El resultado fue un bug de fondo que yo no habría encontrado y que además explicaba por qué sus propias pruebas nunca lo detectaban: corrían siempre en perfiles nuevos, con el caché vacío.

También funcionó que distinguiera entre el bug que yo creía tener y el que realmente tenía. La causa de mi problema era una tontería de origen(`127.0.0.1` contra `localhost`), y aun así el otro hallazgo valía por sí solo.

**¿Qué aprendiste sobre prompt engineering?**

Que describir el síntoma tal cual, sin diagnosticarlo yo, da mejor resultado que pedir un arreglo concreto. Escribí "subí los reportes y no aparecen" y eso dejó espacio para investigar; si hubiera escrito "arregla la consulta por estado", se habría ido a corregir código que estaba bien.

Y que conviene pedir la evidencia de la prueba, no la afirmación de que algo funciona. Cuando pedí que probara, ejecutó la app en un navegador y reportó las comprobaciones una por una; ahí fue donde salieron cosas reales, incluida una prueba mal escrita por él mismo (una expresión regular de fecha que asumía hora de dos dígitos) que corrigió señalando que el fallo era de la prueba y no del código.


## MODIFICACIONES MANUALES

En esta sesión tampoco modifiqué código a mano. Pendientes de mi lado:

1. Usar **un solo host** al probar (`127.0.0.1` o `localhost`, no ambos): cada
   uno tiene su propia base, su propio service worker y su propio caché.
2. Validar la lista de colonias contra una fuente oficial (sigue pendiente de la
   sesión anterior).
3. Fusionar las ramas de trabajo en `main`.


**TIEMPO TOTAL:** 1hr

**SATISFACCIÓN CON EL PROCESO (1-5):**5_

**JUSTIFICACIÓN:** Todo salio bine, los unicos errores fueron de  mi parte pero la ia me guio a cada momento para corregirlos.


---

# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 4

Herramienta: Claude Code (Claude Opus 5) dentro de VS Code
Fecha: 8 de septiembre de 2026
Historias implementadas: Incremento 3, etapa 1 — backend en Supabase (esquema, políticas RLS, agregación del lado servidor y anonimato estructural) y carga de los polígonos de códigos postales para el mapa.


## PROMPTS UTILIZADOS

### Prompt 1 

"Vamos a trabajar el Incremento 3 con todo y backend; no estaba fuera de alcance, solo no actualicé el documento del contexto. Consiste en crear el tablero público de estadísticas + mapa usando Supabase para backend. Vamos a hacerlo en dos etapas: la primera será el backend, con tablas de reportes con al menos id (uuid), categoría, colonia_id, coordenadas para uso interno del servidor (nunca expuestas), fecha con timestamp, estado (pendiente, descartado, fusionado, validado), agregación del lado servidor, políticas RLS y anonimato estructural.
La etapa 2 será enfocada en el cliente: tablas, mapas, widgets."

**Resultado:** Antes de diseñar hizo tres preguntas, porque cada respuesta
cambiaba el esquema: cómo llegan los reportes al servidor (elegí al capturar, con cola offline), dónde se modera (elegí en el servidor, con inicio de sesión) y qué tenía montado de Supabase (nada todavía).

La decisión de fondo fue no exponer los datos crudos: la tabla de reportes
vive en un esquema `privado` que la API de Supabase no publica, así que ni
conociendo la URL y la llave se puede leer. Hacia afuera solo quedan una función para crear reportes (escribe, no lee) y vistas con conteos. La tabla no tiene ninguna columna de autor, y las coordenadas no salen en ninguna vista ni para los moderadores.

Lo probó aplicando las migraciones en un Postgres real dentro de un contenedor, con 36 comprobaciones. En el camino encontró tres problemas propios:`force row level security` habría dejado las vistas de agregación siempre encero (lo vio al razonar el flujo, antes de correr nada)

### Prompt 2 

"Repo de GeoJSON: https://github.com/open-mexico/mexico-geojson (…) No puedo hacer
el archivo de códigos postales en Supabase: al intentar ponerle
20260908090000_codigos_postales.sql sale 'Request Entity Too Large'. Le cambié el nombre a codigo_postales.sql y no me deja tampoco. Este problema no sucedió con los archivos anteriores."

**Resultado:** El repositorio trae polígonos por código postal pero no por
colonia, y no existe un GeoJSON abierto de colonias de Mexicali; por eso el mapa es un coroplético **por código postal** y el servidor calcula el CP de cada reporte a partir de sus coordenadas.

El error no era el nombre del archivo: el SQL Editor rechaza peticiones grandes y ese archivo pesaba 301 KB. Lo partió en ocho archivos de ~35 KB que se ejecutanen orden, y de paso aligeró las geometrías de 291 KB a 200 KB. Verificó con el propio script de pruebas que los ocho aplicaran en orden y que siguieran pasando las 44 comprobaciones.

## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

Que el anonimato quedó en la estructura y no en la buena voluntad del cliente. Aunque alguien tenga la URL del proyecto y la llave pública, la tabla con coordenadas y texto libre no es alcanzable: hay tres barreras (esquema no expuesto, permisos revocados y RLS sin políticas). Y las pruebas en un Postgres real demostraron cada una en vez de solo afirmarlas.

**¿Qué aprendiste sobre prompt engineering?**

Que contestar sus preguntas antes de que escribiera código evitó rehacer el
esquema: la sincronización al capturar y la moderación en el servidor cambiaban qué funciones y qué permisos hacían falta. Y que describir el error tal cual ("sale Request Entity Too Large, con los anteriores no pasó") llevó directo a la causa, que no tenía nada que ver con el nombre del archivo que yo estaba cambiando.


## MODIFICACIONES MANUALES

1. Creé el proyecto en Supabase y apliqué a mano, en el SQL Editor y en orden, las migraciones del esquema, los permisos, la API pública, la moderación, la semilla de colonias y los ocho archivos de códigos postales.
2. Verifiqué la carga con `select count(*) from public.codigos_postales;` (231).


**TIEMPO TOTAL:** Aprox. 2hr 30 min

**SATISFACCIÓN CON EL PROCESO (1-5): 4

**JUSTIFICACIÓN:** En esta etapa tuve muchos erroes, no sabia usar nada de supabase y me guio muy bien para hacer todo. 



---

# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 5

Herramienta: Claude Code (Claude Opus 5) dentro de VS Code
Fecha: 8 de septiembre de 2026
Historias implementadas: Incremento 3, etapa 2 — captura con GPS, cola de
sincronización con el servidor, tablero público de estadísticas, moderación
contra el servidor con inicio de sesión y fotos en un bucket privado.


## PROMPTS UTILIZADOS

### Prompt 1 

"Ya terminé, el count dio 231." (Con eso arrancó la etapa 2: sincronización,
mapa y tablero.)

**Resultado:** Construyó tres piezas sin ninguna librería: un cliente REST propio de unas 60 líneas con `fetch` (en vez de los 40 KB de `supabase-js`), un botón
opcional de ubicación en el formulario y una cola que guarda en IndexedDB y después empuja al servidor cuando hay conexión. Como el servidor acepta el id que genera el cliente, reintentar nunca duplica un reporte.

El tablero quedó en `#/tablero` con tarjetas de resumen, el coroplético por CP, barras por categoría, serie semanal y top 5 de colonias. Todas las gráficas son de una sola serie, así que usó un solo verde en las barras y una rampa de un solo tono en el mapa, y dejó los valores visibles (no solo en el tooltip) más una tabla de respaldo para el mapa.

Lo probó contra mi proyecto real y ahí salió un error suyo: la variable de las coordenadas se llamaba igual que la del texto de ubicación dentro del envío del formulario (`invalid assignment to const 'ubicacion'`), así que el guardado fallaba y las coordenadas llegaban vacías. Lo encontró porque la prueba falló y fue a buscar el error de la consola en vez de suponer.

### Prompt 2 

"Hay que hacerlo ahora."

**Resultado:** El panel de moderación dejó de leer IndexedDB: ahora lista y modera los reportes del servidor, y exige sesión iniciada **más** estar dado de alta como moderador. El truco para no reescribir la interfaz fue un gestor remoto con la misma forma que el local, así que el panel funciona con cualquiera de los dos.

Mantuvo el token en la URL, pero ya no como control de acceso: quien llega a esa ruta se topa con el inicio de sesión. "La URL oculta, el login protege". Me avisó que lo dejaba así por mis criterios de aceptación y que se podía quitar.

Separó las pruebas en dos: el panel con el gestor local sobre una base de
pruebas (24 comprobaciones) y el acceso con las dos barreras (12). Me dijo con claridad lo que no podía probar: el camino con sesión válida, porque no tenía una cuenta de moderador.

### Prompt 3 —

"Levanté reportes nuevos, después me fui al link de moderador. Todo bien con la autenticación, pero los reportes todos salen sin foto adjunta aunque sí les puse, porque no te deja enviar reporte sin foto. Hay un reporte que en ubicación sale <img src=x onerror="window.HACKEADO=1">, en otros dos reportes la ubicación tiene el nombre de la colonia y aparte dice PRUEBA AUTOMATICA, y el botón de fusionar no hace nada."

**Resultado:** Revisó los cuatro puntos y reconoció que dos eran fallas suyas:

- Fusionar no hacía nada porque la función que busca los candidatos no estaba aplicada en mi proyecto (lo confirmó consultando mi API), y el error se perdía  en silencio. Ahora el panel muestra el fallo en lugar de quedarse quieto.

- Las fotos nunca subían al servidor: se quedaban en el teléfono. Creó un
  bucket privado de 5 MB solo para imágenes; cualquiera puede subir pero solo  un moderador puede ver, mediante enlaces que caducan en una hora, porque una  foto puede traer rostros, placas o la ubicación en sus metadatos.

- Los reportes raros eran sus datos de prueba. Una suite suya había escrito en mi base local y la sincronización los mandó al servidor junto con los míos. Lo admitió, me pidió disculpas y me dio el SQL para borrarlos.

También agregó una forma de adjuntar la foto a los reportes que ya se habían sincronizado sin ella, para no tener que volver a capturarlos.


## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

Que no se conformó con revisar el código: probó contra mi proyecto real y así salió el error del nombre de variable, que ninguna lectura habría detectado. Y la honestidad cuando algo fue culpa suya: los datos de prueba que terminaron en mi base, el error que se tragaba el botón de fusionar. No lo disfrazó.

**¿Qué aprendiste sobre prompt engineering?**

Que usar la aplicación yo misma y describir lo que vi, punto por punto, encontró tres fallas que sus pruebas automáticas no podían ver, precisamente porque no tenía una cuenta de moderador. Las pruebas automáticas cubren lo que se les ocurre probar; usarla de verdad cubre lo demás.


## MODIFICACIONES MANUALES

1. Apliqué las migraciones de moderación y fotos en el SQL Editor.
2. Creé mi cuenta en Authentication y la di de alta como moderadora con un
   `insert` en `privado.moderadores`.
3. Probé la moderación real con reportes capturados por mí.


**TIEMPO TOTAL:**  2h

**SATISFACCIÓN CON EL PROCESO (1-5):** 5

**JUSTIFICACIÓN:** 



# BITÁCORA DE IMPLEMENTACIÓN CON IA — SESIÓN 6

Herramienta: Claude Code (Claude Opus 5) dentro de VS Code
Fecha: 9 de septiembre de 2026
Historias implementadas: catálogo verificado de asentamientos con código postal, mejoras del mapa del tablero (vialidades, ficha por zona, vista de escritorio, encuadre y desplazamiento, mapa base de OpenStreetMap) y limpieza final del código.


## PROMPTS UTILIZADOS

### Prompt 1 

"Ya salieron algunos con fotos, otros siguen sin foto. Validé y descarté reportes para ver de qué manera afectaban el tablero; en los números estaba todo bien, pero en el mapa solo había un solo reporte reflejado, uno en donde elegí usar la ubicación. Me gustaría usar una API para que se ingrese automáticamente el nombre de la colonia y se almacene junto con el código postal. Es un widget embebible de Correos de México (…). Así ya no tengo que tener las colonias enlistadas: se usa información completa, correcta y sobre todo verificada. ¿Hay manera de acotarla únicamente a registros de Mexicali, Baja California?"

**Resultado:** Leyó el código del widget y me contestó directo que el widget no se puede acotar no tiene ninguna opción de configuración. Pero la API que usa sí servía: la consultó una sola vez, código postal por código postal (877 registros, cero fallos), y guardó el resultado en el proyecto. Me explicó por qué no embeber el widget: el formulario tiene que funcionar sin señal, el proyecto es de cero librerías, y un script de terceros en la página donde alguien escribe un reporte anónimo podría leer todo lo que escribe.

Así quedaron 751 asentamientos verificados con su código postal, en lugar de las 37 colonias que había escrito de memoria. El buscador acepta el nombre o el código postal, y cada reporte lleva su CP aunque no se use el GPS; eso explica y corrige que en el mapa solo apareciera el reporte con ubicación.

Al cruzar los datos encontró un error propio: 42 de los 231 polígonos del mapa eran de Tecate, porque había supuesto que todos los 21xxx eran de Mexicali. Los quitó del mapa y del servidor.

### Prompt 2

"¿Se puede hacer algo para que las zonas en el mapa estén más identificables? Nombres de calles principales, además que cuando se seleccione una zona salga un pequeño recuadro donde diga el nombre de la colonia y de qué han sido los reportes. Otro detalle de presentación: que en el tablero no salga todo en formato formulario; para celulares está bien esa vista, pero en computadoras se ve muy vacío en los laterales."

**Resultado:** Descargó las vialidades principales de OpenStreetMap una sola vez, agregó una ficha al tocar cada zona (colonias, desglose por categoría y fecha del último reporte) y en escritorio acomodó el tablero en dos columnas, dejando el formulario igual. Revisó capturas de pantalla y corrigió lo que vio: el mapa se desencuadraba si había un reporte lejano, y una regla de estilo de escritorio agrandaba de nuevo la tarjeta de texto.

### Prompt 3 

"Las calles solo salen tres nombres. Solo agrega Lázaro Cárdenas, la carretera a San Felipe y la salida a Tijuana. También quita las líneas grises; sé que se supone que son las calles principales, pero solo se ven como líneas mal dibujadas. Solo mantén las de las 6 calles que mencioné."

**Resultado:** Dejó solo seis vialidades, las seis rotuladas. Para que cupieran los nombres hizo que la etiqueta pudiera deslizarse a lo largo de su calle y que el cálculo tomara en cuenta el giro del texto.

Aquí rompió algo y lo contó: al reescribir la función del mapa borró la parte que dibujaba la leyenda y el tablero quedó en blanco, sin que su verificación lo notara. Agregó un revisor que comprueba que cada importación entre archivos exista, y lo probó quitando una a propósito para confirmar que falla cuando
debe.

### Prompt 4 

"El mapa no está completo, hay muchas colonias que no salen al oeste de Mexicali: hay zonas de Nuevo Mexicali, Pórticos, La Condesa. ¿Será posible agregarlas, pero agregar una barra de scroll para que se pueda desplazar por el mapa?"

**Resultado:** Antes de cambiar nada revisó si faltaban del archivo: no faltaban, estaban dibujadas pero fuera del encuadre, que se ceñía al centro viejo y dejaba fuera 30 zonas. Amplió el encuadre, comprobó una por una que las once colonias que mencioné quedaran dentro, y metió el mapa en un marco desplazable que abre centrado en el centro de la ciudad.

### Prompt 5 

"¿No se puede usar el mapa de OpenStreetMap directamente, con el HTML, y solo colocar pines en las zonas de denuncias? No hagas nada, solo es evaluación de si conviene o no."

**Resultado:** Respetó que era solo evaluación. Me explicó que el mapa embebible solo admite un marcador, que usar Leaflet rompía el "cero librerías" que yo misma había justificado y dejaba el mapa sin funcionar sin conexión, y sobre todo que los pines por reporte romperían el anonimato**: el backend está hecho para que las coordenadas nunca salgan, y un pin sobre una casa, con foto, puede señalar a un vecino. Recomendó una imagen de OpenStreetMap como fondo.

Le contesté "me agrada la opción de la imagen" y armó una herramienta que baja los mosaicos del área urbana una sola vez y los convierte en una imagen de 180 KB, con la atribución a OpenStreetMap junto al mapa.



## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

Que ante cada petición primero diagnosticó y después cambió. Con el widget
investigó qué era y encontró una mejor forma de usar sus datos; con las colonias que faltaban descubrió que no faltaban sino que quedaban fuera del encuadre; con OpenStreetMap me dio una evaluación en vez de hacer lo primero que pedí. En los tres casos la solución final fue mejor que la que yo había imaginado.

**¿Qué aprendiste sobre prompt engineering?**

Que ser concreta con lo visual funciona mucho mejor que pedir "que se vea mejor": decir exactamente qué seis calles quería, y que las líneas se veían mal dibujadas, dio justo el resultado. Y que pedir explícitamente "no hagas nada, solo evalúa" cambia la respuesta: en vez de construir, comparó opciones y me hizo ver un problema de anonimato que yo no había considerado.


## MODIFICACIONES MANUALES

1. Apliqué las migraciones del catálogo de asentamientos, el código postal
   declarado, las fotos de reportes ya moderados y el desglose por zona.
2. Elegí las seis vialidades de referencia del mapa.



**TIEMPO TOTAL:** Aprox. 2h 30m 

**SATISFACCIÓN CON EL PROCESO (1-5):** 5

**JUSTIFICACIÓN:** Le hice cambiar muchas cosas minimas que solo tenian funcion estetica pero me termino gustando muhcho el resultaod. 
