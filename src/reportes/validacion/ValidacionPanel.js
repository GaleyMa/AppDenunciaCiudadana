// src/reportes/validacion/ValidacionPanel.js — capa de UI del panel de moderación.
//
// Responsabilidad única: pintar los reportes pendientes y disparar las acciones.
// Toda la regla de negocio (qué estado queda, qué es obligatorio) vive en
// GestorValidacion; aquí solo se dibuja y se escucha.
//
// ANONIMATO: el panel muestra foto, categoría, ubicación, fecha e id del
// reporte. No hay nada más que mostrar — los reportes nunca guardan datos de
// quien los levantó.

import { MOTIVOS_DESCARTE } from './GestorValidacion.js';
import { etiquetaCategoria } from '../datos/categorias.js';

/** Fecha ISO -> "6 sep 2026, 21:30". Si viene vacía o rota, se dice así. */
function formatearFecha(iso) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';

    return fecha.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Los UUID son largos; en pantalla basta el principio para distinguirlos. */
const idCorto = (id) => id.slice(0, 8);

/**
 * Monta el panel dentro de un contenedor.
 * @param {HTMLElement} contenedor donde se pinta el panel.
 * @param {GestorValidacion} gestor lógica de validación.
 * @returns {{render: () => Promise<void>}} para volver a pintar desde fuera.
 */
