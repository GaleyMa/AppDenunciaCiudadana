// src/config.js — configuración de la app.

/**
 * Token de acceso al panel de validación. La URL secreta es:
 *
 *     index.html#/validacion/d027312f69fd2b2874d67188bbc94576f971662f5878a47e
 *
 * Se usa el hash (#) y no un parámetro de query porque el hash no se manda al
 * servidor y no necesita configuración de rutas: funciona con la app servida
 * como archivos estáticos y sin conexión.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIMITACIÓN RECONOCIDA — ESTO NO ES SEGURIDAD REAL.
 *
 * El token viaja en el código del cliente: cualquiera que abra el bundle o el
 * repositorio puede leerlo, y la URL puede filtrarse al compartirla. Es una
 * medida de ofuscación mínima, aceptable solo para el MVP académico.
 *
 * La autenticación real (login de moderadores o verificación del lado del
 * servidor) queda como incremento futuro, junto con el backend. Mientras tanto,
 * el daño posible está acotado: el panel no expone datos personales porque los
 * reportes son anónimos, y todo vive en el IndexedDB de este dispositivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const TOKEN_PANEL = 'd027312f69fd2b2874d67188bbc94576f971662f5878a47e';

/** Prefijo de la ruta del panel dentro del hash. */
export const RUTA_PANEL = '#/validacion/';
