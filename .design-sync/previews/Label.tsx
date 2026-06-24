import { Label, Input } from 'pmu-mali-gestion';

export function Champ() {
  return (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="code">Code point de vente</Label>
      <Input id="code" placeholder="0427" />
    </div>
  );
}
