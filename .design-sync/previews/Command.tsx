import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from 'pmu-mali-gestion';

export function Palette() {
  return (
    <Command className="w-[360px] rounded-lg border shadow-md">
      <CommandInput placeholder="Rechercher une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>Tableau de bord</CommandItem>
          <CommandItem>Points de vente</CommandItem>
          <CommandItem>
            Planning
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>Nouveau pointage</CommandItem>
          <CommandItem>Exporter le chiffre d'affaires</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
