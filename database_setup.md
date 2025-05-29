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

## Tables pour les Terminaux et Maintenance

Pour gérer les terminaux et les interventions de maintenance, exécutez les scripts suivants :

```sql
-- Création de la table des terminaux
CREATE TABLE IF NOT EXISTS public.terminaux (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    type_terminal TEXT NOT NULL DEFAULT '2020',
    position TEXT,
    adresse_ip TEXT,
    agence_id BIGINT REFERENCES public.agences(id) ON DELETE CASCADE,
    imprimante_reference TEXT,
    lecteur_reference TEXT,
    ecran_reference TEXT,
    statut TEXT NOT NULL DEFAULT 'Actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des codes de pannes
CREATE TABLE IF NOT EXISTS public.codes_pannes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des codes d'interventions préventives
CREATE TABLE IF NOT EXISTS public.codes_interventions (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des pièces de rechange
CREATE TABLE IF NOT EXISTS public.pieces_rechange (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    nom TEXT NOT NULL,
    type_equipement TEXT NOT NULL,
    description TEXT,
    stock_disponible INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des interventions de maintenance
CREATE TABLE IF NOT EXISTS public.interventions_maintenance (
    id BIGSERIAL PRIMARY KEY,
    terminal_id BIGINT REFERENCES public.terminaux(id) ON DELETE CASCADE,
    technicien_id BIGINT REFERENCES public.techniciens(id) ON DELETE SET NULL,
    type_intervention TEXT NOT NULL CHECK (type_intervention IN ('curative', 'preventive')),
    sous_ensemble TEXT NOT NULL,
    code_panne_id BIGINT REFERENCES public.codes_pannes(id) ON DELETE SET NULL,
    code_intervention_id BIGINT REFERENCES public.codes_interventions(id) ON DELETE SET NULL,
    piece_remplacee_id BIGINT REFERENCES public.pieces_rechange(id) ON DELETE SET NULL,
    commentaire TEXT,
    equipement_remplace BOOLEAN DEFAULT FALSE,
    reference_remplacement TEXT,
    statut TEXT NOT NULL DEFAULT 'En cours',
    date_intervention TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date_fin TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ajout des contraintes
ALTER TABLE public.terminaux 
ADD CONSTRAINT terminaux_type_terminal_check 
CHECK (type_terminal IN ('2020', '2032'));

ALTER TABLE public.terminaux 
ADD CONSTRAINT terminaux_statut_check 
CHECK (statut IN ('Actif', 'Inactif', 'En maintenance', 'Hors service'));

ALTER TABLE public.pieces_rechange 
ADD CONSTRAINT pieces_rechange_type_equipement_check 
CHECK (type_equipement IN ('Imprimante', 'Écran', 'Lecteur', 'Général'));

ALTER TABLE public.interventions_maintenance 
ADD CONSTRAINT interventions_maintenance_statut_check 
CHECK (statut IN ('En cours', 'Terminée', 'En attente', 'Annulée'));

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_terminaux_reference ON public.terminaux(reference);
CREATE INDEX IF NOT EXISTS idx_terminaux_agence_id ON public.terminaux(agence_id);
CREATE INDEX IF NOT EXISTS idx_terminaux_statut ON public.terminaux(statut);
CREATE INDEX IF NOT EXISTS idx_codes_pannes_code ON public.codes_pannes(code);
CREATE INDEX IF NOT EXISTS idx_codes_interventions_code ON public.codes_interventions(code);
CREATE INDEX IF NOT EXISTS idx_pieces_rechange_reference ON public.pieces_rechange(reference);
CREATE INDEX IF NOT EXISTS idx_pieces_rechange_type_equipement ON public.pieces_rechange(type_equipement);
CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_terminal_id ON public.interventions_maintenance(terminal_id);
CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_technicien_id ON public.interventions_maintenance(technicien_id);
CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_date ON public.interventions_maintenance(date_intervention);
CREATE INDEX IF NOT EXISTS idx_interventions_maintenance_statut ON public.interventions_maintenance(statut);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.terminaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_pannes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieces_rechange ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions_maintenance ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité pour permettre toutes les opérations aux utilisateurs authentifiés
CREATE POLICY "Enable all operations for authenticated users" ON public.terminaux
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.codes_pannes
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.codes_interventions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.pieces_rechange
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.interventions_maintenance
    FOR ALL USING (auth.role() = 'authenticated');

-- Triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER handle_terminaux_updated_at
    BEFORE UPDATE ON public.terminaux
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_pieces_rechange_updated_at
    BEFORE UPDATE ON public.pieces_rechange
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_interventions_maintenance_updated_at
    BEFORE UPDATE ON public.interventions_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Insertion de données initiales pour les codes de pannes
INSERT INTO public.codes_pannes (code, libelle, description) VALUES
('P-001', 'Carte mère défaillante', 'Problème électronique de la carte mère'),
('P-002', 'Alimentation défectueuse', 'Problème d''alimentation électrique'),
('P-003', 'Problème d''affichage', 'Dysfonctionnement de l''écran ou affichage'),
('P-004', 'Imprimante bloquée', 'Bourrage papier ou problème mécanique'),
('P-005', 'Lecteur défaillant', 'Problème de lecture des cartes ou codes'),
('P-006', 'Connectivité réseau', 'Problème de connexion réseau ou IP')
ON CONFLICT (code) DO NOTHING;

-- Insertion de données initiales pour les codes d'interventions
INSERT INTO public.codes_interventions (code, libelle, description) VALUES
('I-001', 'Maintenance préventive mensuelle', 'Contrôle et nettoyage mensuel'),
('I-002', 'Maintenance préventive trimestrielle', 'Vérification approfondie trimestrielle'),
('I-003', 'Mise à jour logicielle', 'Installation de mises à jour système'),
('I-004', 'Calibrage équipements', 'Recalibrage des composants'),
('I-005', 'Nettoyage approfondi', 'Nettoyage complet et désinfection')
ON CONFLICT (code) DO NOTHING;

-- Insertion de données initiales pour les pièces de rechange
INSERT INTO public.pieces_rechange (reference, nom, type_equipement, description, stock_disponible) VALUES
('ROL-001', 'Rouleau thermique standard', 'Imprimante', 'Rouleau de papier thermique 80mm', 50),
('ROL-002', 'Rouleau thermique premium', 'Imprimante', 'Rouleau de papier thermique haute qualité 80mm', 25),
('CAR-001', 'Carte électronique principale', 'Général', 'Carte mère de remplacement pour terminaux', 5),
('ECR-001', 'Écran LCD 15 pouces', 'Écran', 'Écran de remplacement 15 pouces', 3),
('LEC-001', 'Module lecteur de cartes', 'Lecteur', 'Module lecteur cartes magnétiques', 8),
('ALI-001', 'Alimentation 12V', 'Général', 'Bloc alimentation 12V 5A', 10),
('CAB-001', 'Câble réseau RJ45', 'Général', 'Câble Ethernet Cat6 3m', 20),
('FIL-001', 'Filtre à poussière', 'Général', 'Filtre pour ventilation interne', 15)
ON CONFLICT (reference) DO NOTHING;

-- Commentaires sur les nouvelles tables
COMMENT ON TABLE public.terminaux IS 'Table des terminaux de point de vente';
COMMENT ON TABLE public.codes_pannes IS 'Table des codes de pannes prédéfinis';
COMMENT ON TABLE public.codes_interventions IS 'Table des codes d''interventions préventives';
COMMENT ON TABLE public.pieces_rechange IS 'Table des pièces de rechange disponibles';
COMMENT ON TABLE public.interventions_maintenance IS 'Table des interventions de maintenance';

COMMENT ON COLUMN public.terminaux.reference IS 'Référence unique du terminal';
COMMENT ON COLUMN public.terminaux.type_terminal IS 'Type de terminal (2020, 2032)';
COMMENT ON COLUMN public.terminaux.position IS 'Position physique du terminal';
COMMENT ON COLUMN public.terminaux.adresse_ip IS 'Adresse IP du terminal';
COMMENT ON COLUMN public.terminaux.agence_id IS 'Référence vers l''agence';
COMMENT ON COLUMN public.terminaux.imprimante_reference IS 'Référence de l''imprimante associée';
COMMENT ON COLUMN public.terminaux.lecteur_reference IS 'Référence du lecteur associé';
COMMENT ON COLUMN public.terminaux.ecran_reference IS 'Référence de l''écran associé';
```

