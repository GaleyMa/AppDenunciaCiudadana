
import { rpc, firmarFotos } from '../api/SupabaseApi.js';
import { MOTIVOS_DESCARTE } from './GestorValidacion.js';

const MOTIVOS_VALIDOS = MOTIVOS_DESCARTE.map((m) => m.valor);

/**
 * Traduce una fila del servidor a la forma que espera el panel.
 *
 * La foto no viaja como blob sino como URL firmada: el bucket es privado y
 * cada enlace caduca en una hora.
 */
const aReporte = (fila, urlFoto = null) => ({
    id: fila.id,
    categoria: fila.categoria,
    ubicacion: fila.ubicacion_texto || fila.colonia || 'Sin ubicación',
    fecha: fila.fecha,
    estado: fila.estado,
    foto: null,
    fotoUrl: urlFoto,
});

export default class GestorValidacionRemoto {
    constructor(sesion) {
        this.sesion = sesion;
    }

    async #llamar(nombre, parametros) {
        const token = await this.sesion.token();
        if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar.');

        try {
            return await rpc(nombre, parametros, token);
        } catch (error) {
            if (/JWT|token|expired/i.test(error.message)) {
                throw new Error('Tu sesión expiró. Vuelve a entrar.');
            }
            throw error;
        }
    }

    async pendientes() {
        const filas = await this.#llamar('listar_pendientes', { p_limite: 50 });

        const rutas = filas.map((f) => f.foto_ruta).filter(Boolean);
        const firmadas = rutas.length
            ? await firmarFotos(rutas, await this.sesion.token())
            : new Map();

        return filas.map((fila) => aReporte(fila, firmadas.get(fila.foto_ruta) ?? null));
    }

    async validar(id) {
        return this.#llamar('validar_reporte', { p_id: id });
    }

    async descartar(id, motivo) {
        if (!MOTIVOS_VALIDOS.includes(motivo)) {
            throw new Error(`Descartar exige un motivo válido (${MOTIVOS_VALIDOS.join(', ')}).`);
        }

        return this.#llamar('descartar_reporte', { p_id: id, p_motivo: motivo });
    }

    async fusionar(id, idOriginal) {
        if (!idOriginal) throw new Error('Fusionar exige el id del reporte original.');
        if (idOriginal === id) throw new Error('Un reporte no puede ser duplicado de sí mismo.');

        return this.#llamar('fusionar_reporte', { p_id: id, p_ref_original: idOriginal });
    }

    /**
     * Reportes que pueden hacer de original. Incluye los ya validados, que es
     * el caso normal: llega el duplicado de algo que ya se aceptó.
     */
    async candidatosFusion(id) {
        const filas = await this.#llamar('listar_moderables', { p_limite: 100 });
        return filas.filter((fila) => fila.id !== id).map((fila) => aReporte(fila));
    }
}
