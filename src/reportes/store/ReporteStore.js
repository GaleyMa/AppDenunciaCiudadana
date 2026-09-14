// src/reportes/store/ReporteStore.js — capa de persistencia (IndexedDB nativa, sin librerías).
//
// Responsabilidad única: guardar y leer reportes. No sabe nada de UI ni de
// reglas de negocio (validar/descartar/fusionar viven en GestorValidacion).

const DATABASE_NAME = 'denuncia_ciudadana';
export const BASE_PRUEBAS = 'denuncia_ciudadana_pruebas';
const DATABASE_VERSION = 2; // v2: id UUID (sin autoIncrement) + índice 'estado'
const STORE_NAME = 'reportes';
const INDEX_ESTADO = 'estado';

// Estados válidos de un reporte. Se exportan para que el panel y el gestor
// no anden repitiendo strings sueltos.
export const ESTADOS = Object.freeze({
    PENDIENTE: 'pendiente',
    VALIDADO: 'validado',
    DESCARTADO: 'descartado',
    FUSIONADO: 'fusionado',
});

/**
 * Genera el id del reporte con API nativa del navegador.
 *
 * ANONIMATO: el id es aleatorio y no deriva de ningún dato del usuario ni del
 * orden de captura, así que no identifica al autor ni revela cuántos reportes
 * hay (a diferencia de los ids secuenciales de autoIncrement).
 *
 * crypto.randomUUID() requiere contexto seguro (localhost o HTTPS), que es
 * justo donde corre una PWA. El fallback usa crypto.getRandomValues(), también
 * nativo, para entornos que no lo expongan (ej. abrir el archivo con file://).
 */
function generarId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: UUID v4 armado a mano a partir de 16 bytes aleatorios.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default class ReporteStore {
    /**
     * @param {string} [nombreBase] base a abrir. Se parametriza para que las
     * páginas de pruebas usen una base aparte y no borren los reportes reales.
     */
    constructor(nombreBase = DATABASE_NAME) {
        this.nombreBase = nombreBase;
        this.db = null;
        this.ready = null;
        // La apertura de IndexedDB es asíncrona y el constructor no puede
        // esperarla. En vez de dejar `this.db` en null hasta que termine
        // (lo que hacía fallar a quien guardara un reporte muy rápido),
        // guardamos la PROMESA y cada método hace await de ella.
        this.#conectar();
    }

    /** Arranca la apertura y guarda la promesa. */
    #conectar() {
        this.ready = this.#abrirBase();

        // Evita un "unhandled rejection" en consola si la base falla y nadie
        // llamó todavía a ningún método. El error sigue llegando a quien
        // haga await de this.ready más adelante.
        this.ready.catch(() => { });

        return this.ready;
    }

    /**
     * Conexión lista para usar. Si se cerró (otra pestaña migró la base, o la
     * borraste desde DevTools con la app abierta), reabre en vez de quedarse
     * muerta con "Can't start a transaction on a closed database".
     */
    #getDb() {
        return this.ready ?? this.#conectar();
    }

    /**
     * Abre (y migra si hace falta) la base. Resuelve con la conexión.
     * Método privado: solo el constructor lo llama, una única vez.
     */
    #abrirBase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.nombreBase, DATABASE_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // IndexedDB NO permite cambiar keyPath ni autoIncrement de un
                // object store existente: la única vía es borrarlo y volverlo
                // a crear. Esto descarta los reportes guardados con la v1
                // (ids numéricos), que en desarrollo son datos de prueba.
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

                // Índice que hacía falta: sin él, getReportsByState() truena.
                // Es el que usa el ValidacionPanel para listar los pendientes.
                objectStore.createIndex(INDEX_ESTADO, 'estado', { unique: false });
            };

            request.onsuccess = (event) => {
                const db = event.target.result;

                // Si otra pestaña pide una versión más nueva (o borran la
                // base), cerramos esta conexión para no bloquear la migración
                // y olvidamos la promesa: la próxima operación reabrirá.
                db.onversionchange = () => {
                    db.close();
                    this.db = null;
                    this.ready = null;
                };

                this.db = db; // se mantiene por comodidad al depurar
                resolve(db);
            };

            request.onerror = (event) => reject(event.target.error);

            // Ocurre cuando otra pestaña tiene abierta la versión anterior.
            request.onblocked = () => reject(new Error(
                'La migración de la base está bloqueada: cierra las demás pestañas de la app.'
            ));
        });
    }

    /**
     * Guarda un reporte nuevo. Le asigna un id anónimo si no trae uno.
     * Devuelve el id con el que quedó guardado.
     */
    async saveReport(report) {
        const db = await this.#getDb();
        const reporte = { ...report, id: report.id ?? generarId() };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.add(reporte);

            request.onsuccess = () => resolve(reporte.id);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /** Todos los reportes, sin filtrar por estado. */
    async getAllReports() {
        const db = await this.#getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const request = transaction.objectStore(STORE_NAME).getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /** Reportes en un estado dado (ej. 'pendiente' para el ValidacionPanel). */
    async getReportsByState(state) {
        const db = await this.#getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const index = objectStore.index(INDEX_ESTADO);
            const request = index.getAll(state);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /** Un reporte por id. Resuelve con undefined si no existe. */
    async getReportById(id) {
        const db = await this.#getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const request = transaction.objectStore(STORE_NAME).get(id);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Aplica cambios parciales a un reporte y lo devuelve ya actualizado.
     * Sirve para las acciones que tocan varios campos a la vez (descartar
     * guarda estado + motivo; fusionar guarda estado + refOriginal), todo
     * dentro de la misma transacción.
     */
    async updateReport(id, cambios) {
        const db = await this.#getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.get(id);

            request.onsuccess = (event) => {
                const reporte = event.target.result;
                if (!reporte) {
                    reject(new Error(`No existe el reporte ${id}.`));
                    return;
                }

                // El id nunca se sobrescribe, aunque venga en los cambios.
                const actualizado = { ...reporte, ...cambios, id: reporte.id };
                const updateRequest = objectStore.put(actualizado);

                updateRequest.onsuccess = () => resolve(actualizado);
                updateRequest.onerror = (updateEvent) => reject(updateEvent.target.error);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    /** Atajo para el caso más común: cambiar solo el estado. */
    async updateReportStateById(id, state) {
        return this.updateReport(id, { estado: state });
    }
}
