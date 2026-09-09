// src/reportes/sync/SincronizadorReportes.js — cola de envío al servidor.
//
// La app sigue siendo offline-first: el reporte SIEMPRE se guarda primero en
// IndexedDB y se marca como no sincronizado. Este módulo lo empuja a Supabase
// cuando hay conexión, y reintenta después si no la hubo.
//
// El servidor acepta el mismo id que generó el cliente y la operación es
// idempotente, así que reintentar nunca duplica un reporte.

import { rpc, seleccionar, subirFoto, hayConexion } from '../api/SupabaseApi.js';

/** Extensión a partir del tipo, para que el archivo se llame como lo que es. */
const EXTENSIONES = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
};

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
     * Sube la foto al bucket privado y devuelve su ruta.
     *
     * Si el servidor RECHAZA el archivo (muy grande, tipo no permitido), el
     * reporte se manda igual sin foto: vale más un reporte sin imagen que
     * perderlo. Si el fallo es de red, se propaga para reintentar después.
     */
    async #subirFotoDe(reporte) {
        if (reporte.fotoRuta) return reporte.fotoRuta;         // ya estaba subida
        if (!(reporte.foto instanceof Blob)) return null;      // reporte sin foto

        const extension = EXTENSIONES[reporte.foto.type] ?? 'bin';
        const ruta = `${reporte.id}.${extension}`;

        try {
            await subirFoto(ruta, reporte.foto);
        } catch (error) {
            if (error.estado && error.estado < 500 && error.estado !== 429) {
                console.warn('La foto no se pudo subir, el reporte va sin ella:', error.message);
                return null;
            }
            throw error;
        }

        // Se recuerda la ruta: si el alta del reporte falla, el reintento no
        // vuelve a subir la imagen.
        await this.store.updateReport(reporte.id, { fotoRuta: ruta });
        return ruta;
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
                    const rutaFoto = await this.#subirFotoDe(reporte);

                    await rpc('crear_reporte', {
                        p_id: reporte.id,
                        p_categoria: reporte.categoria,
                        p_colonia_id: await this.#coloniaId(reporte.ubicacion),
                        p_ubicacion_texto: reporte.ubicacion ?? null,
                        p_lat: reporte.lat ?? null,
                        p_lon: reporte.lon ?? null,
                        p_fecha: reporte.fecha ?? null,
                        p_foto_ruta: rutaFoto,
                    });

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

            await this.#adjuntarFotosPendientes();
            return { enviados, pendientes: 0 };
        } finally {
            this.enCurso = false;
        }
    }

    /**
     * Sube las fotos de los reportes que ya se habían sincronizado antes de que
     * existiera el bucket. Sin esto se quedarían sin imagen para siempre, y el
     * moderador tendría que validar a ciegas.
     */
    async #adjuntarFotosPendientes() {
        const rezagados = (await this.store.getAllReports()).filter(
            (r) => r.sincronizado && !r.fotoRuta && r.foto instanceof Blob,
        );

        for (const reporte of rezagados) {
            try {
                const ruta = await this.#subirFotoDe(reporte);
                if (!ruta) continue;

                const adjuntada = await rpc('adjuntar_foto', { p_id: reporte.id, p_foto_ruta: ruta });
                // Si el servidor dice que no (ya tenía foto, o ya fue moderado),
                // no se vuelve a intentar: la marca local evita el bucle.
                if (!adjuntada) await this.store.updateReport(reporte.id, { fotoRuta: ruta });
            } catch (error) {
                console.warn('No se pudo adjuntar la foto de', reporte.id, error.message);
                return; // suele ser de red: se reintenta en la próxima vuelta
            }
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
