#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  provision-client.sh — provisionne la base d'un NOUVEAU client par clonage
#  du schéma d'un client de référence (ex. PMU Mali).
#
#  Usage :
#    bash provision-client.sh --from <ref-client> --to <new-client> [--seed]
#
#  Étapes :
#    1. pg_dump schema-only du client référence (structure uniquement, aucune donnée)
#    2. Application du schéma sur la base du nouveau client
#    3. Baseline des migrations (la base clonée est déjà à jour → on les marque
#       appliquées sans les rejouer)
#    4. (--seed) Copie des données de référence (tables listées dans SEED_TABLES)
#
#  Prérequis : la base du nouveau client doit exister et être VIDE (projet
#  Supabase fraîchement créé). Les connexions sont lues dans clients/<id>.env.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'EOF'
provision-client.sh — provisionne un NOUVEAU client par clonage du schéma
d'un client de référence (structure seule, aucune donnée métier).

Usage :
  bash provision-client.sh --from <ref-client> --to <new-client> [--seed]

Étapes : dump schema-only de la référence → application au nouveau client →
baseline des migrations → (--seed) copie des données de référence (SEED_TABLES).

Prérequis : la base du nouveau client doit exister et être VIDE.
Les connexions sont lues dans clients/<id>.env.
EOF
}

FROM=""; TO=""; SEED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2;;
    --to)   TO="${2:-}";   shift 2;;
    --seed) SEED=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Option inconnue : $1" >&2; usage; exit 1;;
  esac
done
[ -n "$FROM" ] && [ -n "$TO" ] || { usage; exit 1; }
[ "$FROM" != "$TO" ] || { echo "❌ --from et --to doivent être différents." >&2; exit 1; }
require_tools psql pg_dump

# Récupère les deux connexions (sans écraser DATABASE_URL ensuite).
load_client "$FROM"; REF_URL="$DATABASE_URL"
load_client "$TO";   NEW_URL="$DATABASE_URL"

WORK="$SCRIPT_DIR/.work"; mkdir -p "$WORK"
SCHEMA_FILE="$WORK/${FROM}_schema.sql"

echo "════════════════════════════════════════════════════════════"
echo " Provisioning : '$TO'  (référence : '$FROM')"
echo "════════════════════════════════════════════════════════════"

echo "▶ 1/4 Dump du schéma depuis '$FROM' (schema-only)…"
pg_dump "$REF_URL" \
  --schema-only --no-owner --no-privileges --schema=public \
  --file="$SCHEMA_FILE"
echo "   → $SCHEMA_FILE"

echo "▶ 2/4 Application du schéma sur '$TO'…"
psql "$NEW_URL" -v ON_ERROR_STOP=1 -q -f "$SCHEMA_FILE"

echo "▶ 3/4 Baseline des migrations sur '$TO'…"
bash "$SCRIPT_DIR/migrate.sh" --baseline "$TO"

if [ "$SEED" = "1" ]; then
  # Tables de référence à copier intégralement (surcharge via le .env du client).
  : "${SEED_TABLES:=referentiel_parametres}"
  echo "▶ 4/4 Copie des données de référence : $SEED_TABLES"
  for t in $SEED_TABLES; do
    echo "   • table $t"
    pg_dump "$REF_URL" --data-only --no-owner --table="public.$t" \
      | psql "$NEW_URL" -v ON_ERROR_STOP=1 -q
  done

  # Clés app_settings sélectionnées (JAMAIS toute la table : on évite de copier
  # branding / fonctionnalités / liens Power BI propres à la référence).
  # Renseigner SEED_APP_SETTINGS_KEYS dans le .env du client (liste séparée par
  # des espaces), ex. : "general salaire_guichetiere_config prelevements_config".
  : "${SEED_APP_SETTINGS_KEYS:=}"
  if [ -n "$SEED_APP_SETTINGS_KEYS" ]; then
    in_list=""
    for k in $SEED_APP_SETTINGS_KEYS; do
      esc=$(printf "%s" "$k" | sed "s/'/''/g")   # échappe les quotes SQL
      in_list="$in_list,'$esc'"
    done
    in_list="${in_list#,}"
    echo "   • app_settings (clés : $SEED_APP_SETTINGS_KEYS)"
    psql "$REF_URL" -v ON_ERROR_STOP=1 \
      -c "\copy (SELECT key, value FROM public.app_settings WHERE key IN ($in_list)) TO STDOUT" \
      | psql "$NEW_URL" -v ON_ERROR_STOP=1 -q \
      -c "\copy public.app_settings(key, value) FROM STDIN"
  fi
else
  echo "▶ 4/4 Seed ignoré (passez --seed pour copier les données de référence)."
fi

echo "✅ Provisioning terminé pour '$TO'."
echo "   Pensez à : créer le déploiement (Vercel) avec VITE_CLIENT_ID=$TO et"
echo "   les VITE_SUPABASE_* du nouveau projet, puis créer le 1er compte admin."
