// src/reportes/tablero/TableroPublico.js — tablero público de estadísticas.
//
// Lee SOLO agregados del servidor: conteos por colonia, por categoría, por
// semana y por código postal. Nunca pide reportes individuales, porque la API
// no los expone — el anonimato no depende de que esta pantalla se porte bien.
//
// Offline-first: guarda la última respuesta y la muestra, fechada, cuando no
// hay conexión.

import { seleccionar } from '../api/SupabaseApi.js';
import { etiquetaCategoria } from '../datos/categorias.js';
import { barrasHorizontales, serieTemporal, coropletico, leyendaMapa } from './graficas.js';

const CACHE = 'tablero_datos';
const RUTA_GEOJSON = new URL('../datos/cp-mexicali.geojson', import.meta.url);

const crear = (etiqueta, clase, contenido) => {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (contenido !== undefined) nodo.textContent = contenido;
    return nodo;
};

const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short',
});

/** Trae los cinco agregados de una sola vez. */
async function pedirDatos() {
    const [resumen, categorias, colonias, semanas, codigos] = await Promise.all([
        seleccionar('resumen_general'),
        seleccionar('estadisticas_por_categoria', { orden: 'validados.desc' }),
        seleccionar('top_colonias'),
        seleccionar('serie_semanal', { orden: 'semana.asc' }),
        seleccionar('estadisticas_por_cp', { columnas: 'codigo_postal,validados' }),
    ]);

    return { resumen: resumen[0] ?? {}, categorias, colonias, semanas, codigos, obtenido: new Date().toISOString() };
}

function guardarEnCache(datos) {
    try {
        localStorage.setItem(CACHE, JSON.stringify(datos));
    } catch {
        // Sin espacio o en modo privado: el tablero funciona igual en línea.
    }
}

function leerDeCache() {
    try {
        return JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    } catch {
        return null;
    }
}

/** Tarjetas con los números gruesos. Un número no necesita una gráfica. */
function tarjetasResumen(resumen) {
    const datos = [
        ['Reportes validados', resumen.validados ?? 0],
        ['En los últimos 7 días', resumen.validados_ultimos_7_dias ?? 0],
        ['Colonias afectadas', resumen.colonias_afectadas ?? 0],
        ['Categoría más reportada', resumen.categoria_mas_reportada
            ? etiquetaCategoria(resumen.categoria_mas_reportada) : '—'],
    ];

    const rejilla = crear('div', 'tarjetas');
    for (const [rotulo, valor] of datos) {
        const tarjeta = crear('div', 'tarjeta-dato');
        // Una etiqueta de categoría no es una cifra: con el tamaño de número
        // ocupa tres renglones y descuadra la rejilla.
        const clase = typeof valor === 'number' ? 'dato-valor' : 'dato-valor dato-texto';
        tarjeta.appendChild(crear('p', clase, String(valor)));
        tarjeta.appendChild(crear('p', 'dato-rotulo', rotulo));
        rejilla.appendChild(tarjeta);
    }
    return rejilla;
}

function seccion(titulo, ...hijos) {
    const bloque = crear('section', 'tarjeta');
    bloque.appendChild(crear('h2', null, titulo));
    hijos.filter(Boolean).forEach((hijo) => bloque.appendChild(hijo));
    return bloque;
}

/** Tabla de respaldo: el color del mapa nunca debe ser la única vía al dato. */
function tablaCodigos(codigos) {
    const conDatos = codigos.filter((c) => c.validados > 0)
        .sort((a, b) => b.validados - a.validados);

    const detalle = crear('details', 'tabla-desplegable');
    detalle.appendChild(crear('summary', null, `Ver los datos del mapa (${conDatos.length} códigos postales)`));

    if (!conDatos.length) {
        detalle.appendChild(crear('p', 'sin-datos', 'Todavía ningún código postal tiene reportes validados.'));
        return detalle;
    }

    const tabla = crear('table', 'tabla');
    tabla.innerHTML = '<thead><tr><th>Código postal</th><th>Reportes</th></tr></thead>';
    const cuerpo = crear('tbody');
    for (const fila of conDatos) {
        const tr = crear('tr');
        tr.appendChild(crear('td', null, String(fila.codigo_postal)));
        tr.appendChild(crear('td', 'numero', String(fila.validados)));
        cuerpo.appendChild(tr);
    }
    tabla.appendChild(cuerpo);
    detalle.appendChild(tabla);
    return detalle;
}

