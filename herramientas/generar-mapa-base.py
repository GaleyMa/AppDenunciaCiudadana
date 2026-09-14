#!/usr/bin/env python3
"""
Arma la imagen de fondo del mapa del tablero, una sola vez.

Descarga los mosaicos de OpenStreetMap del área urbana de Mexicali, los pega y
guarda una imagen junto con el recuadro geográfico exacto que cubre. El cliente
la usa como fondo del coroplético: así se ven todas las calles de referencia sin
cargar ninguna librería de mapas y sin depender de un servidor de mosaicos en
tiempo de ejecución. El tablero sigue funcionando sin conexión.

    python3 herramientas/generar-mapa-base.py

LICENCIA: los datos y el estilo son de OpenStreetMap y sus colaboradores
(ODbL / CC BY-SA). La atribución "© colaboradores de OpenStreetMap" DEBE
aparecer junto al mapa; ya está puesta en el tablero.

USO RESPONSABLE: la política de los servidores de OSM permite uso ligero. Esto
baja unas 60 imágenes UNA VEZ, despacio y con User-Agent identificable. No lo
conviertas en algo que corra seguido.
"""

import json
import math
import pathlib
import time
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
GEOJSON = RAIZ / 'src/reportes/datos/cp-mexicali.geojson'
SALIDA_IMAGEN = RAIZ / 'src/reportes/datos/mapa-base-mexicali.webp'
SALIDA_MARCO = RAIZ / 'src/reportes/datos/mapa-base-marco.json'

ZOOM = 13
ANCHO_FINAL = 1520          # suficiente para el mapa de 760 px en pantallas 2x
CENTRO = (32.6245, -115.4523)
AGENTE = 'DenunciaCiudadanaMexicali/1.0 (proyecto academico; generacion unica de mapa base)'


def anillos(geometria):
    if geometria['type'] == 'Polygon':
        return geometria['coordinates']
    return [anillo for poligono in geometria['coordinates'] for anillo in poligono]


def centro(rasgo):
    puntos = [p for anillo in anillos(rasgo['geometry']) for p in anillo]
    return (sum(p[0] for p in puntos) / len(puntos), sum(p[1] for p in puntos) / len(puntos))


def area(rasgo):
    total = 0
    for anillo in anillos(rasgo['geometry']):
        suma = 0
        for i in range(len(anillo) - 1):
            suma += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
        total += abs(suma) / 2
    return total


def recuadro_urbano():
    """Mismo criterio que usa el mapa: el 85% de polígonos de menor superficie."""
    rasgos = json.loads(GEOJSON.read_text())['features']
    cerca = [f for f in rasgos
             if abs(centro(f)[1] - CENTRO[0]) < 0.22 and abs(centro(f)[0] - CENTRO[1]) < 0.26]
    urbanos = sorted(cerca, key=area)[:max(1, math.ceil(len(cerca) * 0.85))]

    xs = [p[0] for f in urbanos for a in anillos(f['geometry']) for p in a]
    ys = [p[1] for f in urbanos for a in anillos(f['geometry']) for p in a]
    return {'oeste': min(xs), 'este': max(xs), 'sur': min(ys), 'norte': max(ys)}


def a_mosaico(lon, lat, zoom):
    """Coordenadas de mosaico (con decimales) en la proyección de los mapas web."""
    n = 2 ** zoom
    x = (lon + 180.0) / 360.0 * n
    rad = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(rad)) / math.pi) / 2.0 * n
    return x, y


def main():
    from PIL import Image

    marco = recuadro_urbano()
    x0, y0 = a_mosaico(marco['oeste'], marco['norte'], ZOOM)   # esquina superior izquierda
    x1, y1 = a_mosaico(marco['este'], marco['sur'], ZOOM)      # inferior derecha

    xi0, yi0 = math.floor(x0), math.floor(y0)
    xi1, yi1 = math.ceil(x1), math.ceil(y1)
    columnas, filas = xi1 - xi0, yi1 - yi0
    print(f'recuadro: {marco}')
    print(f'mosaicos: {columnas} × {filas} = {columnas * filas} en zoom {ZOOM}')

    lienzo = Image.new('RGB', (columnas * 256, filas * 256), '#f2efe9')

    for cx in range(xi0, xi1):
        for cy in range(yi0, yi1):
            url = f'https://tile.openstreetmap.org/{ZOOM}/{cx}/{cy}.png'
            peticion = urllib.request.Request(url, headers={'User-Agent': AGENTE})
            with urllib.request.urlopen(peticion, timeout=30) as respuesta:
                from io import BytesIO
                mosaico = Image.open(BytesIO(respuesta.read())).convert('RGB')
            lienzo.paste(mosaico, ((cx - xi0) * 256, (cy - yi0) * 256))
            time.sleep(0.15)   # sin prisa: son los servidores de una organización sin fines de lucro
        print(f'  columna {cx - xi0 + 1}/{columnas}')

    # Recorte al recuadro exacto, para que la imagen y los polígonos coincidan.
    izquierda = (x0 - xi0) * 256
    arriba = (y0 - yi0) * 256
    derecha = (x1 - xi0) * 256
    abajo = (y1 - yi0) * 256
    recortada = lienzo.crop((round(izquierda), round(arriba), round(derecha), round(abajo)))

    alto_final = round(ANCHO_FINAL * recortada.height / recortada.width)
    final = recortada.resize((ANCHO_FINAL, alto_final), Image.LANCZOS)
    final.save(SALIDA_IMAGEN, 'WEBP', quality=82, method=6)

    SALIDA_MARCO.write_text(json.dumps({
        **marco,
        'imagen': SALIDA_IMAGEN.name,
        'ancho': ANCHO_FINAL,
        'alto': alto_final,
        'zoom': ZOOM,
        'atribucion': '© colaboradores de OpenStreetMap',
    }, ensure_ascii=False, indent=2) + '\n')

    print(f'imagen: {SALIDA_IMAGEN.name}  {final.width}×{final.height}  '
          f'{SALIDA_IMAGEN.stat().st_size / 1000:.0f} KB')


if __name__ == '__main__':
    main()
