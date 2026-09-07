// src/reportes/form/ReporteForm.js — capa de UI del formulario de captura.
//
// Responsabilidad única: leer el formulario, validarlo y pedirle al store que
// guarde. No abre IndexedDB ni sabe cómo se persiste: recibe el store ya
// construido (inyección de dependencia), así se puede probar de forma aislada.

import { ESTADOS } from '../store/ReporteStore.js';
import initColoniaAutocomplete from './ColoniaAutocomplete.js';
import COLONIAS_MEXICALI from '../datos/colonias-mexicali.js';
import CATEGORIAS from '../datos/categorias.js';

/**
 * Conecta el formulario #reporte-form con el ReporteStore.
 * @param {ReporteStore} store instancia de la capa de persistencia.
 */
export default function initReporteForm(store) {
    const form = document.getElementById('reporte-form');
    if (!form) return; // la vista actual no tiene formulario (ej. el panel)

    const inputFoto = document.getElementById('reporte-foto');
    const inputUbicacion = document.getElementById('reporte-ubicacion');
    const selectCategoria = document.getElementById('reporte-categoria');
    const botonEnviar = document.getElementById('btn-enviar');
    const errorMsg = document.getElementById('error-msg');
    const exitoMsg = document.getElementById('exito-msg');

    // Las categorías salen del catálogo compartido con el panel de validación,
    // para que no haya dos listas que se desincronicen.
    for (const { valor, etiqueta } of CATEGORIAS) {
        const opcion = document.createElement('option');
        opcion.value = valor;
        opcion.textContent = etiqueta;
        selectCategoria.appendChild(opcion);
    }

    // Sugerencias de colonia mientras se escribe. El campo sigue aceptando
    // texto libre: la lista solo ahorra tecleo y unifica la escritura.
    initColoniaAutocomplete(
        inputUbicacion,
        document.getElementById('lista-colonias'),
        COLONIAS_MEXICALI,
    );

    const mostrarError = (texto) => {
        errorMsg.textContent = texto;
        exitoMsg.textContent = '';
    };

    const mostrarExito = (texto) => {
        exitoMsg.textContent = texto;
        errorMsg.textContent = '';
    };

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
        };

        botonEnviar.disabled = true;
        try {
            const id = await store.saveReport(reporte);
            console.log('Reporte guardado con id:', id);
            mostrarExito('Reporte guardado');
            form.reset();
        } catch (error) {
            console.error('Error guardando el reporte:', error);
            mostrarError('No se pudo guardar el reporte. Intenta de nuevo.');
        } finally {
            botonEnviar.disabled = false;
        }
    });
}
