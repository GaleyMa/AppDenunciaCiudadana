// src/reportes/form/CapturaGps.js — ubicación del dispositivo.
//
// La HT-01 original pedía "GPS + respaldo manual" y quedó pendiente. El GPS es
// lo que permite ubicar el reporte en el mapa del tablero: el servidor deriva
// el código postal a partir de las coordenadas.
//
// Es OPCIONAL a propósito. Si la persona no da permiso, el reporte se guarda
// igual con el texto de la colonia; solo no aparecerá en el mapa.

const OPCIONES = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000, // una lectura de hace un minuto sirve
};

/** Mensajes claros: "código 1" no le dice nada a nadie. */
function explicar(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'No diste permiso de ubicación. El reporte se guarda igual con la colonia.';
        case error.POSITION_UNAVAILABLE:
            return 'No se pudo obtener la ubicación. Revisa que el GPS esté encendido.';
        case error.TIMEOUT:
            return 'La ubicación tardó demasiado. Puedes intentar de nuevo o enviar sin ella.';
        default:
            return 'No se pudo obtener la ubicación.';
    }
}

/**
 * Pide la ubicación al navegador.
 * @returns {Promise<{lat: number, lon: number, precision: number}>}
 */
export default function solicitarUbicacion() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('Este navegador no puede obtener la ubicación.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({
                lat: coords.latitude,
                lon: coords.longitude,
                precision: Math.round(coords.accuracy),
            }),
            (error) => reject(new Error(explicar(error))),
            OPCIONES,
        );
    });
}
