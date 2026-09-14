
import { ESTADOS } from '../store/ReporteStore.js';

/** Motivos admitidos al descartar. Descartar SIEMPRE exige uno de estos. */
export const MOTIVOS_DESCARTE = Object.freeze([
    { valor: 'duplicado', etiqueta: 'Duplicado' },
    { valor: 'sin-evidencia', etiqueta: 'Sin evidencia' },
    { valor: 'spam', etiqueta: 'Spam' },
]);

const MOTIVOS_VALIDOS = MOTIVOS_DESCARTE.map((m) => m.valor);

export default class GestorValidacion {
    constructor(store) {
        this.store = store;
    }

    /** Reportes que faltan por revisar. Es lo único que lista el panel. */
    async pendientes() {
        return this.store.getReportsByState(ESTADOS.PENDIENTE);
    }

    /** El reporte es real y se queda en el sistema. */
    async validar(id) {
        return this.store.updateReportStateById(id, ESTADOS.VALIDADO);
    }

    /**
     * El reporte no procede. El motivo es obligatorio: sin él, la operación
     * falla y el reporte sigue pendiente (criterio de aceptación del proyecto).
     */
    async descartar(id, motivo) {
        if (!MOTIVOS_VALIDOS.includes(motivo)) {
            throw new Error(`Descartar exige un motivo válido (${MOTIVOS_VALIDOS.join(', ')}).`);
        }

        return this.store.updateReport(id, { estado: ESTADOS.DESCARTADO, motivo });
    }

    /**
     * El reporte es duplicado de otro: se marca como fusionado y se guarda la
     * referencia al id del original, para no perder que ese problema se
     * reportó varias veces (útil para el tablero del Incremento 3).
     */
    async fusionar(id, idOriginal) {
        if (!idOriginal) {
            throw new Error('Fusionar exige el id del reporte original.');
        }

        if (idOriginal === id) {
            throw new Error('Un reporte no puede ser duplicado de sí mismo.');
        }

        const original = await this.store.getReportById(idOriginal);
        if (!original) {
            throw new Error('El reporte original no existe.');
        }

        if (![ESTADOS.PENDIENTE, ESTADOS.VALIDADO].includes(original.estado)) {
            throw new Error('El original debe estar pendiente o validado.');
        }

        return this.store.updateReport(id, { estado: ESTADOS.FUSIONADO, refOriginal: idOriginal });
    }

    /**
     * Reportes que pueden hacer de "original" al fusionar: cualquiera vivo que
     * no sea el que se está revisando.
     */
    async candidatosFusion(id) {
        const todos = await this.store.getAllReports();
        return todos.filter((r) => r.id !== id
            && [ESTADOS.PENDIENTE, ESTADOS.VALIDADO].includes(r.estado));
    }
}