function tablaColonias(colonias) {
    if (!colonias.length) {
        return crear('p', 'sin-datos', 'Aún no hay colonias con reportes validados.');
    }

    const tabla = crear('table', 'tabla');
    tabla.innerHTML = '<thead><tr><th>Colonia</th><th>Reportes</th></tr></thead>';
    const cuerpo = crear('tbody');
    for (const fila of colonias) {
        const tr = crear('tr');
        tr.appendChild(crear('td', null, fila.colonia));
        tr.appendChild(crear('td', 'numero', String(fila.validados)));
        cuerpo.appendChild(tr);
    }
    tabla.appendChild(cuerpo);
    return tabla;
}

/**
 * Monta el tablero.
 * @param {HTMLElement} contenedor
 */
export default function initTableroPublico(contenedor) {
    let geojson = null;

    async function obtenerGeojson() {
        // Se pide solo cuando se abre el tablero: son 200 KB que no tienen por
        // qué pesar en quien únicamente va a levantar un reporte.
        if (!geojson) geojson = await (await fetch(RUTA_GEOJSON)).json();
        return geojson;
    }

    async function pintar(datos, { desdeCache = false } = {}) {
        contenedor.replaceChildren();

        const cabecera = crear('header', 'panel-cabecera');
        cabecera.appendChild(crear('h1', null, 'Tablero ciudadano'));
        cabecera.appendChild(crear('p', 'panel-conteo',
            'Reportes verificados por moderación · Mexicali, B.C.'));
        contenedor.appendChild(cabecera);

        if (desdeCache) {
            contenedor.appendChild(crear('p', 'aviso-cache',
                `Sin conexión: datos del ${new Date(datos.obtenido).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}.`));
        }

        contenedor.appendChild(tarjetasResumen(datos.resumen));

        // ── Mapa ──
        const valores = new Map(datos.codigos.map((c) => [c.codigo_postal, c.validados]));
        const bloqueMapa = seccion('Dónde se concentran');
        try {
            const { svg, cortes } = coropletico(await obtenerGeojson(), valores);
            bloqueMapa.append(svg, leyendaMapa(cortes));
        } catch {
            bloqueMapa.appendChild(crear('p', 'sin-datos', 'No se pudo cargar el mapa.'));
        }
        bloqueMapa.appendChild(crear('p', 'nota',
            'Agrupado por código postal. Un reporte sin ubicación cuenta en las tablas pero no aparece en el mapa.'));
        bloqueMapa.appendChild(tablaCodigos(datos.codigos));
        contenedor.appendChild(bloqueMapa);

        // ── Categorías ──
        const porCategoria = datos.categorias.map((c) => ({
            etiqueta: etiquetaCategoria(c.categoria), valor: c.validados,
        }));
        contenedor.appendChild(seccion('Qué se reporta',
            porCategoria.length
                ? barrasHorizontales(porCategoria)
                : crear('p', 'sin-datos', 'Aún no hay reportes validados.')));

        // ── Serie semanal ──
        const porSemana = datos.semanas.map((s) => ({
            etiqueta: fechaCorta(s.semana), valor: s.validados,
        }));
        contenedor.appendChild(seccion('Cómo va por semana',
            porSemana.length
                ? serieTemporal(porSemana)
                : crear('p', 'sin-datos', 'Todavía no hay suficientes semanas con datos.')));

        // ── Top 5 ──
        contenedor.appendChild(seccion('Colonias con más reportes', tablaColonias(datos.colonias)));

        const pie = crear('footer', 'panel-pie');
        pie.appendChild(crear('p', null,
            'Solo se cuentan los reportes revisados por moderación. Los datos son anónimos: '
            + 'no existe ningún dato de quien los levantó.'));
        const volver = crear('a', null, 'Volver al formulario');
        volver.href = '#';
        pie.appendChild(volver);
        contenedor.appendChild(pie);
    }

    async function render() {
        contenedor.replaceChildren(crear('p', 'cargando', 'Cargando estadísticas…'));

        try {
            const datos = await pedirDatos();
            guardarEnCache(datos);
            await pintar(datos);
        } catch (error) {
            const cache = leerDeCache();
            if (cache) {
                await pintar(cache, { desdeCache: true });
                return;
            }

            contenedor.replaceChildren();
            contenedor.appendChild(crear('p', 'sin-datos',
                'No se pudieron cargar las estadísticas y no hay datos guardados en este dispositivo. '
                + 'Vuelve a intentar cuando tengas conexión.'));
            console.warn('Tablero:', error.message);
        }
    }

    render();
    return { render };
}