export default function initValidacionPanel(contenedor, gestor) {
    // Las URLs de las miniaturas se liberan en cada repintado: si no, cada
    // render deja blobs vivos en memoria hasta recargar la página.
    let urlsMiniaturas = [];

    const liberarMiniaturas = () => {
        urlsMiniaturas.forEach(URL.revokeObjectURL);
        urlsMiniaturas = [];
    };

    const crear = (etiqueta, clase, texto) => {
        const elemento = document.createElement(etiqueta);
        if (clase) elemento.className = clase;
        // textContent y no innerHTML: la ubicación la escribe el ciudadano y el
        // panel es justo donde se lee ese texto.
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    };

    const avisar = (texto, esError = false) => {
        const aviso = contenedor.querySelector('.panel-aviso');
        aviso.textContent = texto;
        aviso.classList.toggle('es-error', esError);
    };

    /** Ejecuta una acción del gestor y repinta; los errores se muestran. */
    const ejecutar = async (accion, mensajeExito) => {
        try {
            await accion();
            await render();
            avisar(mensajeExito);
        } catch (error) {
            avisar(error.message, true);
        }
    };

    /** Panel desplegable para elegir el motivo del descarte. */
    const formularioDescarte = (reporte, tarjeta) => {
        const caja = crear('div', 'accion-detalle');
        caja.appendChild(crear('p', 'accion-titulo', 'Motivo del descarte'));

        const grupo = crear('div', 'motivos');
        MOTIVOS_DESCARTE.forEach(({ valor, etiqueta }) => {
            const opcion = crear('label', 'motivo');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `motivo-${reporte.id}`;
            radio.value = valor;
            opcion.append(radio, document.createTextNode(` ${etiqueta}`));
            grupo.appendChild(opcion);
        });
        caja.appendChild(grupo);

        const confirmar = crear('button', 'btn-peligro', 'Confirmar descarte');
        confirmar.type = 'button';
        confirmar.addEventListener('click', () => {
            const elegido = grupo.querySelector('input:checked');
            // Sin motivo no se llama al gestor; y aunque se llamara, él también
            // lo rechaza. La regla vive en la lógica, no en la pantalla.
            if (!elegido) {
                avisar('Selecciona un motivo para descartar el reporte.', true);
                return;
            }
            ejecutar(() => gestor.descartar(reporte.id, elegido.value),
                `Reporte ${idCorto(reporte.id)} descartado.`);
        });

        const cancelar = crear('button', 'btn-secundario', 'Cancelar');
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => tarjeta.querySelector('.accion-detalle')?.remove());

        caja.appendChild(crear('div', 'acciones-detalle')).append(confirmar, cancelar);
        return caja;
    };

    /** Panel desplegable para elegir de cuál reporte es duplicado. */
    const formularioFusion = async (reporte, tarjeta) => {
        const caja = crear('div', 'accion-detalle');
        caja.appendChild(crear('p', 'accion-titulo', 'Este reporte es duplicado de:'));

        const candidatos = await gestor.candidatosFusion(reporte.id);
        if (!candidatos.length) {
            caja.appendChild(crear('p', 'sin-datos', 'No hay otros reportes con los que fusionar.'));
            const cerrar = crear('button', 'btn-secundario', 'Cerrar');
            cerrar.type = 'button';
            cerrar.addEventListener('click', () => caja.remove());
            caja.appendChild(cerrar);
            return caja;
        }

        // Un <select> y no un campo de texto: el moderador no debería teclear
        // un UUID a mano.
        const select = document.createElement('select');
        candidatos.forEach((candidato) => {
            const opcion = document.createElement('option');
            opcion.value = candidato.id;
            opcion.textContent = `${etiquetaCategoria(candidato.categoria)} · ${candidato.ubicacion}`
                + ` · ${formatearFecha(candidato.fecha)} · ${idCorto(candidato.id)}`;
            select.appendChild(opcion);
        });
        caja.appendChild(select);

        const confirmar = crear('button', 'btn-principal', 'Confirmar fusión');
        confirmar.type = 'button';
        confirmar.addEventListener('click', () => ejecutar(
            () => gestor.fusionar(reporte.id, select.value),
            `Reporte ${idCorto(reporte.id)} fusionado con ${idCorto(select.value)}.`,
        ));

        const cancelar = crear('button', 'btn-secundario', 'Cancelar');
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => caja.remove());

        caja.appendChild(crear('div', 'acciones-detalle')).append(confirmar, cancelar);
        return caja;
    };

    const tarjetaReporte = (reporte) => {
        const tarjeta = crear('article', 'reporte');

        // Dos orígenes posibles: el blob de IndexedDB (moderación local) o una
        // URL firmada del bucket privado (moderación contra el servidor).
        const miniatura = crear('div', 'miniatura');
        let fuente = null;
        if (reporte.foto instanceof Blob) {
            fuente = URL.createObjectURL(reporte.foto);
            urlsMiniaturas.push(fuente);
        } else if (reporte.fotoUrl) {
            fuente = reporte.fotoUrl;
        }

        if (fuente) {
            const img = document.createElement('img');
            img.src = fuente;
            img.alt = `Foto del reporte de ${etiquetaCategoria(reporte.categoria)}`;
            img.loading = 'lazy';
            miniatura.appendChild(img);
        } else {
            miniatura.appendChild(crear('span', 'sin-foto', 'Sin foto'));
        }
        tarjeta.appendChild(miniatura);

        const datos = crear('div', 'datos');
        datos.appendChild(crear('p', 'categoria', etiquetaCategoria(reporte.categoria)));
        datos.appendChild(crear('p', 'ubicacion', reporte.ubicacion));
        datos.appendChild(crear('p', 'fecha', formatearFecha(reporte.fecha)));
        datos.appendChild(crear('p', 'id-reporte', `ID ${idCorto(reporte.id)}`));
        tarjeta.appendChild(datos);

        const acciones = crear('div', 'acciones');

        const btnValidar = crear('button', 'btn-principal', 'Validar');
        btnValidar.type = 'button';
        btnValidar.addEventListener('click', () => ejecutar(
            () => gestor.validar(reporte.id), `Reporte ${idCorto(reporte.id)} validado.`,
        ));

        const btnDescartar = crear('button', 'btn-peligro', 'Descartar');
        btnDescartar.type = 'button';
        btnDescartar.addEventListener('click', () => {
            const abierto = tarjeta.querySelector('.accion-detalle');
            abierto?.remove();
            if (!abierto?.dataset.tipo || abierto.dataset.tipo !== 'descarte') {
                const caja = formularioDescarte(reporte, tarjeta);
                caja.dataset.tipo = 'descarte';
                tarjeta.appendChild(caja);
            }
        });

        const btnFusionar = crear('button', 'btn-secundario', 'Fusionar');
        btnFusionar.type = 'button';
        btnFusionar.addEventListener('click', async () => {
            const abierto = tarjeta.querySelector('.accion-detalle');
            abierto?.remove();
            if (abierto?.dataset.tipo === 'fusion') return;

            // Buscar los candidatos puede fallar (sin red, o una función que
            // falta en el servidor). Sin este try, la promesa se rompía en
            // silencio: el botón "no hacía nada" y no había forma de saber por
            // qué.
            btnFusionar.disabled = true;
            try {
                const caja = await formularioFusion(reporte, tarjeta);
                caja.dataset.tipo = 'fusion';
                tarjeta.appendChild(caja);
            } catch (error) {
                avisar(`No se pudieron cargar los reportes para fusionar: ${error.message}`, true);
            } finally {
                btnFusionar.disabled = false;
            }
        });

        acciones.append(btnValidar, btnDescartar, btnFusionar);
        tarjeta.appendChild(acciones);

        return tarjeta;
    };

    async function render() {
        liberarMiniaturas();

        let pendientes;
        try {
            pendientes = await gestor.pendientes();
        } catch (error) {
            contenedor.replaceChildren();
            const fallo = crear('p', 'sin-datos',
                `No se pudieron cargar los reportes: ${error.message}`);
            const reintentar = crear('button', 'btn-secundario', 'Reintentar');
            reintentar.type = 'button';
            reintentar.addEventListener('click', render);
            contenedor.append(fallo, reintentar);
            return;
        }

        // Más recientes primero: es el orden en que un moderador espera revisar.
        pendientes.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

        contenedor.replaceChildren();

        const cabecera = crear('header', 'panel-cabecera');
        cabecera.appendChild(crear('h1', null, 'Panel de validación'));
        cabecera.appendChild(crear('p', 'panel-conteo',
            pendientes.length === 1 ? '1 reporte pendiente' : `${pendientes.length} reportes pendientes`));
        contenedor.appendChild(cabecera);

        contenedor.appendChild(crear('p', 'panel-aviso'));

        if (!pendientes.length) {
            const vacio = crear('p', 'sin-datos', 'No hay reportes pendientes por revisar.');
            // IndexedDB se guarda por origen: los reportes capturados en
            // 127.0.0.1 no se ven desde localhost (y al revés), aunque sea el
            // mismo servidor y el mismo puerto. Es la confusión más fácil de
            // tener en desarrollo, así que el panel la nombra.
            vacio.appendChild(document.createElement('br'));
            vacio.appendChild(crear('small', null,
                `Si esperabas ver reportes, revisa que estés en el mismo origen donde los capturaste `
                + `(este panel lee los de ${window.location.origin}).`));
            contenedor.appendChild(vacio);
        } else {
            const lista = crear('div', 'lista-reportes');
            pendientes.forEach((reporte) => lista.appendChild(tarjetaReporte(reporte)));
            contenedor.appendChild(lista);
        }

        const pie = crear('footer', 'panel-pie');
        pie.appendChild(crear('p', null,
            'Los reportes son anónimos: no existe ningún dato de quien los levantó.'));
        const salir = crear('a', null, 'Volver a la vista pública');
        salir.href = '#';
        pie.appendChild(salir);
        contenedor.appendChild(pie);
    }

    render();

    return { render };
}
