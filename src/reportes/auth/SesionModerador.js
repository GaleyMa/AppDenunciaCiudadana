
import { SUPABASE_AUTH_URL, SUPABASE_ANON_KEY } from '../../config.js';

const CLAVE = 'sesion_moderador';
const MARGEN_RENOVACION = 60_000;

/** Traduce los errores de Supabase, que llegan en inglés y en varias formas. */
function explicar(detalle, estado) {
    const crudo = detalle?.error_description || detalle?.msg || detalle?.message || '';

    if (estado === 400 || /invalid login/i.test(crudo)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(crudo)) return 'La cuenta todavía no está confirmada.';
    if (estado === 429) return 'Demasiados intentos. Espera un momento.';
    return crudo || 'No se pudo iniciar sesión.';
}

export default class SesionModerador {
    constructor() {
        this.sesion = this.#leer();
    }

    #leer() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
        } catch {
            return null;
        }
    }

    #guardar(datos) {
        this.sesion = datos;
        try {
            if (datos) localStorage.setItem(CLAVE, JSON.stringify(datos));
            else localStorage.removeItem(CLAVE);
        } catch {
        }
    }

    /** ¿Hay sesión guardada? No garantiza que siga siendo válida. */
    activa() {
        return Boolean(this.sesion?.access_token);
    }

    correo() {
        return this.sesion?.correo ?? null;
    }

    async #pedirToken(cuerpo, tipo) {
        const respuesta = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=${tipo}`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
        });

        const detalle = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(explicar(detalle, respuesta.status));

        this.#guardar({
            access_token: detalle.access_token,
            refresh_token: detalle.refresh_token,
            correo: detalle.user?.email ?? this.sesion?.correo ?? null,
            expira_en: Date.now() + (detalle.expires_in ?? 3600) * 1000,
        });

        return this.sesion;
    }

    async iniciar(correo, contrasena) {
        if (!correo || !contrasena) throw new Error('Escribe tu correo y tu contraseña.');
        return this.#pedirToken({ email: correo.trim(), password: contrasena }, 'password');
    }

    /**
     * Token vigente para llamar a las funciones de moderación. Renueva solo si
     * está por vencer; si la renovación falla, la sesión se descarta.
     */
    async token() {
        if (!this.activa()) return null;

        if (Date.now() > this.sesion.expira_en - MARGEN_RENOVACION) {
            try {
                await this.#pedirToken({ refresh_token: this.sesion.refresh_token }, 'refresh_token');
            } catch {
                this.#guardar(null);
                return null;
            }
        }

        return this.sesion.access_token;
    }

    async cerrar() {
        const token = this.sesion?.access_token;
        this.#guardar(null);

        if (!token) return;
        await fetch(`${SUPABASE_AUTH_URL}/logout`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        }).catch(() => { });
    }
}
