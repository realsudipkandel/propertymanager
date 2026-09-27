#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Copy .env.example and set random credentials." >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

: "${DB_USER:?}"
: "${DB_PASSWORD:?}"
: "${DB_NAME:?}"
: "${DB_PORT:?}"

if docker ps -a --format '{{.Names}}' | grep -qx 'mira-postgres'; then
  docker start mira-postgres >/dev/null
else
  docker run -d \
    --name mira-postgres \
    -e "POSTGRES_USER=${DB_USER}" \
    -e "POSTGRES_PASSWORD=${DB_PASSWORD}" \
    -e "POSTGRES_DB=${DB_NAME}" \
    -p "127.0.0.1:${DB_PORT}:5432" \
    postgres:16-alpine >/dev/null
fi

echo "Postgres is bound to 127.0.0.1:${DB_PORT}"
