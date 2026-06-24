import { Avatar, AvatarFallback } from 'pmu-mali-gestion';

export function Initiales() {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>AK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar className="h-12 w-12">
        <AvatarFallback className="bg-primary text-primary-foreground">PDV</AvatarFallback>
      </Avatar>
    </div>
  );
}
