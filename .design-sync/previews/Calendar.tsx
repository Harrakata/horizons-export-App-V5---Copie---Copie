import { Calendar } from 'pmu-mali-gestion';

export function Mois() {
  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 5, 1)}
      selected={new Date(2026, 5, 12)}
      className="rounded-md border"
    />
  );
}
