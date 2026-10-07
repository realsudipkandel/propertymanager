#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/.env" ]; then
  echo "Missing .env. Copy .env.example." >&2
  exit 1
fi

if [ ! -f "$ROOT/secrets.env" ]; then
  echo "Missing secrets.env. Copy secrets.env.example and set the passwords and keys there." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$ROOT/.env"
# shellcheck disable=SC1091
. "$ROOT/secrets.env"
set +a

cd "$ROOT"
exec "$@"
