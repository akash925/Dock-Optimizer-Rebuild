import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPopoverProps<T> {
  title: string;
  options: Array<{
    id: T;
    name: string;
    facilityId?: number; // Optional for nested filtering
  }>;
  selected: T[];
  onSelect: (value: T[]) => void;
  className?: string;
  allOptionText?: string;
  allOptionValue?: T;
  showCount?: boolean;
}

export function FilterPopover<T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  className,
  allOptionText = "All",
  allOptionValue = "all" as T,
  showCount = true,
}: FilterPopoverProps<T>) {
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

  // Figure out what to display as the button text
  let buttonText = title;
  if (selected.length === 1 && selected[0] === allOptionValue) {
    buttonText = `All ${title}`;
  } else if (selected.length === 1) {
    // Find the option with the matching id
    const option = options.find(opt => opt.id === selected[0]);
    buttonText = option ? option.name : title;
  } else if (selected.length > 1 && showCount) {
    buttonText = `${selected.length} ${title}`;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("flex justify-between items-center min-w-[160px]", className)}
        >
          <span className="truncate">{buttonText}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-2 w-[250px]">
        <ScrollArea className="max-h-[300px]">
          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer">
              <Checkbox 
                checked={selected.includes(allOptionValue)}
                onCheckedChange={() => handleToggle(allOptionValue)}
              />
              <span className="flex-1">{allOptionText}</span>
            </label>
            
            {options.map((option) => (
              <label 
                key={option.id.toString()} 
                className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
              >
                <Checkbox 
                  checked={selected.includes(option.id)}
                  onCheckedChange={() => handleToggle(option.id)}
                />
                <span className="flex-1">{option.name}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}