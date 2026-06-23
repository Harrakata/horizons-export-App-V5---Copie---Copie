# Configuration Twilio — Notification SMS du parieur (paiement de gain)

Ce guide décrit, de bout en bout, comment créer/configurer un compte **Twilio** et
le brancher à l'application pour que le parieur reçoive un SMS lorsque sa demande
de paiement de gain est **autorisée**, **refusée** ou **payée**.

---

## 1. Vue d'ensemble de l'intégration

```
Front (Exploitation / Chef d'agence)
   │  supabase.functions.invoke('notify-parieur-sms', { demandeId, event })
   ▼
Edge Function  notify-parieur-sms   (Deno, côté serveur)
   │  1. vérifie le JWT de l'appelant
   │  2. recharge la demande (service_role)
   │  3. construit le message FR
   │  4. POST API Twilio  ─────────────►  Twilio  ──► SMS au parieur
   │  5. journalise le résultat
   ▼
Table  paiement_gain_sms_notifications   (statut sent / failed / skipped)
```

Pièces déjà présentes dans le repo :

- Edge Function : `supabase/functions/notify-parieur-sms/index.ts`
- Migration BD : `supabase/migrations/add_paiement_gain_sms.sql`
  (colonne `demandes_paiement_gain."telephoneGagnant"` + table de log)
- Helper front : `notifyParieurBySms()` dans `src/lib/paiementGainService.js`
- Onglet de suivi « Notifications SMS » + bouton « Renvoyer le SMS » dans
  l'espace Exploitation.

> ⚠️ **Multi-tenant** : chaque client = son propre projet Supabase. La procédure
> ci-dessous est à refaire pour **chaque** projet client qui utilise les SMS.

---

## 2. Créer et configurer le compte Twilio

### 2.1 Inscription
1. Aller sur https://www.twilio.com/try-twilio et créer un compte.
2. Valider l'e-mail et le numéro de téléphone.

