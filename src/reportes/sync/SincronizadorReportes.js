// src/reportes/sync/SincronizadorReportes.js — cola de envío al servidor.
//
// La app sigue siendo offline-first: el reporte SIEMPRE se guarda primero en
// IndexedDB y se marca como no sincronizado. Este módulo lo empuja a Supabase
// cuando hay conexión, y reintenta después si no la hubo.
//
// El servidor acepta el mismo id que generó el cliente y la operación es
// idempotente, así que reintentar nunca duplica un reporte.

import { rpc, seleccionar, hayConexion } from '../api/SupabaseApi.js';

/** Para comparar "Cuauhtémoc Norte" con lo que se haya tecleado. */
const normalizar = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default class SincronizadorReportes {
    constructor(store) {
        this.store = store;
        this.enCurso = false;
        this.colonias = null; // se pide una vez por sesión
    }

    /** Catálogo de colonias del servidor, para traducir el texto a colonia_id. */
    async #obtenerColonias() {
        if (this.colonias) return this.colonias;

        const filas = await seleccionar('colonias', { columnas: 'id,nombre' });
        this.colonias = filas.map((c) => ({ id: c.id, normalizado: normalizar(c.nombre) }));
        return this.colonias;
    }

    /**
     * Traduce el texto libre de ubicación a un colonia_id.
     * Coincidencia exacta primero; si no, la colonia más larga que aparezca
     * dentro del texto ("Nueva, calle Mérida 120" → Nueva). Si nada casa,
     * devuelve null: el reporte se guarda sin colonia antes que con una mal
     * adivinada.
     */
    async #coloniaId(texto) {
        if (!texto) return null;

        const colonias = await this.#obtenerColonias();
        const buscado = normalizar(texto);

        const exacta = colonias.find((c) => c.normalizado === buscado);
        if (exacta) return exacta.id;

        const contenidas = colonias
            .filter((c) => buscado.includes(c.normalizado))
            .sort((a, b) => b.normalizado.length - a.normalizado.length);

        return contenidas.length ? contenidas[0].id : null;
    }

    /**
     * Envía los reportes que aún no llegaron al servidor.
     * @returns {Promise<{enviados: number, pendientes: number, error?: string}>}
     */
    async sincronizar() {
        if (this.enCurso) return { enviados: 0, pendientes: 0 };
        if (!hayConexion()) return { enviados: 0, pendientes: 0, error: 'sin conexión' };

        this.enCurso = true;
        let enviados = 0;

        try {
            const porEnviar = (await this.store.getAllReports())
                .filter((reporte) => !reporte.sincronizado);

            for (const reporte of porEnviar) {
                try {
                    await rpc('crear_reporte', {
                        p_id: reporte.id,
                        p_categoria: reporte.categoria,
                        p_colonia_id: await this.#coloniaId(reporte.ubicacion),
                        p_ubicacion_texto: reporte.ubicacion ?? null,
                        p_lat: reporte.lat ?? null,
                        p_lon: reporte.lon ?? null,
                        p_fecha: reporte.fecha ?? null,
                    });

                    // La foto no se sube todavía: falta configurar Storage con
                    // un bucket privado (una foto puede traer rostros o EXIF).
                    await this.store.updateReport(reporte.id, {
                        sincronizado: true,
                        sincronizadoEn: new Date().toISOString(),
                    });
                    enviados += 1;
                } catch (error) {
                    // Un fallo suele ser de red: si se cayó uno, se caerán los
                    // demás. Se corta y se reintenta en la próxima oportunidad.
                    console.warn('No se pudo sincronizar el reporte', reporte.id, error.message);
                    return { enviados, pendientes: porEnviar.length - enviados, error: error.message };
                }
            }

            return { enviados, pendientes: 0 };
        } finally {
            this.enCurso = false;
        }
    }

    /**
     * Sincroniza ahora y deja programado un reintento para cuando el navegador
     * recupere la conexión.
     */
    iniciar() {
        const intentar = () => this.sincronizar().catch(() => { });
        window.addEventListener('online', intentar);
        intentar();
    }
}
