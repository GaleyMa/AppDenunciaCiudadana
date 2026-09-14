// src/reportes/auth/PantallaLogin.js — acceso de moderadores.

const crear = (etiqueta, clase, texto) => {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
};

/**
 * Pinta el formulario de acceso.
 * @param {HTMLElement} contenedor
 * @param {SesionModerador} sesion
 * @param {() => void} alEntrar se llama cuando la sesión queda abierta.
 */
export default function initPantallaLogin(contenedor, sesion, alEntrar) {
    contenedor.replaceChildren();

    const tarjeta = crear('section', 'tarjeta acceso');
    tarjeta.appendChild(crear('h1', null, 'Acceso de moderación'));
    tarjeta.appendChild(crear('p', 'nota',
        'Solo para cuentas dadas de alta como moderadoras. Los reportes son anónimos: '
        + 'aquí no hay datos de quien los levantó.'));

    const formulario = crear('form', 'form-acceso');

    const campoCorreo = crear('div', 'campo');
    const etiquetaCorreo = crear('label', null, 'Correo');
    etiquetaCorreo.htmlFor = 'acceso-correo';
    const correo = document.createElement('input');
    correo.type = 'email';
    correo.id = 'acceso-correo';
    correo.autocomplete = 'username';
    campoCorreo.append(etiquetaCorreo, correo);

    const campoClave = crear('div', 'campo');
    const etiquetaClave = crear('label', null, 'Contraseña');
    etiquetaClave.htmlFor = 'acceso-clave';
    const clave = document.createElement('input');
    clave.type = 'password';
    clave.id = 'acceso-clave';
    clave.autocomplete = 'current-password';
    campoClave.append(etiquetaClave, clave);

    const error = crear('p', 'msg-error');
    error.id = 'acceso-error';
    error.setAttribute('role', 'alert');

    const boton = crear('button', null, 'Entrar');
    boton.type = 'submit';
    boton.id = 'acceso-entrar';

    formulario.append(campoCorreo, campoClave, error, boton);

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        error.textContent = '';
        boton.disabled = true;
        boton.textContent = 'Entrando…';

        try {
            await sesion.iniciar(correo.value, clave.value);
            // La contraseña no se queda en el DOM más de lo necesario.
            clave.value = '';
            alEntrar();
        } catch (fallo) {
            error.textContent = fallo.message;
        } finally {
            boton.disabled = false;
            boton.textContent = 'Entrar';
        }
    });

    tarjeta.appendChild(formulario);
    contenedor.appendChild(tarjeta);
}
