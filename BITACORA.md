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

> Nota: los prompts de esta sesión vienen **agrupados en dos bloques** por
> claridad. Cada bloque resume varios mensajes reales del intercambio; el
> contenido y los resultados sí corresponden a lo que ocurrió.


## PROMPTS UTILIZADOS

### Prompt 1 — Incremento 2: panel de validación y gestor

"Pasemos al Incremento 2 con ValidacionPanel y GestorValidacion. El panel lista
los reportes pendientes leyendo por estado desde IndexedDB y muestra por cada
uno la miniatura de la foto, la ubicación, la categoría y la fecha, nunca datos
del autor. El acceso es por URL secreta con un token en el hash: si el token
falta o es incorrecto, no se renderiza el panel ni se revela que existe. El
gestor permite validar, descartar con motivo (duplicado / sin evidencia / spam)
y fusionar guardando la referencia al id del reporte original."

**Resultado:** Separó las dos capas como pedía el proyecto: `GestorValidacion.js`
con la lógica (sin tocar el DOM) y `ValidacionPanel.js` con la interfaz (sin
reglas de negocio). El token quedó en `src/config.js` con el comentario de que
**esto no es seguridad real**, porque viaja en el código del cliente.

Decisiones que tomó y explicó:

- Para fusionar puso un `<select>` con los otros reportes (categoría, colonia,
  fecha e id corto) en vez de un campo para teclear el UUID a mano.
- Agregó tres reglas que yo no había pedido: no fusionar un reporte consigo
  mismo, no fusionar contra un id inexistente y no fusionar contra un reporte ya
  descartado o fusionado. El argumento fue evitar cadenas A→B→C que romperían el
  conteo del tablero del Incremento 3.
- Pinta todo el texto del ciudadano con `textContent` y nunca con `innerHTML`,
  porque el panel es justo donde un moderador lee texto escrito por un
  desconocido. Dejó una prueba que mete `<img src=x onerror=...>` como ubicación
  y verifica que se muestre como texto.
- Creó `datos/categorias.js` como catálogo único: antes las categorías estaban
  escritas a mano en el HTML y ahora el formulario arma su `<select>` desde ahí
  y el panel saca de ahí las etiquetas, para que no se desincronicen.

Probó las 29 comprobaciones manejando el `index.html` real dentro de un iframe:
control de acceso con token ausente / falso / correcto, que solo se listen
pendientes, las tres acciones, el bloqueo del descarte sin motivo y las reglas
del gestor. Quedó como `pruebas/ValidacionPanel.prueba.html`.

### Prompt 2 — "Subí los reportes, pero no aparecen en el panel de validación"

"Subí los reportes, pero no aparecen en el panel de validación." (Después le pasé
la salida del `console.table` que me pidió correr, y las dos URLs que estaba
usando.)

**Resultado:** En vez de suponer, primero reprodujo mi flujo exacto —capturar por
el formulario y luego abrir el panel— y le pasaron las 7 comprobaciones. Con eso
descartó el código y buscó en el entorno. Encontró **dos problemas distintos**:

1. **El service worker envenenaba su propio caché.** Al diagnosticar dentro del
   navegador salió que el service worker nuevo estaba activo y ya había borrado
   el caché viejo, pero seguía sirviendo el `index.html` anterior. La causa:
   `cache.addAll()` pide los archivos pasando por el caché HTTP del navegador,
   así que la versión nueva se instalaba guardando copias viejas. Lo arregló con
   `new Request(ruta, { cache: 'reload' })`, más `skipWaiting()` y
   `clients.claim()` para que la actualización tome el control al recargar en
   vez de esperar a que se cierren todas las pestañas.
2. **La causa real de mi caso: dos orígenes distintos.** Yo capturaba en
   `http://127.0.0.1:8000` y abría el panel en `http://localhost:8000`. Para el
   navegador son sitios diferentes y **IndexedDB está separado por origen**, así
   que el panel leía una base vacía. Mis cuatro reportes estaban intactos.

De paso admitió un error propio: la página `pruebas/ReporteStore.prueba.html`
que había entregado en la sesión anterior decía "base de prueba" pero borraba la
base **real**. La cambió para que use una base aparte
(`denuncia_ciudadana_pruebas`) y puso la suite del panel —que sí necesita la base
real— detrás de un botón con aviso en rojo, para que no se ejecute sola al abrir
la página. También agregó al panel vacío una línea que dice de qué origen está
leyendo, para que ese síntoma se explique solo la próxima vez.


## ANÁLISIS CRÍTICO

**¿Qué funcionó bien del código generado?**

La forma de depurar. Ante "no aparecen los reportes" no propuso arreglos a ciegas:
reprodujo el flujo, comprobó que el código funcionaba, y solo entonces fue por el
entorno, midiendo el estado real del service worker y de los cachés dentro del
navegador. El resultado fue un bug de fondo que yo no habría encontrado
—el caché envenenándose en cada actualización— y que además explicaba por qué sus
propias pruebas nunca lo detectaban: corrían siempre en perfiles nuevos, con el
caché vacío.

También funcionó que distinguiera entre el bug que yo creía tener y el que
realmente tenía. La causa de mi problema era una tontería de origen
(`127.0.0.1` contra `localhost`), y aun así el otro hallazgo valía por sí solo.

**¿Qué aprendiste sobre prompt engineering?**

Que describir el síntoma tal cual, sin diagnosticarlo yo, da mejor resultado que
pedir un arreglo concreto. Escribí "subí los reportes y no aparecen" y eso dejó
espacio para investigar; si hubiera escrito "arregla la consulta por estado", se
habría ido a corregir código que estaba bien.

Y que conviene pedir la evidencia de la prueba, no la afirmación de que algo
funciona. Cuando pedí que probara, ejecutó la app en un navegador y reportó las
comprobaciones una por una; ahí fue donde salieron cosas reales, incluida una
prueba mal escrita por él mismo (una expresión regular de fecha que asumía hora
de dos dígitos) que corrigió señalando que el fallo era de la prueba y no del
código.


## MODIFICACIONES MANUALES

En esta sesión tampoco modifiqué código a mano. Pendientes de mi lado:

1. Usar **un solo host** al probar (`127.0.0.1` o `localhost`, no ambos): cada
   uno tiene su propia base, su propio service worker y su propio caché.
2. Validar la lista de colonias contra una fuente oficial (sigue pendiente de la
   sesión anterior).
3. Fusionar las ramas de trabajo en `main`.


**TIEMPO TOTAL:** _(pendiente de llenar)_

**SATISFACCIÓN CON EL PROCESO (1-5):** _(pendiente de llenar)_

**JUSTIFICACIÓN:** _(pendiente de llenar)_
