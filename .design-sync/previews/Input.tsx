import { Input } from 'pmu-mali-gestion';

export function Default() {
  return (
    <div className="w-[320px] space-y-2">
      <label className="text-sm font-medium" htmlFor="pdv-nom">
        Nom du point de vente
      </label>
      <Input id="pdv-nom" placeholder="Ex. Bamako Centre" />
    </div>
  );
}

export function Types() {
  return (
    <div className="w-[320px] space-y-3">
      <Input type="email" placeholder="email@carrus.ml" />
      <Input type="password" placeholder="Mot de passe" />
      <Input type="search" placeholder="Rechercher un PDV…" />
    </div>
  );
}

export function States() {
  return (
    <div className="w-[320px] space-y-3">
      <Input defaultValue="Bamako Centre" />
      <Input placeholder="Champ désactivé" disabled />
    </div>
  );
}
