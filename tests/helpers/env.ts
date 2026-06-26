// Identifiants de connexion par espace, lus depuis les variables d'environnement.
// Renseignez-les avant de lancer la suite (cf. tests/README.md). Un espace sans
// identifiant verra ses tests automatiquement ignorés (test.skip) plutôt qu'échouer.
//
// Exemple (PowerShell) :
//   $env:EXPLOITATION_EMAIL="admin@exemple.com"; $env:EXPLOITATION_PASSWORD="..."
//   npx playwright test

export interface Creds {
  email?: string;
  password?: string;
  /** Identifiant alternatif (matricule / code préposé) pour les espaces qui ne se connectent pas par email. */
  identifier?: string;
}

const c = (email?: string, password?: string, identifier?: string): Creds => ({ email, password, identifier });

export const CREDS = {
  exploitation: c(process.env.EXPLOITATION_EMAIL, process.env.EXPLOITATION_PASSWORD),
  chefAgence: c(process.env.CHEF_AGENCE_EMAIL, process.env.CHEF_AGENCE_PASSWORD, process.env.CHEF_AGENCE_IDENTIFIER),
  chefSecteur: c(process.env.CHEF_SECTEUR_EMAIL, process.env.CHEF_SECTEUR_PASSWORD, process.env.CHEF_SECTEUR_IDENTIFIER),
  guichetiere: c(process.env.GUICHETIERE_EMAIL, process.env.GUICHETIERE_PASSWORD, process.env.GUICHETIERE_IDENTIFIER),
  technicien: c(process.env.TECHNICIEN_EMAIL, process.env.TECHNICIEN_PASSWORD, process.env.TECHNICIEN_IDENTIFIER),
  directeurRegional: c(process.env.DIR_REGIONAL_EMAIL, process.env.DIR_REGIONAL_PASSWORD),
  directeurGeneral: c(process.env.DIR_GENERAL_EMAIL, process.env.DIR_GENERAL_PASSWORD),
} as const;

/** Un identifiant est-il exploitable (email+mdp OU identifier+mdp) ? */
export const hasCreds = (creds: Creds): boolean =>
  Boolean(creds.password && (creds.email || creds.identifier));

// Données de test optionnelles pour les scénarios métier (pointage, paiement…).
export const WORKFLOW_DATA = {
  /** Matricule d'une guichetière PLANIFIÉE aujourd'hui (pour le flux Pointage). */
  pointageMatricule: process.env.POINTAGE_MATRICULE,
  /** Numéro de ticket gagnant (pour amorcer un Paiement Gros Gain). */
  ticketGagnant: process.env.PAIEMENT_TICKET,
} as const;
