// src/reportes/api/SupabaseApi.js — cliente REST mínimo.
//
// No se usa @supabase/supabase-js: son ~40 KB para lo que aquí son dos
// llamadas fetch. El proyecto es de cero librerías en el cliente y esto lo
// respeta sin perder nada.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

const TIEMPO_LIMITE = 12000;

/**
 * Cabeceras comunes. `apikey` siempre es la llave publishable; el Bearer es la
 * sesión del moderador cuando la hay, y la misma llave cuando no. Así el
 * servidor sabe si quien llama es un anónimo o una cuenta con sesión.
 */
function cabeceras(extra = {}, token = null) {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token ?? SUPABASE_ANON_KEY}`,
        ...extra,
    };
}

/** fetch con límite de tiempo: en señal intermitente, colgarse es lo peor. */
async function pedir(url, opciones = {}) {
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TIEMPO_LIMITE);

    try {
        const respuesta = await fetch(url, { ...opciones, signal: corte.signal });

        if (!respuesta.ok) {
            // PostgREST devuelve {code, message, hint} en los errores.
            const detalle = await respuesta.json().catch(() => ({}));
            throw new Error(detalle.message || `HTTP ${respuesta.status}`);
        }

        return respuesta.status === 204 ? null : respuesta.json();
    } finally {
        clearTimeout(reloj);
    }
}

/**
 * Llama a una función del servidor (RPC).
 * @param {string} [token] sesión del moderador, para las funciones que la exigen.
 */
export async function rpc(nombre, parametros = {}, token = null) {
    return pedir(`${SUPABASE_URL}/rpc/${nombre}`, {
        method: 'POST',
        headers: cabeceras({ 'Content-Type': 'application/json' }, token),
        body: JSON.stringify(parametros),
    });
}

/** Lee una vista o tabla pública. */
export async function seleccionar(recurso, { columnas = '*', orden, limite } = {}) {
    const parametros = new URLSearchParams({ select: columnas });
    if (orden) parametros.set('order', orden);
    if (limite) parametros.set('limit', String(limite));

    return pedir(`${SUPABASE_URL}/${recurso}?${parametros}`, { headers: cabeceras() });
}

/** ¿Hay conexión? El navegador puede equivocarse, así que es solo una pista. */
export const hayConexion = () => navigator.onLine !== false;
