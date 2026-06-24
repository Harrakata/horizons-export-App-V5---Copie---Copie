import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuShortcut,
  Button,
} from 'pmu-mali-gestion';

export function Actions() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Point de vente</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Voir les détails</DropdownMenuItem>
        <DropdownMenuItem>
          Modifier
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Pointer une guichetière</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">Désactiver</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
