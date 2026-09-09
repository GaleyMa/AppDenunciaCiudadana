const CACHE_NAME = 'denuncia-v8';

self.addEventListener('install', (event) => {
    console.log('Instalando el Service Worker...');

    // Sin esto, un service worker nuevo se queda "esperando" hasta que se
    // cierran TODAS las pestañas de la app: recargar no basta. Es lo que hacía
    // que, tras cambiar el código, el navegador siguiera sirviendo la versión
    // vieja desde el caché.
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caché abierto:', CACHE_NAME);
                // `cache: 'reload'` es imprescindible: sin él, addAll puede
                // servirse del caché HTTP del navegador y guardar en el caché
                // del service worker una copia VIEJA de los archivos. Eso hacía
                // que, tras actualizar el código, el service worker nuevo
                // sirviera el HTML anterior aunque el caché viejo ya se hubiera
                // borrado.
                const rutas = [
                    '/',
                    '/index.html',
                    '/style.css',
                    '/app.js',
                    '/manifest.json',
                    // Módulos ES6: el navegador los pide por separado, así que
                    // también tienen que estar en el caché para funcionar offline.
                    '/src/reportes/store/ReporteStore.js',
                    '/src/reportes/form/ReporteForm.js',
                    '/src/reportes/form/ColoniaAutocomplete.js',
                    '/src/reportes/datos/colonias-mexicali.js',
                    '/src/reportes/datos/categorias.js',
                    '/src/reportes/validacion/GestorValidacion.js',
                    '/src/reportes/validacion/ValidacionPanel.js',
                    '/src/config.js',
                    '/src/reportes/api/SupabaseApi.js',
                    '/src/reportes/sync/SincronizadorReportes.js',
                    '/src/reportes/form/CapturaGps.js',
                    '/src/reportes/tablero/TableroPublico.js',
                    '/src/reportes/tablero/graficas.js',
                    '/src/reportes/auth/SesionModerador.js',
                    '/src/reportes/auth/PantallaLogin.js',
                    '/src/reportes/validacion/GestorValidacionRemoto.js'
                    // El GeoJSON de códigos postales (200 KB) NO va aquí: se
                    // guarda en caché la primera vez que alguien abre el
                    // tablero, para no cobrárselo a quien solo va a reportar.
                ];

                return cache.addAll(rutas.map((ruta) => new Request(ruta, { cache: 'reload' })));
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Activando el Service Worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Borrando caché viejo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            // Toma el control de las pestañas que ya estaban abiertas, para que
            // no se queden con los archivos del caché anterior.
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Solo se gestiona lo propio. Las llamadas a Supabase van directas a la
    // red: cachearlas serviría estadísticas viejas sin que nadie lo note.
    if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((respuesta) => {
                if (respuesta) return respuesta;

                return fetch(event.request).then((respuestaRed) => {
                    // Se guarda lo que se pide por primera vez (por ejemplo el
                    // GeoJSON del mapa), para que a la segunda funcione sin red.
                    if (respuestaRed.ok) {
                        const copia = respuestaRed.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
                    }
                    return respuestaRed;
                });
            })
    );
});
