import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Button,
} from 'pmu-mali-gestion';

export function Infobulle() {
  return (
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="outline">Chiffre du jour</Button>
        </TooltipTrigger>
        <TooltipContent>Chiffre d'affaires consolidé du jour</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
