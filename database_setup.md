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

## Table Régions

La gestion des régions est désormais centralisée dans la table `regions`.  
Les écrans `Agences`, `Point de Vente Mobi` et `Validateur Paiement Gain` utilisent cette table pour renseigner les champs région.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.regions (
  id BIGSERIAL PRIMARY KEY,
  "codeRegion" TEXT UNIQUE NOT NULL,
  nom TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.regions
ADD COLUMN IF NOT EXISTS "codeRegion" TEXT;

UPDATE public.regions
SET "codeRegion" = CONCAT('REG-', id)
WHERE "codeRegion" IS NULL OR trim("codeRegion") = '';

ALTER TABLE public.regions
ALTER COLUMN "codeRegion" SET NOT NULL;

ALTER TABLE public.regions
DROP CONSTRAINT IF EXISTS regions_statut_check;

ALTER TABLE public.regions
DROP COLUMN IF EXISTS statut;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regions_code_region_unique ON public.regions("codeRegion");
CREATE INDEX IF NOT EXISTS idx_regions_nom ON public.regions(nom);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'regions'
      AND policyname = 'Enable all operations for authenticated users on regions'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users on regions"
      ON public.regions
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_regions_updated_at ON public.regions;

CREATE TRIGGER handle_regions_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
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

Les valeurs du champ `agences.region` doivent maintenant être choisies parmi les régions enregistrées dans `public.regions`.

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

## Table Planning Maintenance

Pour gérer la planification des maintenances par agence, technicien et créneau (`Matin` / `Après-midi`), exécutez aussi le script suivant :

```sql
DO $$
DECLARE
    agence_id_type TEXT;
    technicien_id_type TEXT;
BEGIN
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO agence_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'agences'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO technicien_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'techniciens'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF agence_id_type IS NULL THEN
        RAISE EXCEPTION 'Impossible de déterminer le type de public.agences.id';
    END IF;

    IF technicien_id_type IS NULL THEN
        RAISE EXCEPTION 'Impossible de déterminer le type de public.techniciens.id';
    END IF;

    EXECUTE format($table$
        CREATE TABLE IF NOT EXISTS public.planning_maintenance (
            id BIGSERIAL PRIMARY KEY,
            date_planification DATE NOT NULL,
            creneau TEXT NOT NULL CHECK (creneau IN ('matin', 'apres_midi')),
            region TEXT,
            agence_id %1$s REFERENCES public.agences(id) ON DELETE CASCADE,
            agence_nom TEXT NOT NULL,
            technicien_id %2$s REFERENCES public.techniciens(id) ON DELETE SET NULL,
            technicien_label TEXT NOT NULL,
            technicien_matricule TEXT,
            notes TEXT,
            statut TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'annulee')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        )
    $table$, agence_id_type, technicien_id_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_date
ON public.planning_maintenance(date_planification);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_agence
ON public.planning_maintenance(agence_id);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_technicien
ON public.planning_maintenance(technicien_id);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_creneau
ON public.planning_maintenance(creneau);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_statut
ON public.planning_maintenance(statut);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_planning_maintenance_agence_creneau
ON public.planning_maintenance(date_planification, creneau, agence_id)
WHERE statut = 'planifiee';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_planning_maintenance_technicien_creneau
ON public.planning_maintenance(date_planification, creneau, technicien_id)
WHERE statut = 'planifiee';

ALTER TABLE public.planning_maintenance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'planning_maintenance'
      AND policyname = 'Allow app access on planning_maintenance'
  ) THEN
    CREATE POLICY "Allow app access on planning_maintenance"
      ON public.planning_maintenance
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_planning_maintenance_updated_at
ON public.planning_maintenance;

CREATE TRIGGER handle_planning_maintenance_updated_at
    BEFORE UPDATE ON public.planning_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.planning_maintenance IS 'Planning des maintenances par agence, technicien, date et créneau';
COMMENT ON COLUMN public.planning_maintenance.date_planification IS 'Date prévue pour la maintenance';
COMMENT ON COLUMN public.planning_maintenance.creneau IS 'Créneau de maintenance : matin ou apres_midi';
COMMENT ON COLUMN public.planning_maintenance.region IS 'Région de l agence planifiée';
COMMENT ON COLUMN public.planning_maintenance.agence_id IS 'Agence concernée par la maintenance';
COMMENT ON COLUMN public.planning_maintenance.technicien_id IS 'Technicien affecté';
COMMENT ON COLUMN public.planning_maintenance.notes IS 'Consignes et commentaires de planification';
COMMENT ON COLUMN public.planning_maintenance.statut IS 'Statut administratif du planning : planifiee ou annulee';
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

## Table Terminaux Mobi

Pour ajouter l'onglet `Terminaux Mobi` dans l'espace Exploitation, créez la table `terminaux_mobi` dans Supabase avec les colonnes affichées dans l'application.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE TABLE IF NOT EXISTS public.terminaux_mobi (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    modele TEXT NOT NULL,
    imei1 TEXT UNIQUE NOT NULL,
    imei2 TEXT,
    "dateMiseEnService" DATE NOT NULL,
    statut TEXT NOT NULL DEFAULT 'Actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.terminaux_mobi
ADD CONSTRAINT terminaux_mobi_statut_check
CHECK (statut IN ('Actif', 'Inactif'));

CREATE INDEX IF NOT EXISTS idx_terminaux_mobi_reference ON public.terminaux_mobi(reference);
CREATE INDEX IF NOT EXISTS idx_terminaux_mobi_imei1 ON public.terminaux_mobi(imei1);
CREATE INDEX IF NOT EXISTS idx_terminaux_mobi_imei2 ON public.terminaux_mobi(imei2);
CREATE INDEX IF NOT EXISTS idx_terminaux_mobi_date_mise_service ON public.terminaux_mobi("dateMiseEnService");
CREATE INDEX IF NOT EXISTS idx_terminaux_mobi_statut ON public.terminaux_mobi(statut);

ALTER TABLE public.terminaux_mobi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users on terminaux_mobi" ON public.terminaux_mobi
    FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER handle_terminaux_mobi_updated_at
    BEFORE UPDATE ON public.terminaux_mobi
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.terminaux_mobi IS 'Table des terminaux mobi en exploitation';
COMMENT ON COLUMN public.terminaux_mobi.reference IS 'Référence unique du terminal mobi';
COMMENT ON COLUMN public.terminaux_mobi.modele IS 'Modèle du terminal mobi';
COMMENT ON COLUMN public.terminaux_mobi.imei1 IS 'Premier IMEI du terminal mobi';
COMMENT ON COLUMN public.terminaux_mobi.imei2 IS 'Second IMEI du terminal mobi';
COMMENT ON COLUMN public.terminaux_mobi."dateMiseEnService" IS 'Date de mise en service du terminal mobi';
COMMENT ON COLUMN public.terminaux_mobi.statut IS 'État du terminal mobi : Actif ou Inactif';
```

### Structure de la table Terminaux Mobi :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| reference | TEXT | UNIQUE, NOT NULL | Référence unique du terminal |
| modele | TEXT | NOT NULL | Modèle |
| imei1 | TEXT | UNIQUE, NOT NULL | IMEI principal |
| imei2 | TEXT | NULL | IMEI secondaire |
| dateMiseEnService | DATE | NOT NULL | Date de mise en service |
| statut | TEXT | NOT NULL, CHECK | Statut du terminal : Actif ou Inactif |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

## Table Points de Vente Mobi

Pour ajouter l'onglet `Point de Vente Mobi` dans l'espace Exploitation, créez la table `points_vente_mobi` pour stocker la version active et l'historique des associations.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE TABLE IF NOT EXISTS public.points_vente_mobi (
    id BIGSERIAL PRIMARY KEY,
    "pointVenteUid" TEXT NOT NULL,
    "codePointVente" TEXT NOT NULL,
    region TEXT NOT NULL,
    "agenceNom" TEXT NOT NULL,
    "agenceCodePDV" TEXT,
    "terminalReference" TEXT NOT NULL,
    "terminalModele" TEXT,
    "guichetiereMatricule" TEXT NOT NULL,
    "guichetiereNom" TEXT,
    "dateDebutValidite" DATE NOT NULL,
    "dateFinValidite" DATE,
    statut TEXT NOT NULL DEFAULT 'Actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.points_vente_mobi
ADD CONSTRAINT points_vente_mobi_statut_check
CHECK (statut IN ('Actif', 'Inactif'));

CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_uid ON public.points_vente_mobi("pointVenteUid");
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_code ON public.points_vente_mobi("codePointVente");
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_agence ON public.points_vente_mobi("agenceNom");
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_terminal ON public.points_vente_mobi("terminalReference");
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_guichetiere ON public.points_vente_mobi("guichetiereMatricule");
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_region ON public.points_vente_mobi(region);
CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_dates ON public.points_vente_mobi("dateDebutValidite", "dateFinValidite");

CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_vente_mobi_actif_code
ON public.points_vente_mobi("codePointVente")
WHERE statut = 'Actif';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_vente_mobi_actif_terminal
ON public.points_vente_mobi("terminalReference")
WHERE statut = 'Actif';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_vente_mobi_actif_guichetiere
ON public.points_vente_mobi("guichetiereMatricule")
WHERE statut = 'Actif';

ALTER TABLE public.points_vente_mobi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users on points_vente_mobi" ON public.points_vente_mobi
    FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER handle_points_vente_mobi_updated_at
    BEFORE UPDATE ON public.points_vente_mobi
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.points_vente_mobi IS 'Historique des associations des points de vente mobi';
COMMENT ON COLUMN public.points_vente_mobi."pointVenteUid" IS 'Identifiant logique stable pour regrouper toutes les versions historiques d un même point de vente mobi';
COMMENT ON COLUMN public.points_vente_mobi."codePointVente" IS 'Code métier affiché du point de vente mobi';
COMMENT ON COLUMN public.points_vente_mobi.region IS 'Région associée au point de vente mobi';
COMMENT ON COLUMN public.points_vente_mobi."agenceNom" IS 'Nom de l agence associée';
COMMENT ON COLUMN public.points_vente_mobi."agenceCodePDV" IS 'Code PDV de l agence associée';
COMMENT ON COLUMN public.points_vente_mobi."terminalReference" IS 'Référence du terminal mobi associé';
COMMENT ON COLUMN public.points_vente_mobi."terminalModele" IS 'Modèle du terminal mobi associé';
COMMENT ON COLUMN public.points_vente_mobi."guichetiereMatricule" IS 'Matricule de la guichetière associée';
COMMENT ON COLUMN public.points_vente_mobi."guichetiereNom" IS 'Nom complet de la guichetière au moment de l association';
COMMENT ON COLUMN public.points_vente_mobi."dateDebutValidite" IS 'Date de début de validité de la version';
COMMENT ON COLUMN public.points_vente_mobi."dateFinValidite" IS 'Date de fin de validité de la version';
COMMENT ON COLUMN public.points_vente_mobi.statut IS 'Statut de la version : Actif ou Inactif';
```

### Structure de la table Points de Vente Mobi :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| pointVenteUid | TEXT | NOT NULL | Identifiant logique du point de vente à travers ses versions |
| codePointVente | TEXT | NOT NULL | Code métier du point de vente mobi |
| region | TEXT | NOT NULL | Région associée |
| agenceNom | TEXT | NOT NULL | Agence associée |
| agenceCodePDV | TEXT | NULL | Code PDV de l’agence |
| terminalReference | TEXT | NOT NULL | Référence du terminal mobi associé |
| terminalModele | TEXT | NULL | Modèle du terminal mobi |
| guichetiereMatricule | TEXT | NOT NULL | Matricule de la guichetière associée |
| guichetiereNom | TEXT | NULL | Nom complet de la guichetière |
| dateDebutValidite | DATE | NOT NULL | Date de début de validité |
| dateFinValidite | DATE | NULL | Date de fin de validité |
| statut | TEXT | NOT NULL, CHECK | Statut de la version : Actif ou Inactif |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

## Table Profils Exploitation

Pour ajouter l'onglet `Profils Exploitation` dans l'espace Exploitation, créez la table `profils_exploitation` afin de gérer les comptes internes et leurs permissions de lecture ou d'écriture sur les onglets du menu Exploitation.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.profils_exploitation (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  "motDePasse" TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'Actif',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profils_exploitation_statut_check'
  ) THEN
    ALTER TABLE public.profils_exploitation
    ADD CONSTRAINT profils_exploitation_statut_check
    CHECK (statut IN ('Actif', 'Inactif'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profils_exploitation_email_unique'
  ) THEN
    ALTER TABLE public.profils_exploitation
    ADD CONSTRAINT profils_exploitation_email_unique UNIQUE (email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profils_exploitation_email
ON public.profils_exploitation(email);

CREATE INDEX IF NOT EXISTS idx_profils_exploitation_statut
ON public.profils_exploitation(statut);

ALTER TABLE public.profils_exploitation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profils_exploitation'
      AND policyname = 'Allow app access on profils_exploitation'
  ) THEN
    CREATE POLICY "Allow app access on profils_exploitation"
      ON public.profils_exploitation
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_profils_exploitation_updated_at
ON public.profils_exploitation;

CREATE TRIGGER handle_profils_exploitation_updated_at
  BEFORE UPDATE ON public.profils_exploitation
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### Structure de la table Profils Exploitation :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| nom | TEXT | NOT NULL | Nom de famille du profil Exploitation |
| prenom | TEXT | NOT NULL | Prénom du profil Exploitation |
| email | TEXT | NOT NULL, UNIQUE | Identifiant de connexion |
| telephone | TEXT | NULL | Numéro de téléphone |
| motDePasse | TEXT | NOT NULL | Mot de passe de connexion |
| statut | TEXT | NOT NULL, CHECK | Statut du profil : Actif ou Inactif |
| permissions | JSONB | NOT NULL | Permissions par onglet avec niveaux `none`, `read` ou `write` |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

## Tables Paiement Gros Gain

Pour activer le module de `Paiement Gros Gain`, il faut créer :

- `validateurs_paiement_gain` : profils de validation Directeur régional / Directeur général
- `demandes_paiement_gain` : demandes de paiement, état global et routage
- `paiement_gain_workflow_events` : journal de toutes les actions du workflow

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.validateurs_paiement_gain (
  id BIGSERIAL PRIMARY KEY,
  fonction TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  "regionAssignee" TEXT,
  "motDePasse" TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'Actif',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'validateurs_paiement_gain_fonction_check'
  ) THEN
    ALTER TABLE public.validateurs_paiement_gain
    ADD CONSTRAINT validateurs_paiement_gain_fonction_check
    CHECK (fonction IN ('Directeur régional', 'Directeur général'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'validateurs_paiement_gain_statut_check'
  ) THEN
    ALTER TABLE public.validateurs_paiement_gain
    ADD CONSTRAINT validateurs_paiement_gain_statut_check
    CHECK (statut IN ('Actif', 'Inactif'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_validateurs_paiement_gain_email
ON public.validateurs_paiement_gain(email);

CREATE INDEX IF NOT EXISTS idx_validateurs_paiement_gain_fonction
ON public.validateurs_paiement_gain(fonction);

CREATE INDEX IF NOT EXISTS idx_validateurs_paiement_gain_region
ON public.validateurs_paiement_gain("regionAssignee");

ALTER TABLE public.validateurs_paiement_gain ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validateurs_paiement_gain'
      AND policyname = 'Enable all operations for authenticated users on validateurs_paiement_gain'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users on validateurs_paiement_gain"
      ON public.validateurs_paiement_gain
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_validateurs_paiement_gain_updated_at
ON public.validateurs_paiement_gain;

CREATE TRIGGER handle_validateurs_paiement_gain_updated_at
  BEFORE UPDATE ON public.validateurs_paiement_gain
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.demandes_paiement_gain (
  id BIGSERIAL PRIMARY KEY,
  "codeDemande" TEXT NOT NULL,
  "montantGain" NUMERIC(18,2) NOT NULL,
  "montantTranche" TEXT NOT NULL,
  "procedureResume" TEXT,
  "modePaiement" TEXT,
  "lieuPaiement" TEXT,
  "identificationRequise" BOOLEAN NOT NULL DEFAULT false,
  "numeroCourse" TEXT,
  "typePari" TEXT,
  "localitePaiementSouhaitee" TEXT,
  "directeurRegionalId" BIGINT,
  "directeurRegionalName" TEXT,
  "directeurRegionalRegion" TEXT,
  "directeurGeneralId" BIGINT,
  "directeurGeneralName" TEXT,
  "dateReunionCourse" DATE,
  "dateCourse" DATE,
  "nomGagnant" TEXT,
  "prenomGagnant" TEXT,
  "telephoneGagnant" TEXT,
  "secteurResidence" TEXT,
  "provinceResidence" TEXT,
  "numeroPieceIdentite" TEXT,
  "dateEtablissementPiece" DATE,
  "autoritePieceIdentite" TEXT,
  "numeroTicketGagnant" TEXT,
  "photoPieceUrl" TEXT,
  "chefAgenceId" BIGINT,
  "chefAgenceMatricule" TEXT,
  "chefAgenceNom" TEXT,
  "agenceOrigineNom" TEXT,
  "agenceOrigineCodePDV" TEXT,
  "regionOrigine" TEXT,
  "agencePaiementNom" TEXT,
  "agencePaiementCodePDV" TEXT,
  "statutGlobal" TEXT NOT NULL,
  "niveauValidationCourant" TEXT NOT NULL,
  "circuitValidation" TEXT,
  "dateValidationChef" TIMESTAMP WITH TIME ZONE,
  "dateValidationDirecteurRegional" TIMESTAMP WITH TIME ZONE,
  "dateValidationDirecteurGeneral" TIMESTAMP WITH TIME ZONE,
  "dateAutorisationExploitation" TIMESTAMP WITH TIME ZONE,
  "datePaiementFinal" TIMESTAMP WITH TIME ZONE,
  "commentaireDerniereAction" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demandes_paiement_gain_statut_check'
  ) THEN
    ALTER TABLE public.demandes_paiement_gain
    ADD CONSTRAINT demandes_paiement_gain_statut_check
    CHECK ("statutGlobal" IN (
      'En attente chef d’agence',
      'En attente directeur régional',
      'En attente directeur général',
      'En attente exploitation',
      'Autorisée pour paiement',
      'Payée',
      'Refusée'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demandes_paiement_gain_niveau_check'
  ) THEN
    ALTER TABLE public.demandes_paiement_gain
    ADD CONSTRAINT demandes_paiement_gain_niveau_check
    CHECK ("niveauValidationCourant" IN (
      'chef_agence',
      'directeur_regional',
      'directeur_general',
      'exploitation',
      'agence_paiement',
      'terminee'
    ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_demandes_paiement_gain_code
ON public.demandes_paiement_gain("codeDemande");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_statut
ON public.demandes_paiement_gain("statutGlobal");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_niveau
ON public.demandes_paiement_gain("niveauValidationCourant");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_agence_origine
ON public.demandes_paiement_gain("agenceOrigineNom");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_agence_paiement
ON public.demandes_paiement_gain("agencePaiementNom");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_directeur_regional
ON public.demandes_paiement_gain("directeurRegionalId");

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_gain_directeur_general
ON public.demandes_paiement_gain("directeurGeneralId");

ALTER TABLE public.demandes_paiement_gain ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'demandes_paiement_gain'
      AND policyname = 'Enable all operations for authenticated users on demandes_paiement_gain'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users on demandes_paiement_gain"
      ON public.demandes_paiement_gain
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_demandes_paiement_gain_updated_at
ON public.demandes_paiement_gain;

CREATE TRIGGER handle_demandes_paiement_gain_updated_at
  BEFORE UPDATE ON public.demandes_paiement_gain
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.paiement_gain_workflow_events (
  id BIGSERIAL PRIMARY KEY,
  "demandeId" BIGINT NOT NULL REFERENCES public.demandes_paiement_gain(id) ON DELETE CASCADE,
  "codeDemande" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" BIGINT,
  "actorName" TEXT NOT NULL,
  "actorFunction" TEXT,
  "statusBefore" TEXT,
  "statusAfter" TEXT,
  commentaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_events_demande
ON public.paiement_gain_workflow_events("demandeId");

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_events_code
ON public.paiement_gain_workflow_events("codeDemande");

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_events_actor
ON public.paiement_gain_workflow_events("actorType", "actorId");

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_events_created_at
ON public.paiement_gain_workflow_events(created_at);

ALTER TABLE public.paiement_gain_workflow_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paiement_gain_workflow_events'
      AND policyname = 'Enable all operations for authenticated users on paiement_gain_workflow_events'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users on paiement_gain_workflow_events"
      ON public.paiement_gain_workflow_events
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
```

## Table Planning Modification Requests

Pour permettre aux guichetières d’envoyer des demandes d’indisponibilité ou de changement de date à leur chef d’agence, créez la table `planning_modification_requests`.

```sql
CREATE TABLE IF NOT EXISTS public.planning_modification_requests (
  id BIGSERIAL PRIMARY KEY,
  planning_id TEXT NOT NULL,
  guichetiere_id TEXT NOT NULL,
  guichetiere_matricule TEXT NOT NULL,
  guichetiere_nom TEXT,
  agence_nom TEXT NOT NULL,
  chef_agence_id TEXT,
  date_planning DATE NOT NULL,
  type_demande TEXT NOT NULL CHECK (type_demande IN ('indisponibilite', 'changement_date')),
  date_souhaitee DATE,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('En attente', 'Approuvée', 'Refusée', 'Annulée')),
  commentaire_traitement TEXT,
  traitee_par TEXT,
  date_traitement TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planning_modification_requests_agence
ON public.planning_modification_requests(agence_nom);

CREATE INDEX IF NOT EXISTS idx_planning_modification_requests_guichetiere
ON public.planning_modification_requests(guichetiere_matricule);

CREATE INDEX IF NOT EXISTS idx_planning_modification_requests_date
ON public.planning_modification_requests(date_planning);

CREATE INDEX IF NOT EXISTS idx_planning_modification_requests_statut
ON public.planning_modification_requests(statut);

ALTER TABLE public.planning_modification_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'planning_modification_requests'
      AND policyname = 'Allow app access on planning_modification_requests'
  ) THEN
    CREATE POLICY "Allow app access on planning_modification_requests"
      ON public.planning_modification_requests
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_planning_modification_requests_updated_at
ON public.planning_modification_requests;

CREATE TRIGGER handle_planning_modification_requests_updated_at
  BEFORE UPDATE ON public.planning_modification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

## Table Planning Maintenance Modification Requests

Pour permettre aux techniciens d’envoyer des demandes de modification de leur planning maintenance, avec validation successive par le chef d’agence puis l’Exploitation, créez la table `planning_maintenance_modification_requests`.

```sql
CREATE TABLE IF NOT EXISTS public.planning_maintenance_modification_requests (
  id BIGSERIAL PRIMARY KEY,
  planning_maintenance_id TEXT NOT NULL,
  technicien_id TEXT NOT NULL,
  technicien_matricule TEXT NOT NULL,
  technicien_nom TEXT,
  agence_id TEXT,
  agence_nom TEXT NOT NULL,
  region TEXT,
  date_planification DATE NOT NULL,
  creneau TEXT NOT NULL CHECK (creneau IN ('matin', 'apres_midi')),
  type_demande TEXT NOT NULL CHECK (type_demande IN ('indisponibilite', 'changement_date')),
  date_souhaitee DATE,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'En attente chef d''agence'
    CHECK (statut IN (
      'En attente chef d''agence',
      'En attente exploitation',
      'Approuvée',
      'Refusée par le chef d''agence',
      'Refusée par l''exploitation',
      'Annulée'
    )),
  commentaire_chef TEXT,
  commentaire_exploitation TEXT,
  traitee_par_chef TEXT,
  traitee_par_exploitation TEXT,
  date_traitement_chef TIMESTAMP WITH TIME ZONE,
  date_traitement_exploitation TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_mod_requests_agence
ON public.planning_maintenance_modification_requests(agence_nom);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_mod_requests_technicien
ON public.planning_maintenance_modification_requests(technicien_matricule);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_mod_requests_date
ON public.planning_maintenance_modification_requests(date_planification);

CREATE INDEX IF NOT EXISTS idx_planning_maintenance_mod_requests_statut
ON public.planning_maintenance_modification_requests(statut);

ALTER TABLE public.planning_maintenance_modification_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'planning_maintenance_modification_requests'
      AND policyname = 'Allow app access on planning_maintenance_modification_requests'
  ) THEN
    CREATE POLICY "Allow app access on planning_maintenance_modification_requests"
      ON public.planning_maintenance_modification_requests
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_planning_maintenance_modification_requests_updated_at
ON public.planning_maintenance_modification_requests;

CREATE TRIGGER handle_planning_maintenance_modification_requests_updated_at
  BEFORE UPDATE ON public.planning_maintenance_modification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

## Table Points Vente Mobi Change Requests

Pour permettre aux guichetières de demander une modification de leur point de vente mobi, créez la table `points_vente_mobi_change_requests`.

```sql
CREATE TABLE IF NOT EXISTS public.points_vente_mobi_change_requests (
  id BIGSERIAL PRIMARY KEY,
  point_vente_uid TEXT NOT NULL,
  code_point_vente TEXT NOT NULL,
  guichetiere_matricule TEXT NOT NULL,
  guichetiere_nom TEXT,
  current_region TEXT,
  current_agence_nom TEXT,
  current_terminal_reference TEXT,
  requested_region TEXT,
  requested_agence_nom TEXT,
  requested_terminal_reference TEXT,
  commentaire TEXT,
  statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('En attente', 'Approuvée', 'Refusée', 'Annulée')),
  commentaire_traitement TEXT,
  traite_par TEXT,
  date_traitement TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_change_requests_point
ON public.points_vente_mobi_change_requests(point_vente_uid);

CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_change_requests_guichetiere
ON public.points_vente_mobi_change_requests(guichetiere_matricule);

CREATE INDEX IF NOT EXISTS idx_points_vente_mobi_change_requests_statut
ON public.points_vente_mobi_change_requests(statut);

ALTER TABLE public.points_vente_mobi_change_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'points_vente_mobi_change_requests'
      AND policyname = 'Allow app access on points_vente_mobi_change_requests'
  ) THEN
    CREATE POLICY "Allow app access on points_vente_mobi_change_requests"
      ON public.points_vente_mobi_change_requests
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_points_vente_mobi_change_requests_updated_at
ON public.points_vente_mobi_change_requests;

CREATE TRIGGER handle_points_vente_mobi_change_requests_updated_at
  BEFORE UPDATE ON public.points_vente_mobi_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

## Configuration du workflow Paiement de Gain

Pour activer la configuration des tranches, seuils et validateurs dans le sous-onglet `Configuration` de `Autorisation de Paiement Gain`, exécutez ce script :

```sql
ALTER TABLE public.demandes_paiement_gain
DROP CONSTRAINT IF EXISTS demandes_paiement_gain_statut_check;

ALTER TABLE public.demandes_paiement_gain
ADD CONSTRAINT demandes_paiement_gain_statut_check
CHECK ("statutGlobal" IN (
  'En attente chef d’agence',
  'En attente directeur régional',
  'En attente directeur général',
  'En attente exploitation',
  'Autorisée pour paiement',
  'Payée',
  'Refusée'
));

ALTER TABLE public.demandes_paiement_gain
DROP CONSTRAINT IF EXISTS demandes_paiement_gain_niveau_check;

ALTER TABLE public.demandes_paiement_gain
ADD CONSTRAINT demandes_paiement_gain_niveau_check
CHECK ("niveauValidationCourant" IN (
  'chef_agence',
  'directeur_regional',
  'directeur_general',
  'exploitation',
  'agence_paiement',
  'terminee'
));

CREATE TABLE IF NOT EXISTS public.paiement_gain_workflow_config (
  id BIGSERIAL PRIMARY KEY,
  ordre INTEGER NOT NULL DEFAULT 1,
  "codeWorkflow" TEXT NOT NULL,
  libelle TEXT NOT NULL,
  "montantMin" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "montantMax" NUMERIC(18,2),
  "modePaiement" TEXT NOT NULL,
  "lieuPaiement" TEXT NOT NULL,
  "identificationRequise" BOOLEAN NOT NULL DEFAULT false,
  "requiresChefApproval" BOOLEAN NOT NULL DEFAULT false,
  "requiresRegionalApproval" BOOLEAN NOT NULL DEFAULT false,
  "requiresGeneralApproval" BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'Actif',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'paiement_gain_workflow_config_statut_check'
  ) THEN
    ALTER TABLE public.paiement_gain_workflow_config
    ADD CONSTRAINT paiement_gain_workflow_config_statut_check
    CHECK (statut IN ('Actif', 'Inactif'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_paiement_gain_workflow_config_code
ON public.paiement_gain_workflow_config("codeWorkflow");

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_config_ordre
ON public.paiement_gain_workflow_config(ordre);

CREATE INDEX IF NOT EXISTS idx_paiement_gain_workflow_config_statut
ON public.paiement_gain_workflow_config(statut);

ALTER TABLE public.paiement_gain_workflow_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paiement_gain_workflow_config'
      AND policyname = 'Allow app access on paiement_gain_workflow_config'
  ) THEN
    CREATE POLICY "Allow app access on paiement_gain_workflow_config"
      ON public.paiement_gain_workflow_config
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_paiement_gain_workflow_config_updated_at
ON public.paiement_gain_workflow_config;

CREATE TRIGGER handle_paiement_gain_workflow_config_updated_at
  BEFORE UPDATE ON public.paiement_gain_workflow_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

## Table Référentiel Paramètres

Pour ajouter l'onglet `Référentiel Paramètres` dans l'espace Exploitation, créez la table `referentiel_parametres` afin de conserver la version active et l'historique des modifications de chaque paramètre.

### Script SQL à exécuter dans l'éditeur SQL de Supabase :

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.referentiel_parametres (
  id BIGSERIAL PRIMARY KEY,
  "parametreUid" TEXT NOT NULL,
  "codeParametre" TEXT NOT NULL,
  categorie TEXT NOT NULL,
  libelle TEXT NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  "dateDebutValidite" DATE NOT NULL,
  "dateFinValidite" DATE,
  statut TEXT NOT NULL DEFAULT 'Actif',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referentiel_parametres_statut_check'
  ) THEN
    ALTER TABLE public.referentiel_parametres
    ADD CONSTRAINT referentiel_parametres_statut_check
    CHECK (statut IN ('Actif', 'Inactif'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referentiel_parametres_uid
ON public.referentiel_parametres("parametreUid");

CREATE INDEX IF NOT EXISTS idx_referentiel_parametres_code
ON public.referentiel_parametres("codeParametre");

CREATE INDEX IF NOT EXISTS idx_referentiel_parametres_categorie
ON public.referentiel_parametres(categorie);

CREATE INDEX IF NOT EXISTS idx_referentiel_parametres_statut
ON public.referentiel_parametres(statut);

CREATE INDEX IF NOT EXISTS idx_referentiel_parametres_dates
ON public.referentiel_parametres("dateDebutValidite", "dateFinValidite");

CREATE UNIQUE INDEX IF NOT EXISTS uniq_referentiel_parametres_actif_code
ON public.referentiel_parametres("codeParametre")
WHERE statut = 'Actif';

ALTER TABLE public.referentiel_parametres ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referentiel_parametres'
      AND policyname = 'Enable all operations for authenticated users on referentiel_parametres'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users on referentiel_parametres"
      ON public.referentiel_parametres
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_referentiel_parametres_updated_at
ON public.referentiel_parametres;

CREATE TRIGGER handle_referentiel_parametres_updated_at
  BEFORE UPDATE ON public.referentiel_parametres
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.referentiel_parametres IS 'Historique des versions des paramètres de référentiel';
COMMENT ON COLUMN public.referentiel_parametres."parametreUid" IS 'Identifiant logique stable pour regrouper toutes les versions historiques d un même paramètre';
COMMENT ON COLUMN public.referentiel_parametres."codeParametre" IS 'Code métier unique du paramètre';
COMMENT ON COLUMN public.referentiel_parametres.categorie IS 'Catégorie fonctionnelle du paramètre';
COMMENT ON COLUMN public.referentiel_parametres.libelle IS 'Libellé affiché du paramètre';
COMMENT ON COLUMN public.referentiel_parametres.valeur IS 'Valeur active ou historique du paramètre';
COMMENT ON COLUMN public.referentiel_parametres.description IS 'Description fonctionnelle du paramètre';
COMMENT ON COLUMN public.referentiel_parametres."dateDebutValidite" IS 'Date de début de validité de la version';
COMMENT ON COLUMN public.referentiel_parametres."dateFinValidite" IS 'Date de fin de validité de la version';
COMMENT ON COLUMN public.referentiel_parametres.statut IS 'Statut de la version : Actif ou Inactif';
```

### Structure de la table Référentiel Paramètres :

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Identifiant unique auto-incrémenté |
| parametreUid | TEXT | NOT NULL | Identifiant logique du paramètre à travers ses versions |
| codeParametre | TEXT | NOT NULL | Code métier du paramètre |
| categorie | TEXT | NOT NULL | Catégorie fonctionnelle |
| libelle | TEXT | NOT NULL | Libellé du paramètre |
| valeur | TEXT | NOT NULL | Valeur du paramètre |
| description | TEXT | NULL | Description fonctionnelle |
| dateDebutValidite | DATE | NOT NULL | Date de début de validité |
| dateFinValidite | DATE | NULL | Date de fin de validité |
| statut | TEXT | NOT NULL, CHECK | Statut de la version : Actif ou Inactif |
| created_at | TIMESTAMP | DEFAULT NOW() | Date de création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Date de dernière modification |

## Correctif accès Profils Exploitation

Les profils Exploitation utilisent un login applicatif, pas `Supabase Auth`.  
Si une table est protégée avec une policy `auth.role() = 'authenticated'`, elle peut apparaître vide pour ces profils même si l’écran est accessible.

Si `regions` reste vide pour un profil Exploitation, exécutez au minimum ce correctif ciblé :

```sql
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for authenticated users on regions"
ON public.regions;

DROP POLICY IF EXISTS "Allow app access on regions"
ON public.regions;

CREATE POLICY "Allow app access on regions"
  ON public.regions
  FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
```

Exécutez ce script pour autoriser l’accès applicatif en lecture/écriture sur les tables exploitées par ces profils :

```sql
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminaux_mobi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_vente_mobi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referentiel_parametres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guichetieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chefs_agence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'regions'
      AND policyname = 'Allow app access on regions'
  ) THEN
    CREATE POLICY "Allow app access on regions"
      ON public.regions
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agences'
      AND policyname = 'Allow app access on agences'
  ) THEN
    CREATE POLICY "Allow app access on agences"
      ON public.agences
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guichetieres'
      AND policyname = 'Allow app access on guichetieres'
  ) THEN
    CREATE POLICY "Allow app access on guichetieres"
      ON public.guichetieres
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chefs_agence'
      AND policyname = 'Allow app access on chefs_agence'
  ) THEN
    CREATE POLICY "Allow app access on chefs_agence"
      ON public.chefs_agence
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'terminaux_mobi'
      AND policyname = 'Allow app access on terminaux_mobi'
  ) THEN
    CREATE POLICY "Allow app access on terminaux_mobi"
      ON public.terminaux_mobi
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'points_vente_mobi'
      AND policyname = 'Allow app access on points_vente_mobi'
  ) THEN
    CREATE POLICY "Allow app access on points_vente_mobi"
      ON public.points_vente_mobi
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referentiel_parametres'
      AND policyname = 'Allow app access on referentiel_parametres'
  ) THEN
    CREATE POLICY "Allow app access on referentiel_parametres"
      ON public.referentiel_parametres
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
```

## Suivi des activités utilisateurs (Activités utilisateurs)

Alimente l'onglet **Suivi et Gestion → Activités utilisateurs** de l'Espace Exploitation
(état en ligne / hors ligne, historique des sessions et détail de navigation par
utilisateur et par espace). Deux tables sont nécessaires :

- `public.activites_sessions` — 1 ligne par session ouverte dans un espace
  (`last_seen_at` mis à jour par heartbeat toutes les 60 s, `ended_at` à la déconnexion).
- `public.activites_evenements` — 1 ligne par évènement (`login`, `navigation`, `logout`).

Le script complet (tables + index + RLS `anon`/`authenticated`) se trouve dans
`supabase/migrations/add_user_activity_tracking.sql` — **à exécuter dans le SQL Editor Supabase**.
