import { Combobox } from 'pmu-mali-gestion';

const regions = [
  { value: 'bamako', label: 'Bamako' },
  { value: 'kayes', label: 'Kayes' },
  { value: 'sikasso', label: 'Sikasso' },
  { value: 'segou', label: 'Ségou' },
];

export function Selecteur() {
  return (
    <div className="w-[280px]">
      <Combobox
        options={regions}
        value="bamako"
        onSelect={() => {}}
        placeholder="Choisir une région"
        searchPlaceholder="Rechercher une région…"
        emptyText="Aucune région"
      />
    </div>
  );
}
