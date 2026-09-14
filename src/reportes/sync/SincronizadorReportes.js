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

        // Mientras la migración del catálogo no esté aplicada, la columna
        // codigo_postal no existe y el servidor responde 42703. Se reintenta
        // sin ella para que la sincronización no se detenga por eso.
        let filas;
        try {
            filas = await seleccionar('colonias', { columnas: 'id,nombre,codigo_postal', limite: 2000 });
        } catch (error) {
            if (!/42703|does not exist/i.test(error.message)) throw error;
            console.warn('El servidor aún no tiene el catálogo con código postal.');
            filas = await seleccionar('colonias', { columnas: 'id,nombre', limite: 2000 });
        }

        this.colonias = filas.map((c) => ({
            id: c.id, normalizado: normalizar(c.nombre), cp: c.codigo_postal ?? null,
        }));
        return this.colonias;
    }

    /**
     * Encuentra el colonia_id del servidor.
     *
     * Si la persona eligió un asentamiento del catálogo, la pareja
     * nombre + código postal lo identifica sin ambigüedad — y hace falta,
     * porque hay nombres repetidos en distintos códigos postales ("Nueva"
     * existe en varios).
     *
     * Si escribió texto libre, se busca el asentamiento más largo contenido en
     * él ("Nueva, calle Mérida 120" → Nueva). Si nada casa, devuelve null: vale
     * más un reporte sin colonia que con una mal adivinada.
     */
    async #coloniaId(reporte) {
        const colonias = await this.#obtenerColonias();

        if (reporte.asentamiento && reporte.codigoPostal) {
            const elegida = colonias.find((c) => c.cp === reporte.codigoPostal
                && c.normalizado === normalizar(reporte.asentamiento));
            if (elegida) return elegida.id;
        }

        const texto = reporte.ubicacion;
        if (!texto) return null;
        const buscado = normalizar(texto);

        const exacta = colonias.find((c) => c.normalizado === buscado);
        if (exacta) return exacta.id;

        const contenidas = colonias
            .filter((c) => c.normalizado.length >= 4 && buscado.includes(c.normalizado))
            .sort((a, b) => b.normalizado.length - a.normalizado.length);

        return contenidas.length ? contenidas[0].id : null;
    }

    /**
     * Registra el reporte en el servidor.
     *
     * Si el proyecto todavía no tiene la migración del código postal declarado,
     * PostgREST responde que no encuentra la función con esos parámetros. En
     * ese caso se reintenta sin el CP, para que la captura siga funcionando
     * mientras la migración se aplica.
     */
    async #registrar(datos) {
        try {
            return await rpc('crear_reporte', datos);
        } catch (error) {
            if (!/PGRST202|Could not find the function|no matches were found/i.test(error.message)) {
                throw error;
            }

            console.warn('El servidor aún no acepta el código postal declarado; se envía sin él.');
            const { p_codigo_postal, ...sinCp } = datos;
            return rpc('crear_reporte', sinCp);
        }
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

                    await this.#registrar({
                        p_id: reporte.id,
                        p_categoria: reporte.categoria,
                        p_colonia_id: await this.#coloniaId(reporte),
                        p_ubicacion_texto: reporte.ubicacion ?? null,
                        p_lat: reporte.lat ?? null,
                        p_lon: reporte.lon ?? null,
                        p_fecha: reporte.fecha ?? null,
                        p_foto_ruta: rutaFoto,
                        p_codigo_postal: reporte.codigoPostal ?? null,
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
     *
     * OJO: solo puede reparar los reportes cuya foto sigue en ESTE dispositivo.
     * Un reporte levantado en otro navegador (o en otro origen, que para
     * IndexedDB es otro sitio) no tiene aquí su imagen y no hay de dónde
     * sacarla.
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
