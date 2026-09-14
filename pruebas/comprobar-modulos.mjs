// pruebas/comprobar-modulos.mjs
//
// Revisa que cada `import { x } from './y.js'` encuentre realmente esa
// exportación. Parsear un archivo no basta: un módulo puede quedar
// sintácticamente válido y aun así haber perdido una función que otro importa,
// y eso solo se descubre en el navegador, con la pantalla en blanco.
//
//   node pruebas/comprobar-modulos.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');

function archivosJs(directorio) {
    return readdirSync(directorio).flatMap((entrada) => {
        const ruta = join(directorio, entrada);
        if (statSync(ruta).isDirectory()) return archivosJs(ruta);
        return ruta.endsWith('.js') ? [ruta] : [];
    });
}

/** Nombres que un módulo pone a disposición de los demás. */
function exportaciones(codigo) {
    const nombres = new Set();
    if (/^export default/m.test(codigo)) nombres.add('default');

    for (const [, nombre] of codigo.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) nombres.add(nombre);
    for (const [, nombre] of codigo.matchAll(/^export\s+(?:const|let|var|class)\s+(\w+)/gm)) nombres.add(nombre);
    for (const [, lista] of codigo.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const parte of lista.split(',')) {
            const alias = parte.trim().split(/\s+as\s+/).pop();
            if (alias) nombres.add(alias.trim());
        }
    }
    return nombres;
}

const archivos = [...archivosJs(join(RAIZ, 'src')), join(RAIZ, 'app.js')];
const cache = new Map();
const leer = (ruta) => {
    if (!cache.has(ruta)) cache.set(ruta, readFileSync(ruta, 'utf8'));
    return cache.get(ruta);
};

const fallos = [];

for (const archivo of archivos) {
    const codigo = leer(archivo);
    const importaciones = codigo.matchAll(/^import\s+([^;]+?)\s+from\s+['"](\.[^'"]+)['"]/gms);

    for (const [, clausula, relativa] of importaciones) {
        const destino = resolve(dirname(archivo), relativa);
        let codigoDestino;
        try {
            codigoDestino = leer(destino);
        } catch {
            fallos.push(`${archivo}: no existe el archivo importado ${relativa}`);
            continue;
        }

        const disponibles = exportaciones(codigoDestino);
        const pedidos = [];

        const porDefecto = clausula.match(/^\s*(\w+)\s*(?:,|$)/);
        if (porDefecto && !clausula.trimStart().startsWith('{')) pedidos.push(['default', porDefecto[1]]);

        const llaves = clausula.match(/\{([^}]*)\}/);
        if (llaves) {
            for (const parte of llaves[1].split(',')) {
                const nombre = parte.trim().split(/\s+as\s+/)[0].trim();
                if (nombre) pedidos.push([nombre, nombre]);
            }
        }

        for (const [nombre, comoSeUsa] of pedidos) {
            if (!disponibles.has(nombre)) {
                fallos.push(`${archivo.replace(RAIZ + '/', '')} importa "${comoSeUsa}" de ${relativa}, `
                    + `pero ese módulo no lo exporta`);
            }
        }
    }
}

if (fallos.length) {
    console.error('FALLOS:\n  ' + fallos.join('\n  '));
    process.exit(1);
}
console.log(`OK — ${archivos.length} módulos, todas las importaciones resuelven`);
