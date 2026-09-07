# Contexto del proyecto para IA local — Incremento 2



Eres un asistente de desarrollo. Vas a ayudarme a construir el **Incremento 2** de una PWA. Trabajo **offline, sin conexión a internet**, en un proyecto de una sola persona. Necesito **código funcional esta noche**. Lee todo el contexto antes de escribir nada.

## PROYECTO: Sistema de recopilación de denuncias ciudadanas (PWA)

PWA de monitoreo ciudadano, independiente del gobierno, para reportar fallas urbanas (baches, luminarias, basura) de forma anónima y offline. Los datos alimentan un tablero público para generar presión ciudadana. Es un proyecto académico (asignatura de Ingeniería de Software).

## FILOSOFÍA TÉCNICA (respétala estrictamente)

- Cliente en **JavaScript vanilla puro**: HTML + CSS + JS con módulos ES6. **CERO frameworks** (no React/Vue/Svelte), **CERO librerías externas** en el cliente (no Dexie, no axios). Esto es por peso de bundle para dispositivos de gama media con señal intermitente.
- **Offline-first**: la app debe funcionar sin conexión.
- Persistencia local con **IndexedDB nativa** (NO LocalStorage, porque se guardan fotos como blobs y LocalStorage se limita a ~5MB y solo strings).
- **Anonimato**: los reportes nunca guardan datos personales ni credenciales. El id del reporte se genera localmente y no identifica al autor.
- **Separación por capas**: UI / Lógica de negocio / Persistencia. Módulos ES6 con responsabilidad única, testeables de forma aislada.

## ARQUITECTURA EN 3 FEATURES (INCREMENTOS)

**Incremento 1 — Captura y envío offline de reportes (YA EXISTE parcialmente):**
- Formulario de captura (ReporteForm) con foto, ubicación (GPS + fallback manual), categoría.
- ESTADO ACTUAL: el formulario existe en HTML/CSS/JS vanilla, pero su submit es básico y **NO guarda nada** todavía. No hay subida de archivo ni persistencia. Esto hay que completarlo.

**Incremento 2 — Panel de validación (LO QUE VAMOS A CONSTRUIR AHORA):**
- **ValidacionPanel**: vista que lista los reportes pendientes leyendo desde IndexedDB. Muestra por reporte: miniatura de la foto, dirección/ubicación aproximada, categoría y fecha. NUNCA muestra datos del autor. Acceso mediante URL secreta (sin sistema de login).
- **GestorValidacion**: permite validar, descartar (con motivo: duplicado / sin evidencia / spam) y fusionar (marcar un reporte como duplicado de otro, guardando referencia al id del original). Cada acción cambia el estado del reporte en IndexedDB.

**Incremento 3 — Tablero público de estadísticas (FUTURO, NO construir ahora):**
- Dashboard con mapa coroplético por colonia, gráfico de barras por tipo, tabla top 5 colonias, métrica semanal.
- Backend gestionado (Supabase) que agrega y anonimiza del lado servidor. FUERA DEL ALCANCE de esta sesión.

## DECISIÓN DE ALCANCE PARA ESTA SESIÓN (IMPORTANTE)

Todo debe funcionar **100% LOCAL y OFFLINE**. NO uses Supabase, NO uses ninguna nube, NO uses fetch a ningún backend. El Incremento 2 lee y escribe reportes en IndexedDB local. El dato compartido entre dispositivos queda documentado como incremento futuro, no se implementa hoy.

## ORDEN DE CONSTRUCCIÓN (porque el Incremento 1 no guarda nada)

1. **ReporteStore** (capa de persistencia): módulo ES6 que envuelve IndexedDB. Funciones: guardar un reporte (incluyendo la foto como blob), obtener todos los reportes, obtener por estado (ej. "pendiente"), actualizar el estado de un reporte por id, obtener por id. El objeto Reporte tiene al menos: `id` único, `foto` (blob), `categoria`, `ubicacion` (texto o coordenadas aproximadas), `fecha` (timestamp), `estado` ("pendiente" | "validado" | "descartado" | "fusionado"), `motivo` (para descarte), `refOriginal` (para fusión).

2. **Conectar el formulario existente (ReporteForm)**: al enviar, que genere un id único, arme el objeto Reporte con estado "pendiente", capture la foto como blob (input type file con accept image), y lo guarde vía ReporteStore. Mostrar confirmación "Reporte guardado".

