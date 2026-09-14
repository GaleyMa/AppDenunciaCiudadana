const CACHE_NAME = 'denuncia-v13';

self.addEventListener('install', (event) => {
    console.log('Instalando el Service Worker...');

    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caché abierto:', CACHE_NAME);
                const rutas = [
                    '/',
                    '/index.html',
                    '/style.css',
                    '/app.js',
                    '/manifest.json',
                    '/src/reportes/store/ReporteStore.js',
                    '/src/reportes/form/ReporteForm.js',
                    '/src/reportes/form/ColoniaAutocomplete.js',
                    '/src/reportes/datos/asentamientos-mexicali.js',
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
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((respuesta) => {
                if (respuesta) return respuesta;

                return fetch(event.request).then((respuestaRed) => {
                    if (respuestaRed.ok) {
                        const copia = respuestaRed.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
                    }
                    return respuestaRed;
                });
            })
    );
});
