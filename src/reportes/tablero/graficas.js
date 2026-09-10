// src/reportes/tablero/graficas.js — gráficas en SVG, sin librerías.
//
// Todas las gráficas del tablero son de UNA sola serie (cuántos reportes), así
// que el color no codifica identidad: es un solo verde para las barras y una
// rampa secuencial de un solo tono para el mapa, de claro (pocos) a oscuro
// (muchos). Nada de arcoíris ni de "cada barra de un color", que pintaría de
// categórico algo que es magnitud.

const SVG = 'http://www.w3.org/2000/svg';

/** Rampa secuencial de un solo tono, clara → oscura. Luminosidad monótona. */
export const RAMPA = ['#e8f2ec', '#c2ddd0', '#93c4ae', '#2f8a68', '#0f5132'];
const SERIE = '#157347';
const TINTA_TENUE = '#6b7280';
const EJE = '#d8d4cb';

const crear = (etiqueta, atributos = {}) => {
    const nodo = document.createElementNS(SVG, etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
    return nodo;
};

const texto = (contenido, atributos) => {
    const nodo = crear('text', atributos);
    nodo.textContent = contenido;
    return nodo;
};

/** Tooltip único, compartido por todas las gráficas. */
function tooltip() {
    let caja = document.getElementById('viz-tooltip');
    if (!caja) {
        caja = document.createElement('div');
        caja.id = 'viz-tooltip';
        caja.className = 'viz-tooltip';
        caja.hidden = true;
        document.body.appendChild(caja);
    }
    return caja;
}

/** Engancha el tooltip a un elemento. El área de toque la da el propio mark. */
function conTooltip(elemento, contenido) {
    const caja = tooltip();

    const mostrar = (evento) => {
        caja.textContent = contenido;
        caja.hidden = false;
        const punto = evento.touches?.[0] ?? evento;
        caja.style.left = `${punto.clientX + 12}px`;
        caja.style.top = `${punto.clientY + 12}px`;
    };
    const ocultar = () => { caja.hidden = true; };

    elemento.addEventListener('mousemove', mostrar);
    elemento.addEventListener('mouseleave', ocultar);
    elemento.addEventListener('touchstart', mostrar, { passive: true });
    elemento.addEventListener('touchend', ocultar);
}

/**
 * Barras horizontales: comparar magnitudes entre categorías con nombre largo.
 * Horizontal porque las etiquetas caben; vertical las obligaría a girarse.
 */
export function barrasHorizontales(datos, { unidad = 'reportes' } = {}) {
    const ALTO_BARRA = 22, ESPACIO = 10, ANCHO = 320, IZQUIERDA = 0;
    const alto = datos.length * (ALTO_BARRA + ESPACIO);
    const maximo = Math.max(1, ...datos.map((d) => d.valor));

    const svg = crear('svg', {
        viewBox: `0 0 ${ANCHO} ${alto}`, class: 'grafica', role: 'img',
        'aria-label': `Reportes por categoría, ${datos.length} categorías`,
    });

    datos.forEach((dato, i) => {
        const y = i * (ALTO_BARRA + ESPACIO);
        const ancho = Math.max(2, (dato.valor / maximo) * (ANCHO - 46));

        const grupo = crear('g');
        grupo.appendChild(texto(dato.etiqueta, {
            x: IZQUIERDA, y: y + 9, class: 'grafica-etiqueta', fill: TINTA_TENUE,
        }));
        // rx redondea solo visualmente el extremo del dato; el origen queda
        // anclado en la línea base.
        grupo.appendChild(crear('rect', {
            x: IZQUIERDA, y: y + 14, width: ancho, height: ALTO_BARRA - 8,
            rx: 4, fill: SERIE,
        }));
        grupo.appendChild(texto(dato.valor, {
            x: ancho + 6, y: y + 14 + (ALTO_BARRA - 8) / 2 + 4,
            class: 'grafica-valor', fill: TINTA_TENUE,
        }));

        conTooltip(grupo, `${dato.etiqueta}: ${dato.valor} ${unidad}`);
        svg.appendChild(grupo);
    });

    return svg;
}

/**
 * Barras verticales para la serie semanal. Barras y no línea porque cada
 * semana es un conteo cerrado, no una medición continua.
 */
export function serieTemporal(datos) {
    const ANCHO = 320, ALTO = 130, BASE = ALTO - 22;
    const maximo = Math.max(1, ...datos.map((d) => d.valor));
    const paso = ANCHO / Math.max(datos.length, 1);
    const anchoBarra = Math.max(3, Math.min(26, paso - 4)); // deja el hueco entre barras

    const svg = crear('svg', {
        viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'grafica', role: 'img',
        'aria-label': `Reportes validados por semana, ${datos.length} semanas`,
    });

    // Línea base tenue; sin cuadrícula punteada, que solo mete ruido.
    svg.appendChild(crear('line', {
        x1: 0, y1: BASE, x2: ANCHO, y2: BASE, stroke: EJE, 'stroke-width': 1,
    }));

    // Se rotulan solo dos barras: la más alta y la última. Un número sobre
    // cada barra no se lee, y dejar los valores únicamente en el tooltip
    // volvería el dato inaccesible sin ratón.
    const iMaximo = datos.findIndex((d) => d.valor === maximo);
    const iUltimo = datos.length - 1;

    datos.forEach((dato, i) => {
        const alto = (dato.valor / maximo) * (BASE - 16);
        const x = i * paso + (paso - anchoBarra) / 2;

        const grupo = crear('g');
        grupo.appendChild(crear('rect', {
            x, y: BASE - alto, width: anchoBarra, height: Math.max(alto, 2),
            rx: 4, fill: SERIE,
        }));

        if (i === iMaximo || i === iUltimo) {
            grupo.appendChild(texto(dato.valor, {
                x: x + anchoBarra / 2, y: BASE - alto - 5,
                class: 'grafica-valor', 'text-anchor': 'middle', fill: TINTA_TENUE,
            }));
        }

        conTooltip(grupo, `Semana del ${dato.etiqueta}: ${dato.valor} reportes`);
        svg.appendChild(grupo);
    });

    // Solo primera y última etiqueta: una por barra sería ilegible.
    if (datos.length) {
        svg.appendChild(texto(datos[0].etiqueta, {
            x: 0, y: ALTO - 6, class: 'grafica-eje', fill: TINTA_TENUE,
        }));
        if (datos.length > 1) {
            svg.appendChild(texto(datos.at(-1).etiqueta, {
                x: ANCHO, y: ALTO - 6, class: 'grafica-eje',
                'text-anchor': 'end', fill: TINTA_TENUE,
            }));
        }
    }

    return svg;
}

/** Cortes de la escala del mapa, en función del máximo observado. */
export function calcularCortes(maximo) {
    if (maximo <= 4) return [1, 2, 3, 4];
    const paso = Math.ceil(maximo / 4);
    return [1, paso, paso * 2, paso * 3];
}

const colorDe = (valor, cortes) => {
    if (!valor) return RAMPA[0];
    if (valor < cortes[1]) return RAMPA[1];
    if (valor < cortes[2]) return RAMPA[2];
    if (valor < cortes[3]) return RAMPA[3];
    return RAMPA[4];
};

/**
 * Coroplético por código postal.
 * @param {object} geojson colección de polígonos con propiedad `cp`.
 * @param {Map<number, number>} valores conteo por código postal.
 * @param {object} [opciones]
 * @param {object} [opciones.vialidades] calles principales, para orientarse.
 * @param {(cp: number) => void} [opciones.alSeleccionar] al tocar una zona.
 */
export function coropletico(geojson, valores, { vialidades = null, alSeleccionar = null } = {}) {
    const ANCHO = 320, ALTO = 300;
    const maximo = Math.max(0, ...valores.values());
    const cortes = calcularCortes(maximo);

    // Encuadre: la mancha urbana, no todo el municipio (que llega hasta el
    // golfo y dejaría la ciudad como un punto).
    const CENTRO = { lat: 32.6245, lon: -115.4523 };
    const cerca = (f) => {
        const [x, y] = centroide(f);
        return Math.abs(y - CENTRO.lat) < 0.22 && Math.abs(x - CENTRO.lon) < 0.26;
    };

    // Se dibuja el entorno...
    const visibles = geojson.features.filter(
        (f) => cerca(f) || (valores.get(f.properties.cp) ?? 0) > 0,
    );

    // ...pero el encuadre lo mandan SOLO los polígonos urbanos, que se
    // reconocen por ser mucho más chicos que los ejidales: se toma la mitad de
    // menor superficie. Sin esto, dos o tres polígonos rurales enormes se comen
    // el mapa y la ciudad queda del tamaño de una uña.
    //
    // El encuadre no se abre para incluir zonas con reportes: un solo reporte
    // en un ejido lejano alejaría el mapa y volvería ilegible la ciudad, que es
    // donde está casi todo. Esas zonas siguen contadas en la tabla de abajo.
    const porArea = visibles.map((f) => [f, area(f)]).sort((a, b) => a[1] - b[1]);
    const urbanos = porArea.slice(0, Math.max(1, Math.ceil(porArea.length / 2))).map(([f]) => f);

    const caja = limites(urbanos);
    // Corrección por latitud: sin ella la ciudad sale estirada a lo ancho.
    const escalaX = Math.cos((CENTRO.lat * Math.PI) / 180);
    const anchoGeo = (caja.maxX - caja.minX) * escalaX;
    const altoGeo = caja.maxY - caja.minY;
    const k = Math.min(ANCHO / anchoGeo, ALTO / altoGeo);
    const desplazaX = (ANCHO - anchoGeo * k) / 2;
    const desplazaY = (ALTO - altoGeo * k) / 2;

    const proyecta = ([lon, lat]) => [
        ((lon - caja.minX) * escalaX * k + desplazaX).toFixed(1),
        ((caja.maxY - lat) * k + desplazaY).toFixed(1),
    ];

    const svg = crear('svg', {
        viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'mapa', role: 'img',
        'aria-label': 'Mapa de reportes validados por código postal',
    });

    const zonas = new Map();

    for (const rasgo of visibles) {
        const cp = rasgo.properties.cp;
        const valor = valores.get(cp) ?? 0;
        const camino = crear('path', {
            d: aRuta(rasgo.geometry, proyecta),
            fill: colorDe(valor, cortes),
            // El borde es del color de la superficie: separa los polígonos sin
            // dibujarles un contorno que compita con el dato.
            stroke: '#ffffff', 'stroke-width': 0.5,
            class: 'zona',
        });
        conTooltip(camino, `CP ${cp}: ${valor} ${valor === 1 ? 'reporte' : 'reportes'}`);

        if (alSeleccionar) {
            camino.style.cursor = 'pointer';
            camino.addEventListener('click', () => alSeleccionar(cp));
        }

        zonas.set(cp, camino);
        svg.appendChild(camino);
    }

    // Las calles van ENCIMA de las zonas y debajo de las etiquetas: sirven para
    // reconocer dónde está uno, no son un dato.
    if (vialidades) dibujarVialidades(svg, vialidades, proyecta, ANCHO, ALTO);

    /** Resalta la zona elegida sin recargar el mapa. */
    const marcar = (cp) => {
        for (const [codigo, camino] of zonas) {
            const elegida = codigo === cp;
            camino.setAttribute('stroke', elegida ? '#0f5132' : '#ffffff');
            camino.setAttribute('stroke-width', elegida ? 1.6 : 0.5);
            if (elegida) svg.insertBefore(camino, svg.querySelector('.vialidades'));
        }
    };

    return { svg, cortes, maximo, marcar };
}

/** Calles principales y sus nombres, para ubicarse en el mapa. */
function dibujarVialidades(svg, vialidades, proyecta, ancho, alto) {
    const grupo = crear('g', { class: 'vialidades' });
    const etiquetas = crear('g', { class: 'nombres-via' });
    const colocadas = [];

    // Ordenadas de más larga a más corta: si hay que descartar etiquetas por
    // encimarse, que sobrevivan las avenidas que más estructuran la ciudad.
    const ordenadas = [...vialidades.features].sort(
        (a, b) => (b.properties.l ?? 0) - (a.properties.l ?? 0));

    for (const via of ordenadas) {
        const tramos = via.geometry.type === 'LineString'
            ? [via.geometry.coordinates] : via.geometry.coordinates;

        let masLargo = null;
        let largoMax = 0;

        for (const tramo of tramos) {
            const puntos = tramo.map(proyecta).map(([x, y]) => [Number(x), Number(y)]);
            grupo.appendChild(crear('path', {
                d: `M${puntos.map((p) => p.join(',')).join('L')}`,
                fill: 'none', stroke: '#9aa1a8', 'stroke-width': 0.7,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            }));

            // Se busca el segmento recto más largo, que es donde el nombre cabe
            // sin doblarse.
            for (let i = 0; i < puntos.length - 1; i += 1) {
                const [x1, y1] = puntos[i];
                const [x2, y2] = puntos[i + 1];
                const largo = Math.hypot(x2 - x1, y2 - y1);
                if (largo > largoMax) {
                    largoMax = largo;
                    masLargo = [puntos[i], puntos[i + 1]];
                }
            }
        }

        if (!masLargo || largoMax < 42 || etiquetas.childElementCount >= 7) continue;

        const [[x1, y1], [x2, y2]] = masLargo;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;

        // Ancho aproximado del texto en unidades del viewBox, para no colocar
        // nombres que se salgan del marco ni se encimen entre sí. Medir de
        // verdad exigiría tener el SVG ya en pantalla.
        const medio = (via.properties.nombre.length * 3.3) / 2;

        let angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (angulo > 90) angulo -= 180;
        if (angulo < -90) angulo += 180;

        // El nombre va girado sobre la calle: uno vertical ocupa alto, no
        // ancho. Sin esta cuenta, los de las avenidas norte-sur se cortaban
        // contra el borde de abajo.
        const radianes = (angulo * Math.PI) / 180;
        const alcanceX = Math.abs(Math.cos(radianes)) * medio + 4;
        const alcanceY = Math.abs(Math.sin(radianes)) * medio + 5;

        if (cx - alcanceX < 3 || cx + alcanceX > ancho - 3) continue;
        if (cy - alcanceY < 3 || cy + alcanceY > alto - 3) continue;

        // Dos nombres solo conviven si no se pisan sus recuadros.
        const chocan = colocadas.some(([px, py, palcanceX, palcanceY]) =>
            Math.abs(px - cx) < alcanceX + palcanceX
            && Math.abs(py - cy) < alcanceY + palcanceY + 4);
        if (chocan) continue;

        colocadas.push([cx, cy, alcanceX, alcanceY]);

        const nombre = texto(via.properties.nombre, {
            x: cx, y: cy - 2, class: 'nombre-via', 'text-anchor': 'middle',
            transform: `rotate(${angulo.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`,
        });
        etiquetas.appendChild(nombre);
    }

    svg.append(grupo, etiquetas);
}

/** Leyenda de la escala del mapa: el color solo no basta para leer un valor. */
export function leyendaMapa(cortes) {
    const contenedor = document.createElement('ul');
    contenedor.className = 'leyenda';

    const rotulos = [
        'Sin reportes',
        cortes[1] - cortes[0] <= 1 ? `${cortes[0]}` : `${cortes[0]}–${cortes[1] - 1}`,
        cortes[2] - cortes[1] <= 1 ? `${cortes[1]}` : `${cortes[1]}–${cortes[2] - 1}`,
        cortes[3] - cortes[2] <= 1 ? `${cortes[2]}` : `${cortes[2]}–${cortes[3] - 1}`,
        `${cortes[3]} o más`,
    ];

    rotulos.forEach((rotulo, i) => {
        const fila = document.createElement('li');
        const muestra = document.createElement('span');
        muestra.className = 'muestra';
        muestra.style.backgroundColor = RAMPA[i];
        fila.append(muestra, document.createTextNode(rotulo));
        contenedor.appendChild(fila);
    });

    return contenedor;
}

// ─── Utilidades geométricas ─────────────────────────────────────────────────

function anillos(geometria) {
    return geometria.type === 'Polygon'
        ? geometria.coordinates
        : geometria.coordinates.flat();
}

function aRuta(geometria, proyecta) {
    return anillos(geometria).map((anillo) => {
        const puntos = anillo.map((punto) => proyecta(punto).join(','));
        return `M${puntos.join('L')}Z`;
    }).join('');
}

function centroide(rasgo) {
    const puntos = anillos(rasgo.geometry).flat();
    const suma = puntos.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [suma[0] / puntos.length, suma[1] / puntos.length];
}

/** Superficie aproximada (fórmula del cordón), solo para comparar tamaños. */
function area(rasgo) {
    return anillos(rasgo.geometry).reduce((total, anillo) => {
        let suma = 0;
        for (let i = 0; i < anillo.length - 1; i += 1) {
            suma += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1];
        }
        return total + Math.abs(suma) / 2;
    }, 0);
}

function limites(rasgos) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rasgo of rasgos) {
        for (const [x, y] of anillos(rasgo.geometry).flat()) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    return { minX, minY, maxX, maxY };
}
