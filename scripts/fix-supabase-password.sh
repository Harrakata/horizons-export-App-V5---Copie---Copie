#!/usr/bin/env bash
#
# fix-supabase-password.sh
# Corrige un POSTGRES_PASSWORD contenant des caractères spéciaux (@ ! & $ * : / ? #)
# qui cassent les URI de connexion internes de Supabase self-hosted
# (symptôme : PostgREST « could not translate host name ... to address »).
#
# À exécuter sur le serveur, dans le dossier de la stack Supabase Docker
# (celui qui contient docker-compose.yml et .env), typiquement ~/supabase/docker.
#
# Usage :
#   chmod +x fix-supabase-password.sh
#   ./fix-supabase-password.sh 'NouveauMotDePasseAlphaNum'
#   # ou sans argument → il vous le demandera
#
set -euo pipefail

# ─── 0. Pré-requis ────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  echo "❌ Fichier .env introuvable. Placez-vous dans le dossier de la stack Supabase (ex: cd ~/supabase/docker)." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker introuvable dans le PATH." >&2
  exit 1
fi
# Détecte 'docker compose' (v2) ou 'docker-compose' (v1)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ Ni 'docker compose' ni 'docker-compose' disponibles." >&2
  exit 1
fi

# ─── 1. Nouveau mot de passe ──────────────────────────────────────────────────
NEW_PW="${1:-}"
if [[ -z "$NEW_PW" ]]; then
  read -r -p "Nouveau POSTGRES_PASSWORD (lettres + chiffres uniquement) : " NEW_PW
fi
# Validation : uniquement alphanumérique (et éventuellement _ et -)
if [[ ! "$NEW_PW" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "❌ Mot de passe invalide : utilisez UNIQUEMENT lettres, chiffres, _ ou - (pas de @ ! & \$ * : / ? #)." >&2
  exit 1
fi
if [[ ${#NEW_PW} -lt 12 ]]; then
  echo "⚠️  Conseil : au moins 12 caractères. (on continue quand même)"
fi

# ─── 2. Récupère l'ancien mot de passe depuis .env ───────────────────────────
OLD_PW="$(grep -E '^POSTGRES_PASSWORD=' .env | head -n1 | cut -d'=' -f2-)"
if [[ -z "$OLD_PW" ]]; then
  echo "❌ POSTGRES_PASSWORD introuvable dans .env." >&2
  exit 1
fi
echo "ℹ️  Ancien mot de passe détecté (longueur ${#OLD_PW})."

# ─── 3. Backup du .env ────────────────────────────────────────────────────────
STAMP="$(date +%Y%m%d-%H%M%S)"
cp .env ".env.bak-${STAMP}"
echo "✅ Backup créé : .env.bak-${STAMP}"

# ─── 4. Remplace TOUTES les occurrences de l'ancien mot de passe dans .env ────
# On utilise un délimiteur sed peu probable pour éviter les conflits avec les caractères du mot de passe.
# Échappe les caractères spéciaux de l'ancien mot de passe pour la recherche littérale.
ESC_OLD="$(printf '%s' "$OLD_PW" | sed -e 's/[\/&|]/\\&/g')"
ESC_NEW="$(printf '%s' "$NEW_PW" | sed -e 's/[\/&|]/\\&/g')"
# Remplacement global (toutes les variables qui réutilisent le mot de passe : DATABASE_URL, POOLER, etc.)
sed -i "s|${ESC_OLD}|${ESC_NEW}|g" .env
echo "✅ .env mis à jour (toutes les occurrences remplacées)."

OCCUR="$(grep -c "${NEW_PW}" .env || true)"
echo "   → ${OCCUR} occurrence(s) du nouveau mot de passe dans .env."

# ─── 5. Aligne les rôles Postgres avec le nouveau mot de passe ────────────────
# La base contient déjà les données migrées : le volume persiste l'ANCIEN mot de passe,
# il faut donc le changer aussi à l'intérieur de Postgres.
# IMPORTANT : sur Supabase self-hosted, le superutilisateur est 'supabase_admin'
# (le rôle 'postgres' n'est PAS superuser et ne peut pas modifier les rôles réservés).
# On détecte automatiquement un rôle superuser pour la connexion.
echo "🔧 Détection d'un rôle superutilisateur…"
SUPERUSER=""
for candidate in supabase_admin postgres; do
  if $DC exec -T db psql -U "$candidate" -d postgres -tAc \
       "SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper" 2>/dev/null | grep -q 1; then
    SUPERUSER="$candidate"
    break
  fi
done
if [[ -z "$SUPERUSER" ]]; then
  echo "❌ Aucun rôle superutilisateur accessible (essayés : supabase_admin, postgres)." >&2
  echo "   Listez-les : docker compose exec -T db psql -U supabase_admin -d postgres -c \"SELECT rolname FROM pg_roles WHERE rolsuper;\"" >&2
  exit 1
fi
echo "✅ Superutilisateur : ${SUPERUSER}"

echo "🔧 Mise à jour des mots de passe des rôles Postgres…"
$DC exec -T db psql -U "$SUPERUSER" -d postgres <<SQL
DO \$\$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'postgres','authenticator','supabase_admin','supabase_auth_admin',
    'supabase_storage_admin','supabase_replication_admin','supabase_read_only_user',
    'pgbouncer','supabase_functions_admin'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER USER %I WITH PASSWORD %L', r, '${NEW_PW}');
      RAISE NOTICE 'Mot de passe mis à jour pour le rôle %', r;
    END IF;
  END LOOP;
END
\$\$;
SQL
echo "✅ Rôles Postgres synchronisés."

# ─── 6. Recharge le cache de schéma PostgREST ─────────────────────────────────
$DC exec -T db psql -U "$SUPERUSER" -d postgres -c "NOTIFY pgrst, 'reload schema';" || true

# ─── 7. Recrée les conteneurs pour recharger toute la config ──────────────────
echo "🔄 Redémarrage de la stack…"
$DC down
$DC up -d

# ─── 8. Vérification ──────────────────────────────────────────────────────────
echo ""
echo "⏳ Attente 10s puis affichage des logs PostgREST…"
sleep 10
$DC logs rest --tail=20

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Terminé. Vérifiez ci-dessus l'absence de 'could not translate host name'."
echo "   Backup du .env : .env.bak-${STAMP}"
echo "   Rechargez l'application — les données doivent maintenant remonter."
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "NOTE si l'étape 5 a échoué (impossible de se connecter à 'postgres') :"
echo "  Le rôle postgres avait l'ancien mot de passe. Connectez-vous en local au conteneur db :"
echo "    docker compose exec db bash"
echo "    psql -U supabase_admin -d postgres   # ou un rôle dont vous connaissez le mdp"
echo "  puis exécutez les ALTER USER manuellement avec le nouveau mot de passe."
