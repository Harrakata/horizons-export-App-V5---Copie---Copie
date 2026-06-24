import { Textarea } from 'pmu-mali-gestion';

export function Default() {
  return (
    <div className="w-[340px] space-y-2">
      <label className="text-sm font-medium">Commentaire d'intervention</label>
      <Textarea placeholder="Décrivez l'incident constaté sur le terminal…" />
    </div>
  );
}

export function States() {
  return (
    <div className="w-[340px] space-y-3">
      <Textarea defaultValue={'Terminal redémarré.\nTicket clôturé le 12/06.'} />
      <Textarea placeholder="Champ désactivé" disabled />
    </div>
  );
}
