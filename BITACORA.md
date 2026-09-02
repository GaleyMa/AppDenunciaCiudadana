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
