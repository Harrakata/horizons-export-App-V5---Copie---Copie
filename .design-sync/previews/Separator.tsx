import { Separator } from 'pmu-mali-gestion';

export function Sections() {
  return (
    <div className="w-[300px]">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Agence régionale</h4>
        <p className="text-sm text-muted-foreground">Bamako Centre · PDV 0427</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <span>Planning</span>
        <Separator orientation="vertical" />
        <span>Pointage</span>
        <Separator orientation="vertical" />
        <span>Caisse</span>
      </div>
    </div>
  );
}
