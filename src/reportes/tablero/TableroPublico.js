
import { seleccionar } from '../api/SupabaseApi.js';
import { etiquetaCategoria } from '../datos/categorias.js';
import ASENTAMIENTOS_MEXICALI from '../datos/asentamientos-mexicali.js';
import { barrasHorizontales, serieTemporal, coropletico, leyendaMapa } from './graficas.js';

const CACHE = 'tablero_datos';
const RUTA_GEOJSON = new URL('../datos/cp-mexicali.geojson', import.meta.url);
const RUTA_MARCO_MAPA = new URL('../datos/mapa-base-marco.json', import.meta.url);
const RUTA_IMAGEN_MAPA = new URL('../datos/mapa-base-mexicali.webp', import.meta.url);

/** Colonias de un código postal, del catálogo local. */
const coloniasDe = (cp) => ASENTAMIENTOS_MEXICALI
    .filter((a) => a.cp === cp)
    .map((a) => a.n);

const crear = (etiqueta, clase, contenido) => {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (contenido !== undefined) nodo.textContent = contenido;
    return nodo;
};

const fechaCorta = (iso) => {
    const fecha = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return String(iso);
    return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

/** Trae los cinco agregados de una sola vez. */
async function pedirDatos() {
    const [resumen, categorias, colonias, semanas, codigos, porZona] = await Promise.all([
        seleccionar('resumen_general'),
        seleccionar('estadisticas_por_categoria', { orden: 'validados.desc' }),
        seleccionar('top_colonias'),
        seleccionar('serie_semanal', { orden: 'semana.asc' }),
        seleccionar('estadisticas_por_cp', { columnas: 'codigo_postal,validados,reporte_mas_reciente' })
            .catch(() => seleccionar('estadisticas_por_cp', { columnas: 'codigo_postal,validados' })),
        seleccionar('estadisticas_por_cp_categoria', { limite: 2000 }).catch(() => []),
    ]);

    return {
        resumen: resumen[0] ?? {}, categorias, colonias, semanas, codigos, porZona,
        obtenido: new Date().toISOString(),
    };
}

function guardarEnCache(datos) {
    try {
        localStorage.setItem(CACHE, JSON.stringify(datos));
    } catch {
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

/**
 * Ficha de la zona elegida: qué colonias abarca y de qué han sido los reportes.
 * El mapa por sí solo dice "aquí hay muchos"; esto dice de qué.
 */
function fichaZona(cp, datos) {
    const ficha = crear('div', 'ficha-zona');

    const fila = crear('div', 'ficha-cabecera');
    fila.appendChild(crear('h3', null, `Código postal ${cp}`));
    const total = datos.codigos.find((c) => c.codigo_postal === cp)?.validados ?? 0;
    fila.appendChild(crear('span', 'ficha-total',
        `${total} ${total === 1 ? 'reporte' : 'reportes'}`));
    ficha.appendChild(fila);

    const colonias = coloniasDe(cp);
    if (colonias.length) {
        const listadas = colonias.slice(0, 6).join(' · ');
        ficha.appendChild(crear('p', 'ficha-colonias',
            colonias.length > 6 ? `${listadas} y ${colonias.length - 6} más` : listadas));
    }

    const desglose = datos.porZona
        .filter((d) => d.codigo_postal === cp)
        .sort((a, b) => b.validados - a.validados);

    if (!desglose.length) {
        ficha.appendChild(crear('p', 'nota', 'Sin reportes validados en esta zona todavía.'));
        return ficha;
    }

    const lista = crear('ul', 'ficha-categorias');
    for (const linea of desglose) {
        const elemento = crear('li');
        elemento.append(
            crear('span', null, etiquetaCategoria(linea.categoria)),
            crear('strong', null, String(linea.validados)),
        );
        lista.appendChild(elemento);
    }
    ficha.appendChild(lista);

    const reciente = datos.codigos.find((c) => c.codigo_postal === cp)?.reporte_mas_reciente;
    if (reciente) {
        ficha.appendChild(crear('p', 'nota',
            `Último reporte: ${new Date(reciente).toLocaleDateString('es-MX', { dateStyle: 'medium' })}`));
    }

    return ficha;
}

/** Tabla de respaldo: el color del mapa nunca debe ser la única vía al dato. */
function tablaCodigos(codigos, alElegir = null) {
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

        if (alElegir) {
            tr.tabIndex = 0;
            tr.className = 'fila-elegible';
            tr.addEventListener('click', () => alElegir(fila.codigo_postal));
            tr.addEventListener('keydown', (evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    alElegir(fila.codigo_postal);
                }
            });
        }

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
    let marcarZona = () => { };

    let fondoMapa = null;

    async function obtenerGeojson() {
        if (!geojson) geojson = await (await fetch(RUTA_GEOJSON)).json();
        return geojson;
    }

    async function obtenerFondo() {
        if (fondoMapa === null) {
            fondoMapa = await fetch(RUTA_MARCO_MAPA)
                .then((r) => r.json())
                .then((marco) => ({ ...marco, imagen: String(RUTA_IMAGEN_MAPA) }))
                .catch(() => false);
        }
        return fondoMapa || null;
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

        const valores = new Map(datos.codigos.map((c) => [c.codigo_postal, c.validados]));
        const rejilla = crear('div', 'rejilla');

        const bloqueMapa = seccion('Dónde se concentran');
        bloqueMapa.classList.add('bloque-mapa');
        const hueco = crear('div', 'ficha-hueco');

        try {
            const fondo = await obtenerFondo();
            const { svg, cortes, marcar, centro } = coropletico(await obtenerGeojson(), valores, {
                fondo,
                alSeleccionar: (cp) => {
                    marcarZona(cp);
                    hueco.replaceChildren(fichaZona(cp, datos));
                },
            });
            marcarZona = marcar;

            const marco = crear('div', 'mapa-marco');
            marco.appendChild(svg);
            const aviso = crear('p', 'nota-mapa', 'Desliza el mapa para recorrer la ciudad.');
            aviso.hidden = true;
            bloqueMapa.append(marco, aviso, leyendaMapa(cortes), hueco);

            if (fondo?.atribucion) {
                bloqueMapa.appendChild(crear('p', 'atribucion',
                    `Mapa base: ${fondo.atribucion} (CC BY-SA)`));
            }

            requestAnimationFrame(() => {
                marco.scrollLeft = Math.max(0, centro.x - marco.clientWidth / 2);
                marco.scrollTop = Math.max(0, centro.y - marco.clientHeight / 2);

                aviso.hidden = marco.scrollWidth <= marco.clientWidth
                    && marco.scrollHeight <= marco.clientHeight;
            });
        } catch {
            bloqueMapa.appendChild(crear('p', 'sin-datos', 'No se pudo cargar el mapa.'));
        }

        bloqueMapa.appendChild(crear('p', 'nota',
            'Toca una zona para ver sus colonias y de qué han sido los reportes. '
            + 'El mapa encuadra la mancha urbana y agrupa por código postal: los reportes del '
            + 'valle, y los que no traen ubicación, cuentan en las tablas aunque no se vean aquí.'));
        bloqueMapa.appendChild(tablaCodigos(datos.codigos, (cp) => {
            marcarZona(cp);
            hueco.replaceChildren(fichaZona(cp, datos));
            hueco.scrollIntoView({ block: 'nearest' });
        }));
        rejilla.appendChild(bloqueMapa);
        contenedor.appendChild(rejilla);

        const porCategoria = datos.categorias.map((c) => ({
            etiqueta: etiquetaCategoria(c.categoria), valor: c.validados,
        }));
        rejilla.appendChild(seccion('Qué se reporta',
            porCategoria.length
                ? barrasHorizontales(porCategoria)
                : crear('p', 'sin-datos', 'Aún no hay reportes validados.')));

        const porSemana = datos.semanas.map((s) => ({
            etiqueta: fechaCorta(s.semana), valor: s.validados,
        }));
        rejilla.appendChild(seccion('Cómo va por semana',
            porSemana.length
                ? serieTemporal(porSemana)
                : crear('p', 'sin-datos', 'Todavía no hay suficientes semanas con datos.')));

        rejilla.appendChild(seccion('Colonias con más reportes', tablaColonias(datos.colonias)));

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