### 2.2 Récupérer les identifiants d'API
Dans la **Console Twilio** (https://console.twilio.com), page d'accueil :
- **Account SID** → secret `TWILIO_ACCOUNT_SID` (commence par `AC...`)
- **Auth Token** → secret `TWILIO_AUTH_TOKEN` (cliquer « Show » pour l'afficher)

### 2.3 Choisir un expéditeur (au choix, une seule option suffit)

| Option | Secret à utiliser | Remarques |
|---|---|---|
| **Numéro Twilio** | `TWILIO_FROM` (ex. `+1xxxxxxxxxx`) | Le plus simple. Acheter un numéro SMS : Console → *Phone Numbers → Buy a number* (cocher capacité **SMS**). |
| **Messaging Service** | `TWILIO_MESSAGING_SID` (ex. `MG...`) | Recommandé en production (pool de numéros, meilleure délivrabilité). Console → *Messaging → Services → Create*. |
| **Sender ID alphanumérique** | `TWILIO_FROM` = ex. `SONAL` | Affiche un nom au lieu d'un numéro. Disponible selon le pays, **sans réception possible**. À activer dans *Messaging → Sender IDs*. |

> Définir **soit** `TWILIO_FROM`, **soit** `TWILIO_MESSAGING_SID` (pas besoin des deux).

### 2.4 Autoriser le pays de destination (important pour l'Afrique de l'Ouest)
Twilio bloque par défaut certains pays. Aller dans
*Messaging → Settings → **Geo permissions*** et **cocher le(s) pays** de tes
parieurs (ex. **Burkina Faso**, Mali, Niger…). Sans cela, l'envoi échoue avec une
erreur de permission géographique.

### 2.5 Compte d'essai (trial) — limitations à connaître
Tant que le compte n'est pas **upgradé** (passage en payant) :
- On ne peut envoyer **que vers des numéros vérifiés** (Console → *Verified Caller IDs*).
- Le message est préfixé par « *Sent from your Twilio trial account* ».
- Le Sender ID alphanumérique n'est en général pas disponible.

Pour la production : ajouter un moyen de paiement (« **Upgrade** ») pour lever ces limites.

---

## 3. Appliquer la migration base de données

Si ce n'est pas déjà fait sur le projet Supabase du client :

- **Dashboard** → *SQL Editor* → coller le contenu de
  `supabase/migrations/add_paiement_gain_sms.sql` → **Run**.
- ou via CLI : `npx supabase link --project-ref <ref>` puis `bash migrate.sh`.

Puis forcer le rechargement du cache d'API PostgREST (sinon erreur *schema cache*) :

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 4. Configurer les secrets de l'Edge Function

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés
**automatiquement** par Supabase — ne pas les définir.

À renseigner (Dashboard → *Edge Functions → Secrets*, ou CLI) :

```bash
npx supabase link --project-ref <ref-du-projet>

npx supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_FROM=+1xxxxxxxxxx \
  SMS_DEFAULT_COUNTRY_CODE=+226
```

| Secret | Obligatoire | Rôle |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | ✅ | Identifiant du compte Twilio |
| `TWILIO_AUTH_TOKEN` | ✅ | Jeton d'authentification API |
| `TWILIO_FROM` | ✅ (ou `TWILIO_MESSAGING_SID`) | Numéro/Sender ID expéditeur |
| `TWILIO_MESSAGING_SID` | ✅ (ou `TWILIO_FROM`) | Messaging Service (alternative) |
| `SMS_DEFAULT_COUNTRY_CODE` | ⛔ optionnel | Indicatif ajouté aux numéros locaux. **Défaut `+226`** (Burkina Faso). Ex. `70000000` → `+22670000000`. |

---

## 5. Déployer l'Edge Function

```bash
npx supabase functions deploy notify-parieur-sms
```

---

## 6. Tester

1. **Numéro de test** : sur un compte trial, ajouter ton numéro dans
   *Verified Caller IDs*. Le saisir comme « Téléphone du gagnant » lors de la
   création d'une demande.
2. Faire avancer une demande jusqu'à **« Valider l'autorisation »** (Exploitation).
3. Vérifier la réception du SMS.
4. Onglet **Notifications SMS** (espace Exploitation) → la ligne doit être au
   statut **Envoyé**. Le bouton **Renvoyer le SMS** permet de relancer.

Test direct de la fonction (optionnel) :

```bash
curl -i -X POST \
  "https://<ref>.supabase.co/functions/v1/notify-parieur-sms" \
  -H "Authorization: Bearer <JWT_d_un_utilisateur_connecté>" \
  -H "Content-Type: application/json" \
  -d '{"demandeId": 123, "event": "authorized"}'
```

---

## 7. Diagnostic

- **Logs de la fonction** : Dashboard → *Edge Functions → notify-parieur-sms → Logs*.
- **Historique des envois** : table `paiement_gain_sms_notifications`
  (colonnes `statut`, `error`, `provider_sid`).

| Statut | Signification |
|---|---|
| `sent` | SMS accepté par Twilio (`provider_sid` renseigné) |
| `failed` | Erreur Twilio ou config incomplète (voir `error`) |
| `skipped` | Pas de numéro de téléphone exploitable sur la demande |

### Erreurs fréquentes
| Message | Cause / solution |
|---|---|
| `Configuration Twilio incomplète côté serveur.` | Secrets manquants → refaire l'étape 4 puis redéployer. |
| `Could not find the table … in schema cache` | Migration non appliquée / cache → étape 3 (`NOTIFY pgrst`). |
| Erreur 21408 / permission géographique | Pays non autorisé → étape 2.4 (Geo permissions). |
| Erreur 21608 (trial) | Numéro destinataire non vérifié → vérifier le numéro ou upgrader. |
| Numéro invalide | Le téléphone doit être en E.164 (`+226…`) ou local + `SMS_DEFAULT_COUNTRY_CODE`. |

---

## 8. Coûts & bonnes pratiques
- Tarification Twilio **à l'envoi** : voir https://www.twilio.com/sms/pricing (varie
  selon le pays de destination). Prévoir un budget mensuel.
- L'envoi est **best-effort** : un échec SMS **ne bloque jamais** le workflow métier
  (l'autorisation/refus/paiement reste enregistré ; seul un avertissement s'affiche).
- Garder l'`Auth Token` secret. Le régénérer dans la Console en cas de fuite, puis
  mettre à jour le secret et redéployer.
