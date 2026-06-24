import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from 'pmu-mali-gestion';

export function Regions() {
  return (
    <Select defaultValue="bamako" open>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Choisir une région" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Régions</SelectLabel>
          <SelectItem value="bamako">Bamako</SelectItem>
          <SelectItem value="kayes">Kayes</SelectItem>
          <SelectItem value="sikasso">Sikasso</SelectItem>
          <SelectItem value="segou">Ségou</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
