const CACHE_NAME = 'denuncia-v3';

self.addEventListener('install', (event) => {
    console.log('Instalando el Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caché abierto:', CACHE_NAME);
                return cache.addAll([
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
                    '/src/reportes/datos/colonias-mexicali.js'
                ]);
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