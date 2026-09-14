
const CATEGORIAS = [
    { valor: 'bache', etiqueta: 'Bache o pavimento roto' },
    { valor: 'alumbrado', etiqueta: 'Alumbrado público apagado' },
    { valor: 'basura', etiqueta: 'Basura acumulada' },
    { valor: 'fuga-agua', etiqueta: 'Fuga de agua' },
    { valor: 'vandalismo', etiqueta: 'Vandalismo o daño a mobiliario' },
    { valor: 'punto-riesgo', etiqueta: 'Punto de riesgo (baldío, calle sin vigilancia)' },
    { valor: 'otro', etiqueta: 'Otro' },
];

/** Etiqueta legible de una categoría; si no está en el catálogo, el valor crudo. */
export function etiquetaCategoria(valor) {
    return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
}

export default CATEGORIAS;
