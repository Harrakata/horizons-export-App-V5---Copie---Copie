# Edge Function : `notify-parieur-sms`

Envoie un SMS au parieur (gagnant) via **Twilio** à trois moments du workflow de
paiement de gain :

| `event`      | Déclenché depuis                                   | Message |
|--------------|---------------------------------------------------|---------|
| `authorized` | Exploitation → « Valider l'autorisation »         | Gain autorisé, agence de paiement désignée |
| `rejected`   | Chef d'agence → « Refuser la demande »            | Demande non validée |
| `paid`       | Chef d'agence → « Confirmer le paiement final »   | Paiement effectué |

Le numéro de téléphone provient de la colonne `demandes_paiement_gain."telephoneGagnant"`
(saisi à la création de la demande). Chaque tentative est journalisée dans
`paiement_gain_sms_notifications` (statut `sent` / `failed` / `skipped`).

## 1. Pré-requis base de données

Appliquer la migration :

```
supabase/migrations/add_paiement_gain_sms.sql
```

(ou via `migrate.sh`, déjà ajoutée au `manifest.txt`).

## 2. Secrets à configurer

Créer un compte Twilio, puis :

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=your_auth_token \
  TWILIO_FROM=+1xxxxxxxxxx
```

Variantes possibles :

- `TWILIO_MESSAGING_SID` peut remplacer `TWILIO_FROM` (Messaging Service Twilio).
- `SMS_DEFAULT_COUNTRY_CODE` (défaut `+226`, Burkina Faso) : indicatif ajouté
  automatiquement aux numéros saisis sans préfixe international (ex. `70000000`
  → `+22670000000`).

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà
injectés par Supabase.

## 3. Déploiement

```bash
supabase functions deploy notify-parieur-sms
```

## 4. Comportement

- **Best-effort** : un échec d'envoi (ou un numéro absent/invalide) ne bloque ni
  n'annule jamais l'action métier (autorisation / refus / paiement). Le front
  affiche seulement un avertissement « SMS non envoyé ».
- **Sécurité** : la fonction exige un JWT Supabase valide (utilisateur connecté).
  Les secrets Twilio et la `service_role` restent exclusivement côté serveur.
- **Traçabilité** : voir la table `paiement_gain_sms_notifications`.
