// src/reportes/api/SupabaseApi.js — cliente REST mínimo.
//
// No se usa @supabase/supabase-js: son ~40 KB para lo que aquí son dos
// llamadas fetch. El proyecto es de cero librerías en el cliente y esto lo
// respeta sin perder nada.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

const TIEMPO_LIMITE = 12000;

/** Cabeceras comunes. La misma llave va en apikey y en Authorization. */
function cabeceras(extra = {}) {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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

/** Llama a una función del servidor (RPC). */
export async function rpc(nombre, parametros = {}) {
    return pedir(`${SUPABASE_URL}/rpc/${nombre}`, {
        method: 'POST',
        headers: cabeceras({ 'Content-Type': 'application/json' }),
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
