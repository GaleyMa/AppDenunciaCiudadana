// src/reportes/form/ColoniaAutocomplete.js — componente de UI reutilizable.
//
// Autocompletado de colonias en JS vanilla. No usa <datalist> porque su
// apariencia y su comportamiento cambian mucho entre navegadores móviles;
// aquí controlamos el marcado, el estilo y el teclado.
//
// Responsabilidad única: sugerir texto en un input. No sabe de reportes ni de
// IndexedDB; recibe la lista de opciones por parámetro.

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
 * Filtra las opciones que contienen lo escrito, poniendo primero las que
 * empiezan con ese texto (escribir "nu" ofrece "Nueva" antes que "Santo Niño").
 */
function filtrar(opciones, escrito) {
    const buscado = normalizar(escrito);
    if (!buscado) return [];

    const empiezan = [];
    const contienen = [];

    for (const opcion of opciones) {
        const normalizada = normalizar(opcion);
        if (normalizada.startsWith(buscado)) empiezan.push(opcion);
        else if (normalizada.includes(buscado)) contienen.push(opcion);
    }

    return [...empiezan, ...contienen].slice(0, MAX_SUGERENCIAS);
}

/**
 * Conecta un input de texto con una lista de sugerencias.
 * @param {HTMLInputElement} input campo donde se escribe.
 * @param {HTMLElement} lista <ul> donde se pintan las sugerencias.
 * @param {string[]} opciones catálogo a sugerir.
 */
export default function initColoniaAutocomplete(input, lista, opciones) {
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

    const elegir = (colonia) => {
        input.value = colonia;
        cerrar();
        input.focus();
    };

    const abrir = () => {
        visibles = filtrar(opciones, input.value);

        // Si lo escrito ya coincide exacto con una colonia, no tiene caso
        // seguir mostrando el desplegable.
        if (!visibles.length || (visibles.length === 1 && normalizar(visibles[0]) === normalizar(input.value))) {
            cerrar();
            return;
        }

        lista.innerHTML = visibles
            .map((colonia, i) => `<li id="colonia-${i}" role="option" aria-selected="false">${colonia}</li>`)
            .join('');
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
        const opcion = event.target.closest('li');
        if (opcion) elegir(opcion.textContent);
    });

    input.addEventListener('blur', cerrar);
    // Si el formulario se resetea tras guardar, la lista no debe quedar abierta.
    input.form?.addEventListener('reset', cerrar);
}
