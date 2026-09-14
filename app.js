
import ReporteStore from './src/reportes/store/ReporteStore.js';
import initReporteForm from './src/reportes/form/ReporteForm.js';
import GestorValidacionRemoto from './src/reportes/validacion/GestorValidacionRemoto.js';
import initValidacionPanel from './src/reportes/validacion/ValidacionPanel.js';
import SesionModerador from './src/reportes/auth/SesionModerador.js';
import initPantallaLogin from './src/reportes/auth/PantallaLogin.js';
import SincronizadorReportes from './src/reportes/sync/SincronizadorReportes.js';
import initTableroPublico from './src/reportes/tablero/TableroPublico.js';
import { TOKEN_PANEL, RUTA_PANEL } from './src/config.js';

/** Ruta del tablero público. A diferencia del panel, esta no es secreta. */
const RUTA_TABLERO = '#/tablero';

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

const store = new ReporteStore();

const sincronizador = new SincronizadorReportes(store);
sincronizador.iniciar();

initReporteForm(store, sincronizador);

const vistaPublica = document.getElementById('vista-publica');
const vistaPanel = document.getElementById('vista-panel');
const vistaTablero = document.getElementById('vista-tablero');
let panel = null;
let tablero = null;

const sesion = new SesionModerador();

/** Barra con la cuenta abierta y el botón de salir. */
function barraSesion() {
    const barra = document.createElement('div');
    barra.className = 'barra-sesion';

    const quien = document.createElement('span');
    quien.textContent = sesion.correo() ?? 'Sesión iniciada';

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.id = 'btn-salir';
    salir.className = 'btn-secundario';
    salir.textContent = 'Cerrar sesión';
    salir.addEventListener('click', async () => {
        await sesion.cerrar();
        panel = null;
        montarModeracion();
    });

    barra.append(quien, salir);
    return barra;
}

/** Pinta el acceso o el panel, según haya sesión. */
function montarModeracion() {
    vistaPanel.replaceChildren();

    if (!sesion.activa()) {
        initPantallaLogin(vistaPanel, sesion, () => montarModeracion());
        return;
    }

    vistaPanel.appendChild(barraSesion());

    const hueco = document.createElement('div');
    vistaPanel.appendChild(hueco);
    panel = initValidacionPanel(hueco, new GestorValidacionRemoto(sesion));
}

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

    const autorizado = tokenDeLaUrl() === TOKEN_PANEL;
    const esTablero = window.location.hash === RUTA_TABLERO;

    vistaPublica.hidden = autorizado || esTablero;
    vistaPanel.hidden = !autorizado;
    vistaTablero.hidden = !esTablero;

    if (autorizado) {
        if (panel) panel.render();
        else montarModeracion();
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

window.reporteStore = store;
