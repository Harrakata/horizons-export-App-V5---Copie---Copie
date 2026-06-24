import { Badge } from 'pmu-mali-gestion';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Actif</Badge>
      <Badge variant="secondary">Brouillon</Badge>
      <Badge variant="destructive">Hors service</Badge>
      <Badge variant="outline">Archivé</Badge>
    </div>
  );
}

export function Statuts() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>En ligne</Badge>
      <Badge variant="secondary">En attente</Badge>
      <Badge variant="destructive">Incident</Badge>
      <Badge variant="outline">Maintenance</Badge>
    </div>
  );
}
