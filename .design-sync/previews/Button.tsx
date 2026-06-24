import { Button } from 'pmu-mali-gestion';
import { Plus, Search } from 'lucide-react';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Enregistrer</Button>
      <Button variant="secondary">Annuler</Button>
      <Button variant="destructive">Supprimer</Button>
      <Button variant="outline">Exporter</Button>
      <Button variant="ghost">Détails</Button>
      <Button variant="link">En savoir plus</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Petit</Button>
      <Button size="default">Normal</Button>
      <Button size="lg">Grand</Button>
      <Button size="icon" aria-label="Ajouter">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function WithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus className="mr-2 h-4 w-4" /> Nouveau point de vente
      </Button>
      <Button variant="outline">
        <Search className="mr-2 h-4 w-4" /> Rechercher
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Indisponible</Button>
      <Button variant="secondary" disabled>
        En cours…
      </Button>
    </div>
  );
}
