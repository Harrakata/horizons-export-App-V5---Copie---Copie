#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Helpers partagés — gestion multi-clients (psql / pg_dump)
#  Chaque client = un projet Supabase distinct. Sa connexion Postgres est
#  décrite dans clients/<client-id>.env (DATABASE_URL=postgresql://…).
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENTS_DIR="$SCRIPT_DIR/clients"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../../supabase/migrations" && pwd)"
MANIFEST="$MIGRATIONS_DIR/manifest.txt"
# Table de suivi des migrations, créée dans CHAQUE base client.
MIGRATIONS_TABLE="public._mc_migrations"

# Vérifie la présence des outils clients PostgreSQL requis.
require_tools() {
  local t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || {
      echo "❌ Outil requis introuvable : '$t'." >&2
      echo "   Installez les outils clients PostgreSQL 15+ (psql, pg_dump) et ajoutez-les au PATH." >&2
      exit 1
    }
  done
}

# Charge la connexion d'un client → exporte DATABASE_URL (+ variables du .env).
load_client() {
  local client="$1"
  local f="$CLIENTS_DIR/$client.env"
  [ -f "$f" ] || { echo "❌ Fichier client introuvable : $f" >&2; exit 1; }
  set -a
  # shellcheck disable=SC1090
  . "$f"
  set +a
  [ -n "${DATABASE_URL:-}" ] || { echo "❌ DATABASE_URL absent dans $f" >&2; exit 1; }
}

# Liste les identifiants clients connus (un par fichier .env).
list_clients() {
  ls "$CLIENTS_DIR"/*.env 2>/dev/null | while read -r f; do
    basename "$f" .env
  done
}

ensure_migrations_table() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
    "CREATE TABLE IF NOT EXISTS $MIGRATIONS_TABLE (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"
}

is_applied() {
  local fn="$1" res
  res="$(psql "$DATABASE_URL" -tA -c "SELECT 1 FROM $MIGRATIONS_TABLE WHERE filename = '$fn' LIMIT 1;")"
  [ "$res" = "1" ]
}

mark_applied() {
  local fn="$1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO $MIGRATIONS_TABLE(filename) VALUES ('$fn') ON CONFLICT (filename) DO NOTHING;"
}
