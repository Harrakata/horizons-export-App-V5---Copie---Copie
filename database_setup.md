# Configuration de la base de données

## Table Techniciens

Pour ajouter la fonctionnalité Techniciens, vous devez créer la table `techniciens` dans votre base de données Supabase.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
-- Création de la table techniciens
CREATE TABLE IF NOT EXISTS public.techniciens (
    id BIGSERIAL PRIMARY KEY,
    matricule TEXT UNIQUE NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    telephone TEXT,
    email TEXT NOT NULL,
    motDePasse TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ajout des contraintes
ALTER TABLE public.techniciens 
ADD CONSTRAINT techniciens_email_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_techniciens_matricule ON public.techniciens(matricule);
CREATE INDEX IF NOT EXISTS idx_techniciens_email ON public.techniciens(email);
CREATE INDEX IF NOT EXISTS idx_techniciens_nom_prenom ON public.techniciens(nom, prenom);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.techniciens ENABLE ROW LEVEL SECURITY;

-- Politique de sécurité pour permettre toutes les opérations aux utilisateurs authentifiés
CREATE POLICY "Enable all operations for authenticated users" ON public.techniciens
    FOR ALL USING (auth.role() = 'authenticated');

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER handle_techniciens_updated_at
    BEFORE UPDATE ON public.techniciens
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE public.techniciens IS 'Table des techniciens de maintenance';
COMMENT ON COLUMN public.techniciens.matricule IS 'Matricule unique du technicien';
COMMENT ON COLUMN public.techniciens.nom IS 'Nom de famille du technicien';
COMMENT ON COLUMN public.techniciens.prenom IS 'Prénom du technicien';
COMMENT ON COLUMN public.techniciens.telephone IS 'Numéro de téléphone du technicien';
COMMENT ON COLUMN public.techniciens.email IS 'Adresse email du technicien';
COMMENT ON COLUMN public.techniciens.motDePasse IS 'Mot de passe du technicien';
COMMENT ON COLUMN public.techniciens.photo_url IS 'URL de la photo du technicien stockée dans Supabase Storage';
```

## Mise à jour de la table Agences

Pour ajouter le champ "Région" à la table agences existante, exécutez le script suivant :

```sql
-- Ajout du champ région à la table agences
ALTER TABLE public.agences 
ADD COLUMN IF NOT EXISTS region TEXT;

-- Création d'un index pour améliorer les performances de recherche par région
CREATE INDEX IF NOT EXISTS idx_agences_region ON public.agences(region);

-- Commentaire sur la nouvelle colonne
COMMENT ON COLUMN public.agences.region IS 'Région géographique de l\'agence';
```

### Instructions d'exécution :

1. Connectez-vous à votre tableau de bord Supabase
2. Allez dans l'onglet "SQL Editor"
3. Copiez et collez le script SQL ci-dessus
4. Cliquez sur "Run" pour exécuter le script

### Vérification :

Après l'exécution du script, vous devriez voir la nouvelle table `techniciens` dans l'onglet "Table Editor" de votre projet Supabase.

### Structure de la table Techniciens :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| matricule | TEXT | UNIQUE, NOT NULL | Matricule unique du technicien |
| nom | TEXT | NOT NULL | Nom de famille |
| prenom | TEXT | NOT NULL | Prénom |
| telephone | TEXT | NULL | Numéro de téléphone (optionnel) |
| email | TEXT | NOT NULL, CHECK | Adresse email avec validation |
| motDePasse | TEXT | NOT NULL | Mot de passe |
| photo_url | TEXT | NULL | URL de la photo (optionnel) |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

### Structure mise à jour de la table Agences :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| nom | TEXT | NOT NULL | Nom de l'agence |
| codePDV | TEXT | UNIQUE, NOT NULL | Code point de vente unique |
| adresse | TEXT | NULL | Adresse de l'agence (optionnel) |
| region | TEXT | NULL | Région géographique (optionnel) |
| nbreTerminaux | INTEGER | NOT NULL | Nombre de terminaux |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

### Permissions :

La table est configurée avec Row Level Security (RLS) activé et une politique qui permet toutes les opérations aux utilisateurs authentifiés.

### Storage :

Les photos des techniciens seront stockées dans le bucket `pmu-mali-storage` sous le dossier `photos_techniciens/`. 