
import React, { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();
const getSearchableValue = (option) => String(
  option.searchValue ?? `${option.label ?? ""} ${option.value ?? ""}`
);

// Combobox single OU multi-select.
// Mode multi : passer `multi={true}` + `value` = array de valeurs + `onSelect(newArray)`.
// La valeur spéciale "__all__" (ALL) déselectionne tout (équivalent "tout afficher").
const Combobox = ({ options, value, onSelect, placeholder, searchPlaceholder, emptyText, disabled, multi = false }) => {
  const [open, setOpen] = useState(false)

  // Détection du mode et de la valeur "ALL" (premier option si elle a l'apparence d'une option globale).
  const allOption = options[0] && (options[0].value === "__all__" || options[0].value === "" || String(options[0].value).startsWith("__")) ? options[0] : null;

  if (multi) {
    // value attendu = array. Si chaîne vide / null, on traite comme array vide.
    const values = Array.isArray(value) ? value : [];
    const isAllMode = values.length === 0;
    const isSelected = (v) => values.includes(v);

    // Label du bouton : "Préposé" si rien sélectionné, "X (3)" si plusieurs, "X" si un seul.
    const triggerLabel = isAllMode
      ? (allOption?.label ?? placeholder)
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${allOption?.label ?? placeholder} (${values.length})`;

    const toggle = (v) => {
      // Click sur ALL → vider la sélection (équivaut à "tout afficher")
      if (allOption && v === allOption.value) {
        onSelect([]);
        return;
      }
      const next = isSelected(v) ? values.filter((x) => x !== v) : [...values, v];
      onSelect(next);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", values.length > 0 && "border-primary/50 bg-primary/5 text-primary")}
            disabled={disabled}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          align="start"
          sideOffset={4}
          avoidCollisions
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-56 overflow-y-auto">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isAll = allOption && option.value === allOption.value;
                  const selected = isAll ? isAllMode : isSelected(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={getSearchableValue(option)}
                      onSelect={() => toggle(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          selected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className={cn("truncate", isAll && "italic text-muted-foreground")}>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // ─── Mode single (legacy) ───
  const selectedOption = options.find(
    (option) => normalizeValue(option.value) === normalizeValue(value)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        sideOffset={4}
        avoidCollisions
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-56 overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={getSearchableValue(option)}
                  onSelect={() => {
                    onSelect(normalizeValue(option.value) === normalizeValue(value) ? "" : option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      normalizeValue(value) === normalizeValue(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox };
