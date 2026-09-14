// src/reportes/form/ColoniaAutocomplete.js — componente de UI reutilizable.
//
// Autocompletado de colonias en JS vanilla. No usa <datalist> porque su
// apariencia y su comportamiento cambian mucho entre navegadores móviles;
// aquí controlamos el marcado, el estilo y el teclado.
//
// Responsabilidad única: sugerir asentamientos en un input. No sabe de reportes
// ni de IndexedDB; recibe el catálogo por parámetro.
//
// Cada opción es { n: nombre, cp: código postal, t: tipo }. Se puede buscar por
// nombre o tecleando el código postal.

const MAX_SUGERENCIAS = 8;

/** Quita acentos y mayúsculas para comparar: "Cuauhtémoc" ≈ "cuauhtemoc". */
function normalizar(texto) {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Filtra el catálogo por nombre o por código postal.
 *
 * Si lo escrito son puros dígitos se busca por CP (teclear "21100" lista los
 * asentamientos de ese código); si no, por nombre, poniendo primero los que
 * empiezan con ese texto ("nu" ofrece "Nueva" antes que "Santo Niño").
 */
function filtrar(opciones, escrito) {
    const buscado = normalizar(escrito);
    if (!buscado) return [];

    if (/^\d{2,5}$/.test(buscado)) {
        return opciones
            .filter((opcion) => String(opcion.cp).startsWith(buscado))
            .slice(0, MAX_SUGERENCIAS);
    }

    const empiezan = [];
    const contienen = [];

    for (const opcion of opciones) {
        const normalizada = normalizar(opcion.n);
        if (normalizada.startsWith(buscado)) empiezan.push(opcion);
        else if (normalizada.includes(buscado)) contienen.push(opcion);
    }

    return [...empiezan, ...contienen].slice(0, MAX_SUGERENCIAS);
}

/**
 * Conecta un input de texto con una lista de sugerencias.
 * @param {HTMLInputElement} input campo donde se escribe.
 * @param {HTMLElement} lista <ul> donde se pintan las sugerencias.
 * @param {Array<{n: string, cp: number, t: string}>} opciones catálogo.
 * @param {(opcion: object|null) => void} [alElegir] avisa qué se seleccionó, o
 *        null cuando el texto deja de corresponder a una opción del catálogo.
 */
export default function initColoniaAutocomplete(input, lista, opciones, alElegir = null) {
    if (!input || !lista) return;

    let visibles = [];
    let activo = -1; // índice resaltado con las flechas; -1 = ninguno

    const cerrar = () => {
        lista.hidden = true;
        lista.innerHTML = '';
        visibles = [];
        activo = -1;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    };

    const resaltar = (indice) => {
        activo = indice;
        [...lista.children].forEach((li, i) => {
            const esActivo = i === indice;
            li.classList.toggle('activa', esActivo);
            li.setAttribute('aria-selected', String(esActivo));
        });

        if (indice >= 0) {
            input.setAttribute('aria-activedescendant', lista.children[indice].id);
            lista.children[indice].scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    };

    const elegir = (opcion) => {
        input.value = opcion.n;
        cerrar();
        input.focus();
        alElegir?.(opcion);
    };

    const abrir = () => {
        visibles = filtrar(opciones, input.value);

        // Si lo escrito ya coincide exacto con un asentamiento, no tiene caso
        // seguir mostrando el desplegable.
        if (!visibles.length || (visibles.length === 1 && normalizar(visibles[0].n) === normalizar(input.value))) {
            cerrar();
            return;
        }

        // textContent en cada parte, no innerHTML con los datos dentro: el
        // catálogo es de confianza, pero la costumbre evita sustos.
        lista.replaceChildren(...visibles.map((opcion, i) => {
            const fila = document.createElement('li');
            fila.id = `colonia-${i}`;
            fila.setAttribute('role', 'option');
            fila.setAttribute('aria-selected', 'false');

            const nombre = document.createElement('strong');
            nombre.textContent = opcion.n;

            const detalle = document.createElement('span');
            detalle.className = 'detalle-opcion';
            detalle.textContent = `CP ${opcion.cp} · ${opcion.t}`;

            fila.append(nombre, detalle);
            return fila;
        }));
        lista.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        resaltar(-1);
    };

    input.addEventListener('input', abrir);
    input.addEventListener('focus', () => { if (input.value) abrir(); });

    input.addEventListener('keydown', (event) => {
        if (lista.hidden) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                resaltar((activo + 1) % visibles.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                resaltar(activo <= 0 ? visibles.length - 1 : activo - 1);
                break;
            case 'Enter':
                // Solo intercepta el Enter si hay una sugerencia resaltada,
                // para no bloquear el envío normal del formulario.
                if (activo >= 0) {
                    event.preventDefault();
                    elegir(visibles[activo]);
                }
                break;
            case 'Escape':
                cerrar();
                break;
        }
    });

    // mousedown en vez de click: se adelanta al blur, que si no cerraría la
    // lista antes de registrar la selección.
    lista.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const fila = event.target.closest('li');
        if (!fila) return;

        const indice = [...lista.children].indexOf(fila);
        if (indice >= 0) elegir(visibles[indice]);
    });

    // Si se sigue tecleando, lo elegido antes deja de valer: el texto ya no
    // corresponde a ese asentamiento y su código postal tampoco.
    input.addEventListener('input', () => alElegir?.(null));

    input.addEventListener('blur', cerrar);
    // Si el formulario se resetea tras guardar, la lista no debe quedar abierta.
    input.form?.addEventListener('reset', cerrar);
}
