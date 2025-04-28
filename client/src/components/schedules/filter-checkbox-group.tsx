import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterOption<T> = {
  id: T;
  name: string;
  facilityId?: number; // Optional for nested filtering
};

interface FilterCheckboxGroupProps<T> {
  title: string;
  options: FilterOption<T>[];
  selected: T[];
  onSelect: (value: T[]) => void;
  className?: string;
  allOptionValue?: T;
}

export function FilterCheckboxGroup<T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  className,
  allOptionValue = "all" as T,
}: FilterCheckboxGroupProps<T>) {
  const handleToggle = (value: T) => {
    // If value is allOptionValue, select only the "all" option
    if (value === allOptionValue) {
      onSelect([allOptionValue]);
      return;
    }

    // If all option was selected and now we're selecting something else
    if (selected.includes(allOptionValue)) {
      onSelect([value]);
      return;
    }

    // If we're deselecting the last option, select "all" option
    if (selected.length === 1 && selected[0] === value) {
      onSelect([allOptionValue]);
      return;
    }

    // Otherwise, toggle the value
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    
    onSelect(newSelected);
  };

  return (
    <div className={cn("mb-4", className)}>
      <h4 className="text-base font-medium mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selected.includes(allOptionValue) ? "default" : "outline"}
          size="sm"
          className="h-9 rounded-md bg-green-100 data-[state=open]:bg-green-500 hover:bg-green-200"
          onClick={() => handleToggle(allOptionValue)}
        >
          All
        </Button>
        {options.map((option) => (
          <Button
            key={option.id.toString()}
            variant={selected.includes(option.id) ? "default" : "outline"}
            size="sm"
            className="h-9 rounded-md"
            onClick={() => handleToggle(option.id)}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </div>
  );
}