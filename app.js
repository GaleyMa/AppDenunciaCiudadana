// app.js — punto de entrada de la PWA (se carga con type="module").
//
// Solo cablea las piezas: registra el service worker, crea la capa de
// persistencia y se la pasa a la capa de UI. La lógica vive en los módulos.

import ReporteStore from './src/reportes/store/ReporteStore.js';
import initReporteForm from './src/reportes/form/ReporteForm.js';

// --- Service worker (offline-first) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('ServiceWorker registrado con éxito:', registration);
            })
            .catch((error) => {
                console.error('Error al registrar ServiceWorker:', error);
            });
    });
}

// --- Capas de la app ---
// Una sola instancia del store para toda la app: abre la base una vez y los
// módulos que la necesiten (hoy el formulario, mañana el ValidacionPanel)
// comparten esa misma conexión.
const store = new ReporteStore();

initReporteForm(store);

// Expuesto solo para poder probar el store desde la consola de DevTools.
// Eliminar cuando el proyecto salga de desarrollo.
window.reporteStore = store;
