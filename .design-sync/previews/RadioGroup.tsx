import { RadioGroup, RadioGroupItem, Label } from 'pmu-mali-gestion';

export function Presence() {
  return (
    <RadioGroup defaultValue="present" className="w-[300px]">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="present" id="r1" />
        <Label htmlFor="r1">Présent</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="absent" id="r2" />
        <Label htmlFor="r2">Absent</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="conge" id="r3" />
        <Label htmlFor="r3">En congé</Label>
      </div>
    </RadioGroup>
  );
}
