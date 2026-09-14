
import { ESTADOS } from '../store/ReporteStore.js';
import initColoniaAutocomplete from './ColoniaAutocomplete.js';
import ASENTAMIENTOS_MEXICALI from '../datos/asentamientos-mexicali.js';
import CATEGORIAS from '../datos/categorias.js';
import solicitarUbicacion from './CapturaGps.js';

/**
 * Conecta el formulario #reporte-form con el ReporteStore.
 * @param {ReporteStore} store instancia de la capa de persistencia.
 */
export default function initReporteForm(store, sincronizador = null) {
    const form = document.getElementById('reporte-form');
    if (!form) return;

    const inputFoto = document.getElementById('reporte-foto');
    const inputUbicacion = document.getElementById('reporte-ubicacion');
    const selectCategoria = document.getElementById('reporte-categoria');
    const botonEnviar = document.getElementById('btn-enviar');
    const errorMsg = document.getElementById('error-msg');
    const exitoMsg = document.getElementById('exito-msg');
    const botonUbicacion = document.getElementById('btn-ubicacion');
    const estadoGps = document.getElementById('estado-gps');
    const estadoCp = document.getElementById('estado-cp');

    let coordenadas = null;

    let asentamiento = null;

    for (const { valor, etiqueta } of CATEGORIAS) {
        const opcion = document.createElement('option');
        opcion.value = valor;
        opcion.textContent = etiqueta;
        selectCategoria.appendChild(opcion);
    }

    initColoniaAutocomplete(
        inputUbicacion,
        document.getElementById('lista-colonias'),
        ASENTAMIENTOS_MEXICALI,
        (opcion) => {
            asentamiento = opcion;
            estadoCp.textContent = opcion ? `CP ${opcion.cp} · ${opcion.t}` : '';
        },
    );

    const mostrarError = (texto) => {
        errorMsg.textContent = texto;
        exitoMsg.textContent = '';
    };

    const mostrarExito = (texto) => {
        exitoMsg.textContent = texto;
        errorMsg.textContent = '';
    };

    botonUbicacion?.addEventListener('click', async () => {
        botonUbicacion.disabled = true;
        estadoGps.textContent = 'Obteniendo ubicación…';
        estadoGps.classList.remove('gps-error');

        try {
            coordenadas = await solicitarUbicacion();
            estadoGps.textContent = `Ubicación lista (±${coordenadas.precision} m)`;
        } catch (error) {
            coordenadas = null;
            estadoGps.textContent = error.message;
            estadoGps.classList.add('gps-error');
        } finally {
            botonUbicacion.disabled = false;
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const foto = inputFoto.files[0];
        const ubicacion = inputUbicacion.value.trim();
        const categoria = selectCategoria.value;

        if (!foto || !ubicacion || !categoria) {
            mostrarError('Todos los campos son obligatorios.');
            return;
        }

        const reporte = {
            foto,
            categoria,
            ubicacion,
            fecha: new Date().toISOString(),
            estado: ESTADOS.PENDIENTE,
            motivo: null,
            refOriginal: null,

            lat: coordenadas?.lat ?? null,
            lon: coordenadas?.lon ?? null,

            codigoPostal: asentamiento?.cp ?? null,
            asentamiento: asentamiento?.n ?? null,

            sincronizado: false,
        };

        botonEnviar.disabled = true;
        try {
            const id = await store.saveReport(reporte);
            console.log('Reporte guardado con id:', id);
            mostrarExito('Reporte guardado');
            form.reset();
            coordenadas = null;
            asentamiento = null;
            estadoGps.textContent = '';
            estadoCp.textContent = '';

            sincronizador?.sincronizar().catch(() => { });
        } catch (error) {
            console.error('Error guardando el reporte:', error);
            mostrarError('No se pudo guardar el reporte. Intenta de nuevo.');
        } finally {
            botonEnviar.disabled = false;
        }
    });
}