## Tables d'Équipements pour la Maintenance

Pour ajouter la gestion des équipements (Imprimantes, Écrans, Lecteurs) dans l'espace Maintenance, exécutez les scripts suivants :

```sql
-- Création de la table des imprimantes
CREATE TABLE IF NOT EXISTS public.equipments_imprimantes (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    modele TEXT NOT NULL,
    marque TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'Disponible',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des écrans
CREATE TABLE IF NOT EXISTS public.equipments_ecrans (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    modele TEXT NOT NULL,
    marque TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'Disponible',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table des lecteurs
CREATE TABLE IF NOT EXISTS public.equipments_lecteurs (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    modele TEXT NOT NULL,
    marque TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'Disponible',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ajout des contraintes de statut
ALTER TABLE public.equipments_imprimantes 
ADD CONSTRAINT equipments_imprimantes_statut_check 
CHECK (statut IN ('Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'));

ALTER TABLE public.equipments_ecrans 
ADD CONSTRAINT equipments_ecrans_statut_check 
CHECK (statut IN ('Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'));

ALTER TABLE public.equipments_lecteurs 
ADD CONSTRAINT equipments_lecteurs_statut_check 
CHECK (statut IN ('Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'));

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_equipments_imprimantes_reference ON public.equipments_imprimantes(reference);
CREATE INDEX IF NOT EXISTS idx_equipments_imprimantes_statut ON public.equipments_imprimantes(statut);
CREATE INDEX IF NOT EXISTS idx_equipments_ecrans_reference ON public.equipments_ecrans(reference);
CREATE INDEX IF NOT EXISTS idx_equipments_ecrans_statut ON public.equipments_ecrans(statut);
CREATE INDEX IF NOT EXISTS idx_equipments_lecteurs_reference ON public.equipments_lecteurs(reference);
CREATE INDEX IF NOT EXISTS idx_equipments_lecteurs_statut ON public.equipments_lecteurs(statut);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.equipments_imprimantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments_ecrans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments_lecteurs ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité pour permettre toutes les opérations aux utilisateurs authentifiés
CREATE POLICY "Enable all operations for authenticated users" ON public.equipments_imprimantes
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.equipments_ecrans
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.equipments_lecteurs
    FOR ALL USING (auth.role() = 'authenticated');

-- Triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER handle_equipments_imprimantes_updated_at
    BEFORE UPDATE ON public.equipments_imprimantes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_equipments_ecrans_updated_at
    BEFORE UPDATE ON public.equipments_ecrans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_equipments_lecteurs_updated_at
    BEFORE UPDATE ON public.equipments_lecteurs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Commentaires sur les tables et colonnes
COMMENT ON TABLE public.equipments_imprimantes IS 'Table des imprimantes disponibles pour les terminaux';
COMMENT ON TABLE public.equipments_ecrans IS 'Table des écrans disponibles pour les terminaux';
COMMENT ON TABLE public.equipments_lecteurs IS 'Table des lecteurs disponibles pour les terminaux';

COMMENT ON COLUMN public.equipments_imprimantes.reference IS 'Référence unique de l\'imprimante';
COMMENT ON COLUMN public.equipments_imprimantes.modele IS 'Modèle de l\'imprimante';
COMMENT ON COLUMN public.equipments_imprimantes.marque IS 'Marque de l\'imprimante';
COMMENT ON COLUMN public.equipments_imprimantes.statut IS 'Statut de l\'imprimante (Disponible, En service, En panne, En maintenance, Hors service)';
COMMENT ON COLUMN public.equipments_imprimantes.description IS 'Description optionnelle de l\'imprimante';

COMMENT ON COLUMN public.equipments_ecrans.reference IS 'Référence unique de l\'écran';
COMMENT ON COLUMN public.equipments_ecrans.modele IS 'Modèle de l\'écran';
COMMENT ON COLUMN public.equipments_ecrans.marque IS 'Marque de l\'écran';
COMMENT ON COLUMN public.equipments_ecrans.statut IS 'Statut de l\'écran (Disponible, En service, En panne, En maintenance, Hors service)';
COMMENT ON COLUMN public.equipments_ecrans.description IS 'Description optionnelle de l\'écran';

COMMENT ON COLUMN public.equipments_lecteurs.reference IS 'Référence unique du lecteur';
COMMENT ON COLUMN public.equipments_lecteurs.modele IS 'Modèle du lecteur';
COMMENT ON COLUMN public.equipments_lecteurs.marque IS 'Marque du lecteur';
COMMENT ON COLUMN public.equipments_lecteurs.statut IS 'Statut du lecteur (Disponible, En service, En panne, En maintenance, Hors service)';
COMMENT ON COLUMN public.equipments_lecteurs.description IS 'Description optionnelle du lecteur';
```

