#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  dump-schema.sh — exporte le SCHÉMA COMPLET (toutes les tables du schéma
#  `public`) d'une base Supabase vers scripts/schema.sql.
#
#  C'est le « filet de sécurité » : un fichier unique, à jour, qui décrit la
#  structure exacte de toute la base (tables, colonnes, contraintes, index, FK,
#  séquences, vues…). Aucune donnée métier n'est exportée (schema-only).
#
#  ⚠ À RELANCER après CHAQUE modification de schéma pour garder le fichier à jour.
#
#  Usage :
#    bash scripts/dump-schema.sh [<client-id>] [-o <fichier>]
#
#    <client-id>  Identifiant d'un client défini dans
#                 scripts/multi-client/clients/<client-id>.env (variable
#                 DATABASE_URL). Si un SEUL client existe, il est pris par défaut.
#
#  Connexion ponctuelle sans fichier client :
#    SUPABASE_DB_URL="postgresql://postgres:[MDP]@db.<ref>.supabase.co:5432/postgres" \
#      bash scripts/dump-schema.sh
#
#  Prérequis (l'un OU l'autre) :
#    - pg_dump (outils clients PostgreSQL 15+) dans le PATH, OU
#    - Docker Desktop DÉMARRÉ (la CLI Supabase lance pg_dump dans un conteneur,
#      rien d'autre à installer).
#  Et : le mot de passe DB → Supabase → Settings → Database → Connection string
#  (URI, connexion DIRECTE port 5432).
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
SELF="${BASH_SOURCE[0]}"
REPO_ROOT="$(cd "$(dirname "$SELF")/.." && pwd)"
# lib.sh fournit require_tools / load_client / list_clients (et redéfinit SCRIPT_DIR).
# shellcheck source=multi-client/lib.sh
. "$REPO_ROOT/scripts/multi-client/lib.sh"

# Encode une chaîne pour un composant d'URL (RFC 3986 : on garde A-Z a-z 0-9 . ~ _ -).
urlencode() {
  local s="$1" i c out=""
  for (( i=0; i<${#s}; i++ )); do
    c="${s:$i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) printf -v c '%%%02X' "'$c"; out+="$c" ;;
    esac
  done
  printf '%s' "$out"
}

OUT="$REPO_ROOT/scripts/schema.sql"
CLIENT=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o|--out)  OUT="$2"; shift 2;;
    -h|--help) awk 'NR>1 && /^#/{sub(/^# ?/,"");print;next} NR>1{exit}' "$SELF"; exit 0;;
    -*)        echo "Option inconnue : $1" >&2; exit 1;;
    *)         CLIENT="$1"; shift;;
  esac
done

# Résolution de la connexion : SUPABASE_DB_URL (env) > client explicite > client unique.
DB_URL="${SUPABASE_DB_URL:-}"
if [ -z "$DB_URL" ]; then
  if [ -z "$CLIENT" ]; then
    clients="$(list_clients || true)"
    count="$(printf '%s\n' "$clients" | grep -c . || true)"
    if [ "$count" = "1" ]; then
      CLIENT="$(printf '%s\n' "$clients" | grep . | head -1)"
      echo "ℹ Client unique détecté : $CLIENT"
    elif [ "$count" = "0" ]; then
      echo "❌ Aucun client défini et SUPABASE_DB_URL absent." >&2
      echo "   → créez scripts/multi-client/clients/<id>.env (cf. _example.env.example)" >&2
      echo "   → ou : SUPABASE_DB_URL=\"postgresql://…\" bash scripts/dump-schema.sh" >&2
      exit 1
    else
      echo "❌ Plusieurs clients : précisez lequel." >&2
      echo "   Clients connus : $(printf '%s ' $clients)" >&2
      exit 1
    fi
  fi
  envfile="$REPO_ROOT/scripts/multi-client/clients/$CLIENT.env"
  [ -f "$envfile" ] || { echo "❌ Fichier client introuvable : $envfile" >&2; exit 1; }
  # Le .env ne contient que des affectations sûres (mot de passe entre quotes simples).
  set -a
  # shellcheck disable=SC1090
  . "$envfile"
  set +a
  if [ -n "${DATABASE_URL:-}" ]; then
    DB_URL="$DATABASE_URL"                      # format legacy (URL déjà encodée)
  elif [ -n "${PGPASSWORD:-}" ] && [ -n "${PGHOST:-}" ]; then
    DB_URL="postgresql://${PGUSER:-postgres}:$(urlencode "$PGPASSWORD")@${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-postgres}"
  else
    echo "❌ $envfile : définissez soit DATABASE_URL, soit PGHOST + PGPASSWORD." >&2
    exit 1
  fi
fi

REL_OUT="${OUT#"$REPO_ROOT"/}"
echo "📦 Dump du schéma public → $REL_OUT"

# Image conteneur fournissant pg_dump (fallback Docker). pg_dump 17 sait dumper
# un serveur PostgreSQL 15+ (Supabase). Surchargeable via PGDUMP_IMAGE.
PGDUMP_IMAGE="${PGDUMP_IMAGE:-postgres:17-alpine}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Méthode : pg_dump natif (préféré) ; sinon pg_dump dans un conteneur Docker
# (rien à installer). On évite la CLI Supabase (bug d'encodage du tag d'image
# sous Windows lors de la détection de version).
if command -v pg_dump >/dev/null 2>&1; then
  echo "🔧 Méthode : pg_dump natif"
  pg_dump "$DB_URL" --schema-only --no-owner --no-privileges --schema=public > "$tmp"
elif docker info >/dev/null 2>&1; then
  echo "🔧 Méthode : pg_dump via conteneur Docker ($PGDUMP_IMAGE)"
  docker run --rm "$PGDUMP_IMAGE" \
    pg_dump "$DB_URL" --schema-only --no-owner --no-privileges --schema=public > "$tmp"
else
  echo "❌ Aucune méthode de dump disponible :" >&2
  echo "   • pg_dump introuvable dans le PATH, ET" >&2
  echo "   • Docker n'est pas démarré." >&2
  echo "   → démarrez Docker Desktop, OU installez les outils clients PostgreSQL 15+." >&2
  exit 1
fi

# Sécurité : on ne remplace schema.sql que si le dump a produit du contenu.
if [ ! -s "$tmp" ]; then
  echo "❌ Le dump est vide — schema.sql inchangé (voir l'erreur ci-dessus)." >&2
  exit 1
fi
mv "$tmp" "$OUT"

tables="$(grep -cE '^CREATE TABLE ' "$OUT" || true)"
echo "✅ Terminé : $tables table(s) exportée(s) dans $REL_OUT"
echo "   Pensez à committer $REL_OUT (aucun secret : structure seule)."
