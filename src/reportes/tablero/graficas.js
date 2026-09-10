// src/reportes/tablero/graficas.js — gráficas en SVG, sin librerías.
//
// Todas las gráficas del tablero son de UNA sola serie (cuántos reportes), así
// que el color no codifica identidad: es un solo verde para las barras y una
// rampa secuencial de un solo tono para el mapa, de claro (pocos) a oscuro
// (muchos). Nada de arcoíris ni de "cada barra de un color", que pintaría de
// categórico algo que es magnitud.

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Rampa secuencial de un solo tono, clara → oscura, con luminosidad monótona.
 *
 * Los escalones van más saturados que un coroplético sobre papel blanco: se
 * pintan translúcidos ENCIMA del mapa base, y con tonos pálidos las zonas con
 * pocos reportes se perdían entre las calles. El primer escalón no se usa como
 * relleno —las zonas sin reportes se dejan sin pintar— pero se conserva para la
 * leyenda y para el resto de las gráficas.
 */
export const RAMPA = ['#e8f2ec', '#9fd0b6', '#5cb28c', '#2f8a68', '#0f5132'];
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
 * @param {object} [opciones.fondo] imagen base y su recuadro geográfico.
 * @param {(cp: number) => void} [opciones.alSeleccionar] al tocar una zona.
 */
export function coropletico(geojson, valores, { fondo = null, alSeleccionar = null } = {}) {
    // El tamaño lo manda la imagen de fondo, que se dibuja a su resolución
    // natural: encogerla volvía ilegibles los nombres de calle, que son
    // justo lo que sirve para ubicarse. El mapa se recorre dentro de su marco.
    const ANCHO = fondo?.ancho ?? 760;
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

    // ...y el encuadre lo mandan los polígonos urbanos, que se reconocen por
    // ser mucho más chicos que los ejidales. Se toma el 85% de menor
    // superficie: con la mitad, como estaba antes, el marco se ceñía al casco
    // viejo y dejaba fuera 30 zonas de verdad —Pórticos, La Condesa,
    // Xochimilco, Villa del Rey, El Coloso—, que se dibujaban pero quedaban
    // recortadas. Descartar el 15% más grande evita que dos o tres ejidos
    // enormes estiren el mapa hasta el valle.
    // Con imagen de fondo, el recuadro es EL DE LA IMAGEN: es la única forma de
    // que las zonas caigan justo sobre sus calles. Sin ella se calcula igual
    // que antes, por si el archivo no carga.
    const porArea = visibles.map((f) => [f, area(f)]).sort((a, b) => a[1] - b[1]);
    const urbanos = porArea.slice(0, Math.max(1, Math.ceil(porArea.length * 0.85))).map(([f]) => f);

    const caja = fondo
        ? { minX: fondo.oeste, maxX: fondo.este, minY: fondo.sur, maxY: fondo.norte }
        : limites(urbanos);
    // Corrección por latitud: sin ella la ciudad sale estirada a lo ancho.
    const escalaX = Math.cos((CENTRO.lat * Math.PI) / 180);
    const anchoGeo = (caja.maxX - caja.minX) * escalaX;
    const altoGeo = caja.maxY - caja.minY;

    // El alto sale de la proporción real del terreno; el ancho es fijo.
    const k = ANCHO / anchoGeo;
    const ALTO = fondo?.alto ?? Math.round(altoGeo * k);

    const proyecta = ([lon, lat]) => [
        ((lon - caja.minX) * escalaX * k).toFixed(1),
        ((caja.maxY - lat) * k).toFixed(1),
    ];

    const svg = crear('svg', {
        viewBox: `0 0 ${ANCHO} ${ALTO}`, width: ANCHO, height: ALTO,
        class: 'mapa', role: 'img',
        'aria-label': 'Mapa de reportes validados por código postal',
    });

    // La imagen va al fondo de todo; las zonas se pintan encima translúcidas.
    if (fondo?.imagen) {
        const imagen = crear('image', {
            href: fondo.imagen, x: 0, y: 0, width: ANCHO, height: ALTO,
        });
        svg.appendChild(imagen);
    }

    const zonas = new Map();

    for (const rasgo of visibles) {
        const cp = rasgo.properties.cp;
        const valor = valores.get(cp) ?? 0;
        // Las zonas sin reportes no se rellenan: dejan ver el mapa. Las que sí
        // tienen van translúcidas, para que las calles se sigan leyendo debajo.
        const camino = crear('path', {
            d: aRuta(rasgo.geometry, proyecta),
            fill: valor ? colorDe(valor, cortes) : 'none',
            'fill-opacity': valor ? 0.72 : 0,
            stroke: valor ? '#ffffff' : '#9aa1a8',
            'stroke-width': valor ? 1.2 : 0.6,
            'stroke-opacity': valor ? 0.9 : 0.5,
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

    /** Resalta la zona elegida sin recargar el mapa. */
    const marcar = (cp) => {
        for (const [codigo, camino] of zonas) {
            const elegida = codigo === cp;
            const tiene = (valores.get(codigo) ?? 0) > 0;
            camino.setAttribute('stroke', elegida ? '#0f5132' : (tiene ? '#ffffff' : '#9aa1a8'));
            camino.setAttribute('stroke-width', elegida ? 3 : (tiene ? 1.2 : 0.6));
            camino.setAttribute('stroke-opacity', elegida ? 1 : (tiene ? 0.9 : 0.5));
            if (elegida) svg.appendChild(camino);   // al frente
        }
    };

    // Dónde cae el centro de la ciudad dentro del dibujo, para abrir el mapa
    // mirando ahí y no en una esquina del valle.
    const [centroX, centroY] = proyecta([CENTRO.lon, CENTRO.lat]).map(Number);

    return { svg, cortes, maximo, marcar, centro: { x: centroX, y: centroY }, ancho: ANCHO, alto: ALTO };
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
        // El primer escalón no se rellena en el mapa: deja ver las calles.
        if (i === 0) muestra.classList.add('muestra-vacia');
        else muestra.style.backgroundColor = RAMPA[i];
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