### Instructions d'exécution :

1. Connectez-vous à votre tableau de bord Supabase
2. Allez dans l'onglet "SQL Editor"
3. Copiez et collez le script SQL ci-dessus
4. Cliquez sur "Run" pour exécuter le script

### Vérification :

Après l'exécution du script, vous devriez voir les nouvelles tables dans l'onglet "Table Editor" de votre projet Supabase.

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

### Structure de la table Terminaux :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| reference | TEXT | UNIQUE, NOT NULL | Référence unique du terminal |
| type_terminal | TEXT | NOT NULL, CHECK | Type de terminal (2020, 2032) |
| position | TEXT | NULL | Position physique du terminal |
| adresse_ip | TEXT | NULL | Adresse IP du terminal |
| agence_id | BIGINT | FOREIGN KEY | Référence vers l'agence |
| imprimante_reference | TEXT | NULL | Référence de l'imprimante associée |
| lecteur_reference | TEXT | NULL | Référence du lecteur associé |
| ecran_reference | TEXT | NULL | Référence de l'écran associé |
| statut | TEXT | NOT NULL, CHECK | Statut du terminal |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

### Structure des tables d'Équipements :

Chaque table d'équipement (imprimantes, écrans, lecteurs) a la même structure :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| reference | TEXT | UNIQUE, NOT NULL | Référence unique de l'équipement |
| modele | TEXT | NOT NULL | Modèle de l'équipement |
| marque | TEXT | NOT NULL | Marque de l'équipement |
| statut | TEXT | NOT NULL, CHECK | Statut (Disponible, En service, En panne, En maintenance, Hors service) |
| description | TEXT | NULL | Description optionnelle |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

### Permissions :

Toutes les tables sont configurées avec Row Level Security (RLS) activé et des politiques qui permettent toutes les opérations aux utilisateurs authentifiés.

### Storage :

Les photos des techniciens seront stockées dans le bucket `pmu-mali-storage` sous le dossier `photos_techniciens/`. 