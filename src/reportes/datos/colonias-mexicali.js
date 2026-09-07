// src/reportes/datos/colonias-mexicali.js
//
// Catálogo local de colonias y fraccionamientos de Mexicali, B.C. Se usa para
// sugerir la ubicación mientras el usuario escribe.
//
// Va como módulo ES6 (no como fetch a un JSON) para que funcione offline sin
// depender del caché del service worker.
//
// OJO: es una lista de arranque, NO un catálogo oficial. Conviene contrastarla
// con el directorio de colonias del Ayuntamiento de Mexicali o con el marco
// geoestadístico del INEGI y completarla. Editar este archivo es todo lo que
// hace falta: el formulario no necesita cambios.
//
// El campo de ubicación NO restringe a esta lista: el usuario puede escribir
// cualquier texto (una calle, un cruce, una colonia que falte aquí).

const COLONIAS_MEXICALI = [
    'Aviación',
    'Alamitos',
    'Baja California',
    'Burócrata',
    'Centro Cívico',
    'Cuauhtémoc Norte',
    'Cuauhtémoc Sur',
    'Esperanza',
    'Ex Ejido Chapultepec',
    'Ex Ejido Coahuila',
    'Ex Ejido Zacatecas',
    'González Ortega',
    'Guajardo',
    'Hidalgo',
    'Independencia',
    'Industrial',
    'Islas Agrarias A',
    'Islas Agrarias B',
    'Lázaro Cárdenas',
    'Los Pinos',
    'Miguel Alemán',
    'Nacionalista',
    'Nueva',
    'Nuevo Mexicali',
    'Orizaba',
    'Primera Sección (Zona Centro)',
    'Pro Hogar',
    'Progreso',
    'Pueblo Nuevo',
    'Robledo',
    'Santo Niño',
    'Segunda Sección',
    'Solidaridad',
    'Villa Residencial del Prado',
    'Villafontana',
    'Villas del Rey',
    'Xochimilco',
];

export default COLONIAS_MEXICALI;