3. **ValidacionPanel** (UI): vista HTML separada, accesible por una URL/ruta secreta. Lista los reportes con estado "pendiente" leídos de ReporteStore. Por cada uno: miniatura de la foto (desde el blob), categoría, ubicación aproximada, fecha. Botones: Validar / Descartar / Fusionar. NO muestra ningún dato de autor (no existe).

4. **GestorValidacion** (lógica): ejecuta las acciones sobre un reporte y actualiza su estado en ReporteStore:
   - **Validar** → estado "validado".
   - **Descartar** → pide motivo (duplicado/sin evidencia/spam), estado "descartado", guarda motivo, sale de pendientes.
   - **Fusionar** → estado "fusionado", guarda refOriginal con el id del reporte original, sale de pendientes.

## GENERACIÓN DE ID ÚNICO (sin librerías)

- Usa `crypto.randomUUID()`, que es **nativo del navegador** y no requiere ninguna librería externa. Genera un UUID v4 como string.
- Requiere contexto seguro: funciona en `localhost` y en HTTPS (que es justo donde corre una PWA), así que es apropiado aquí.
- El id se genera en el cliente, es aleatorio y **no deriva de ningún dato del usuario** (refuerza el anonimato: no identifica al autor).
- Si por alguna razón el entorno no soporta `crypto.randomUUID()`, usa como fallback `crypto.getRandomValues()` con un arreglo de enteros, también nativo. No recurras a librerías tipo uuid.

## ACCESO AL VALIDACIONPANEL POR URL SECRETA

El panel de validación no tiene login. El control de acceso es una URL secreta que solo conocen los moderadores. Impleméntalo así, todo del lado cliente y offline:

- El panel vive en una ruta que incluye un token secreto, por ejemplo mediante un parámetro de query o un hash: `index.html?panel=<TOKEN_SECRETO>` o `#/validacion/<TOKEN_SECRETO>`. Prefiere el hash (`#`) porque no se manda al servidor y funciona sin configuración de rutas.
- Define el TOKEN_SECRETO como una constante en un módulo de configuración (una cadena larga y difícil de adivinar). Al cargar la vista, el JS lee el token de la URL y lo compara con la constante.
- Si el token coincide, se renderiza el ValidacionPanel (lista de pendientes + acciones).
- Si el token falta o es incorrecto, NO se renderiza el panel: se muestra un mensaje neutro tipo "Acceso no autorizado" o simplemente la vista pública normal, sin pistas de que exista un panel.
- La comparación es local; no hay llamada a red.

**Limitación reconocida (déjala como comentario en el código):** este método NO es seguridad real. La URL puede filtrarse y el token es visible en el código fuente del cliente, así que cualquiera con acceso al bundle podría encontrarlo. Es una medida de ofuscación mínima, aceptable solo para el MVP. La autenticación real (login de moderadores o verificación server-side) queda como incremento futuro, junto con el backend.

## CRITERIOS DE ACEPTACIÓN QUE EL CÓDIGO DEBE CUMPLIR

- Un reporte guardado sigue disponible tras cerrar y reabrir la app (durabilidad de IndexedDB).
- El panel solo muestra reportes en estado "pendiente".
- Validar/descartar/fusionar cambian el estado y el reporte desaparece de la lista de pendientes.
- Descartar exige un motivo.
- Fusionar guarda la referencia al id del reporte original.
- Ningún dato identifica al autor en ninguna vista.
- El id del reporte se genera con API nativa (`crypto.randomUUID()`), sin librerías.
- Dado el token correcto en la URL, cuando se carga la vista, entonces se muestra el panel de validación.
- Dado un token ausente o incorrecto, cuando se carga la vista, entonces el panel no se muestra y no se revela su existencia.
- Todo funciona sin conexión a internet.

## CÓMO QUIERO QUE TRABAJES

- Explícame el plan en pasos antes de codificar.
- Dame el código por módulos, comentado, en archivos separados (vanilla ES6).
- Primero ReporteStore, luego la conexión del formulario, luego el panel, luego el gestor. No saltes pasos.
- Recuérdame en qué punto necesito probar cada pieza antes de seguir.

