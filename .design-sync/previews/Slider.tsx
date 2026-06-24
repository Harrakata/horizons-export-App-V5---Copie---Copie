import { Slider } from 'pmu-mali-gestion';

export function Valeurs() {
  return (
    <div className="w-[320px] space-y-8">
      <Slider defaultValue={[40]} max={100} step={1} />
      <Slider defaultValue={[20, 80]} max={100} step={1} />
    </div>
  );
}
