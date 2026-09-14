#!/usr/bin/env bash
# Levanta un Postgres con PostGIS, aplica las migraciones y corre las pruebas
# del backend. Necesita podman o docker. No toca tu proyecto de Supabase.
set -euo pipefail

CONTENEDOR=pg-denuncia-pruebas
MOTOR=$(command -v podman || command -v docker)
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Levantando Postgres con PostGIS…"
"$MOTOR" rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
"$MOTOR" run -d --rm --name "$CONTENEDOR" -e POSTGRES_PASSWORD=probando \
    docker.io/postgis/postgis:16-3.4 >/dev/null

# La imagen de Postgres levanta un servidor temporal para inicializar y luego
# lo apaga y arranca el definitivo. Esperar solo a pg_isready engancha al
# temporal y las migraciones se caen a media carga con "the database system is
# shutting down". Por eso se espera al aviso del servidor definitivo.
echo "   esperando a que arranque el servidor definitivo…"
until "$MOTOR" logs "$CONTENEDOR" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until "$MOTOR" exec "$CONTENEDOR" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

psql_() { "$MOTOR" exec -i "$CONTENEDOR" psql -U postgres -d denuncia -q -P pager=off "$@"; }

"$MOTOR" exec -i "$CONTENEDOR" psql -U postgres -q -c "create database denuncia;" >/dev/null
psql_ -v ON_ERROR_STOP=1 < "$RAIZ/pruebas/01_stub_supabase.sql" >/dev/null

echo "▶ Aplicando migraciones…"
for f in "$RAIZ"/migrations/*.sql; do
    printf '   %-45s' "$(basename "$f")"
    psql_ -v ON_ERROR_STOP=1 < "$f" >/dev/null && echo "OK"
done

echo "▶ Pruebas:"
psql_ < "$RAIZ/pruebas/02_pruebas.sql" 2>&1 | grep -v '^NOTICE'

"$MOTOR" rm -f "$CONTENEDOR" >/dev/null
