// src/reportes/form/ReporteForm.js — capa de UI del formulario de captura.
//
// Responsabilidad única: leer el formulario, validarlo y pedirle al store que
// guarde. No abre IndexedDB ni sabe cómo se persiste: recibe el store ya
// construido (inyección de dependencia), así se puede probar de forma aislada.

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
    if (!form) return; // la vista actual no tiene formulario (ej. el panel)

    const inputFoto = document.getElementById('reporte-foto');
    const inputUbicacion = document.getElementById('reporte-ubicacion');
    const selectCategoria = document.getElementById('reporte-categoria');
    const botonEnviar = document.getElementById('btn-enviar');
    const errorMsg = document.getElementById('error-msg');
    const exitoMsg = document.getElementById('exito-msg');
    const botonUbicacion = document.getElementById('btn-ubicacion');
    const estadoGps = document.getElementById('estado-gps');
    const estadoCp = document.getElementById('estado-cp');

    // Coordenadas de la lectura de GPS, si la persona la autorizó. Se llama
    // `coordenadas` y no `ubicacion` porque dentro del submit ya existe una
    // const `ubicacion` con el texto del campo, y el nombre repetido la
    // sombreaba: asignarle rompía el guardado.
    let coordenadas = null;

    // Asentamiento elegido del catálogo, con su código postal. Es lo que
    // permite ubicar el reporte en el mapa cuando no hay GPS.
    let asentamiento = null;

    // Las categorías salen del catálogo compartido con el panel de validación,
    // para que no haya dos listas que se desincronicen.
    for (const { valor, etiqueta } of CATEGORIAS) {
        const opcion = document.createElement('option');
        opcion.value = valor;
        opcion.textContent = etiqueta;
        selectCategoria.appendChild(opcion);
    }

    // Sugerencias mientras se escribe, por nombre o por código postal. El campo
    // sigue aceptando texto libre: quien no encuentre su colonia puede escribir
    // la calle o el cruce, solo que ese reporte no podrá ubicarse en el mapa.
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

        // Validación propia (los campos no llevan `required` en el HTML a
        // propósito, para controlar nosotros el mensaje y su presentación).
        if (!foto || !ubicacion || !categoria) {
            mostrarError('Todos los campos son obligatorios.');
            return;
        }

        // ANONIMATO: solo se arman estos campos. No se pide ni se deriva
        // ningún dato del autor; el id lo genera el store de forma aleatoria.
        const reporte = {
            foto,                    // File ES un Blob: IndexedDB lo guarda tal cual
            categoria,
            ubicacion,
            fecha: new Date().toISOString(),
            estado: ESTADOS.PENDIENTE,
            motivo: null,            // se llena al descartar (Incremento 2)
            refOriginal: null,       // se llena al fusionar (Incremento 2)

            // Coordenadas para el mapa del tablero. Van al servidor, que
            // deriva de ellas el código postal; el punto exacto no se publica.
            lat: coordenadas?.lat ?? null,
            lon: coordenadas?.lon ?? null,

            // Código postal del catálogo. Sirve para el mapa cuando no hubo
            // GPS; si lo hubo, manda lo que digan las coordenadas.
            codigoPostal: asentamiento?.cp ?? null,
            asentamiento: asentamiento?.n ?? null,

            // Offline-first: se guarda local y ya. El envío al servidor es
            // otro paso, que puede ocurrir mucho después.
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

            // El envío al servidor no bloquea la confirmación: si falla, el
            // reporte ya está a salvo en el dispositivo y se reintenta luego.
            sincronizador?.sincronizar().catch(() => { });
        } catch (error) {
            console.error('Error guardando el reporte:', error);
            mostrarError('No se pudo guardar el reporte. Intenta de nuevo.');
        } finally {
            botonEnviar.disabled = false;
        }
    });
}
