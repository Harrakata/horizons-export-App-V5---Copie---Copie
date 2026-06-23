#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  migrate.sh — applique les migrations en attente à un client (ou tous)
#
#  Usage :
#    bash migrate.sh <client-id>          # applique les migrations manquantes
#    bash migrate.sh --all                # à tous les clients du registre
#    bash migrate.sh --baseline <client>  # marque TOUTES les migrations du
#                                         #   manifest comme appliquées SANS les
#                                         #   exécuter (pour une base déjà à jour,
#                                         #   ex. client existant ou clone)
#    bash migrate.sh --dry-run <client>   # liste ce qui serait appliqué
#
#  L'ordre est défini par supabase/migrations/manifest.txt. Chaque migration est
#  exécutée dans une transaction (--single-transaction) : tout ou rien.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'EOF'
migrate.sh — applique les migrations en attente à un client (ou tous)

Usage :
  bash migrate.sh <client-id>          Applique les migrations manquantes
  bash migrate.sh --all                À tous les clients du registre
  bash migrate.sh --baseline <client>  Marque les migrations comme appliquées
                                       sans les exécuter (base déjà à jour)
  bash migrate.sh --dry-run <client>   Liste ce qui serait appliqué

L'ordre est défini par supabase/migrations/manifest.txt.
Chaque migration s'exécute dans une transaction (tout ou rien).
EOF
}

BASELINE=0
DRY_RUN=0
TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --baseline) BASELINE=1; shift;;
    --dry-run)  DRY_RUN=1; shift;;
    --all)      TARGET="--all"; shift;;
    -h|--help)  usage; exit 0;;
    -*)         echo "Option inconnue : $1" >&2; usage; exit 1;;
    *)          TARGET="$1"; shift;;
  esac
done
[ -n "$TARGET" ] || { usage; exit 1; }
require_tools psql
[ -f "$MANIFEST" ] || { echo "❌ Manifest introuvable : $MANIFEST" >&2; exit 1; }

migrate_one() {
  local client="$1"
  load_client "$client"
  echo "▶ Client : $client"
  ensure_migrations_table

  local applied=0 skipped=0
  while IFS= read -r line || [ -n "$line" ]; do
    # Ignore lignes vides et commentaires (#).
    case "$line" in ''|\#*) continue;; esac
    local fn="$line"
    local path="$MIGRATIONS_DIR/$fn"

    if is_applied "$fn"; then
      skipped=$((skipped+1))
      continue
    fi

    if [ "$DRY_RUN" = "1" ]; then
      echo "  • EN ATTENTE : $fn"
      applied=$((applied+1))
      continue
    fi

    if [ "$BASELINE" = "1" ]; then
      echo "  ⏭  baseline (marqué appliqué) : $fn"
      mark_applied "$fn"
      applied=$((applied+1))
      continue
    fi

    [ -f "$path" ] || { echo "  ❌ Fichier de migration manquant : $path" >&2; exit 1; }
    echo "  ⬆  application : $fn"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$path"
    mark_applied "$fn"
    applied=$((applied+1))
  done < "$MANIFEST"

  if [ "$DRY_RUN" = "1" ]; then
    echo "  ℹ $applied en attente, $skipped déjà appliquées."
  else
    echo "  ✅ $applied appliquée(s), $skipped déjà à jour."
  fi
}

if [ "$TARGET" = "--all" ]; then
  found=0
  while read -r c; do
    [ -n "$c" ] || continue
    found=1
    migrate_one "$c"
  done < <(list_clients)
  [ "$found" = "1" ] || { echo "⚠ Aucun client dans $CLIENTS_DIR" >&2; exit 1; }
else
  migrate_one "$TARGET"
fi
