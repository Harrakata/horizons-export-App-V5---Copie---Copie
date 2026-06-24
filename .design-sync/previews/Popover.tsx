import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Label,
  Input,
} from 'pmu-mali-gestion';

export function Filtre() {
  return (
    <div className="flex w-full justify-center pt-1">
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="outline">Filtres</Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <h4 className="font-medium leading-none">Filtrer les PDV</h4>
            <p className="text-sm text-muted-foreground">Affinez la liste affichée.</p>
            <div className="space-y-2">
              <Label htmlFor="ca-min">CA minimum (FCFA)</Label>
              <Input id="ca-min" placeholder="500 000" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
