const CACHE_NAME = 'denuncia-v6';

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
                    '/src/config.js'
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
    console.log('Manejo de la solicitud de:', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    console.log('Respuesta de caché:', event.request.url);
                    return response;
                }
                return fetch(event.request)
                    .then((response) => {
                        console.log('Respuesta de red:', event.request.url);
                        return response;
                    });
            })
    );
});