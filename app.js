// app.js — punto de entrada de la PWA (se carga con type="module").
//
// Solo cablea las piezas: registra el service worker, crea la capa de
// persistencia y se la pasa a la capa de UI. La lógica vive en los módulos.

import ReporteStore from './src/reportes/store/ReporteStore.js';
import initReporteForm from './src/reportes/form/ReporteForm.js';
import GestorValidacion from './src/reportes/validacion/GestorValidacion.js';
import initValidacionPanel from './src/reportes/validacion/ValidacionPanel.js';
import SincronizadorReportes from './src/reportes/sync/SincronizadorReportes.js';
import initTableroPublico from './src/reportes/tablero/TableroPublico.js';
import { TOKEN_PANEL, RUTA_PANEL } from './src/config.js';

/** Ruta del tablero público. A diferencia del panel, esta no es secreta. */
const RUTA_TABLERO = '#/tablero';

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

// Empuja al servidor lo que aún no ha salido del dispositivo, y reintenta
// cuando vuelva la conexión.
const sincronizador = new SincronizadorReportes(store);
sincronizador.iniciar();

initReporteForm(store, sincronizador);

// --- Ruteo: vista pública o panel de validación ---
// Todo local: se compara el token del hash contra la constante. No hay red.

const vistaPublica = document.getElementById('vista-publica');
const vistaPanel = document.getElementById('vista-panel');
const vistaTablero = document.getElementById('vista-tablero');
let panel = null;
let tablero = null;

// Si faltan los contenedores, el navegador está sirviendo un index.html viejo
// desde el caché del service worker. Se avisa en vez de fallar en silencio.
if (!vistaPublica || !vistaPanel || !vistaTablero) {
    console.error(
        'Faltan los contenedores de las vistas. Seguramente el service '
        + 'worker está sirviendo un index.html viejo: en DevTools → Application → '
        + 'Service Workers, marca "Update on reload" o pulsa Unregister y recarga.'
    );
}

/** Token que trae la URL, o null si la ruta no es la del panel. */
function tokenDeLaUrl() {
    const { hash } = window.location;
    return hash.startsWith(RUTA_PANEL) ? hash.slice(RUTA_PANEL.length) : null;
}

function enrutar() {
    if (!vistaPublica || !vistaPanel || !vistaTablero) return;

    // Token ausente o incorrecto: se muestra la vista pública normal, sin
    // mensajes ni pistas de que exista un panel de moderación.
    const autorizado = tokenDeLaUrl() === TOKEN_PANEL;
    const esTablero = window.location.hash === RUTA_TABLERO;

    vistaPublica.hidden = autorizado || esTablero;
    vistaPanel.hidden = !autorizado;
    vistaTablero.hidden = !esTablero;

    if (autorizado) {
        if (panel) panel.render();
        else panel = initValidacionPanel(vistaPanel, new GestorValidacion(store));
    } else {
        vistaPanel.replaceChildren();
        panel = null;
    }

    if (esTablero) {
        if (tablero) tablero.render();
        else tablero = initTableroPublico(vistaTablero);
    } else {
        vistaTablero.replaceChildren();
        tablero = null;
    }
}

window.addEventListener('hashchange', enrutar);
enrutar();

// Expuesto solo para poder probar el store desde la consola de DevTools.
// Eliminar cuando el proyecto salga de desarrollo.
window.reporteStore = store;
