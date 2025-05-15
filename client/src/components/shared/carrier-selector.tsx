import { useState, useEffect, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { Carrier } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface CarrierSelectorProps {
  form?: UseFormReturn<any>;
  nameFieldName?: string;
  idFieldName?: string;
  mcNumberFieldName?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (carrier: { id?: number; name: string; mcNumber?: string }) => void;
  onCarrierSelect?: (carrierId: number, carrier: any) => void;
}

export function CarrierSelector({
  form,
  nameFieldName,
  idFieldName,
  mcNumberFieldName,
  label = "Carrier",
  required = false,
  placeholder = "Select carrier...",
  className,
  onChange,
  onCarrierSelect
}: CarrierSelectorProps) {
  const [open, setOpen] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [addingNewCarrier, setAddingNewCarrier] = useState(false);
  
  // Get current value from form or use empty string if form is not available
  const carrierNameValue = form && nameFieldName ? form.watch(nameFieldName) : "";
  
  // Load initial carriers when the component mounts
  useEffect(() => {
    const fetchInitialCarriers = async () => {
      try {
        const res = await fetch('/api/carriers/search?query=');
        const data = await res.json();
        if (Array.isArray(data)) {
          setCarriers(data.slice(0, 5));
        }
      } catch (err) {
        console.error("Error loading initial carriers:", err);
      }
    };
    
    fetchInitialCarriers();
  }, []);
  
  // Search carriers when query changes
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/carriers/search?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setCarriers(data);
      } catch (err) {
        console.error("Error searching carriers:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCarrier = useCallback((carrier: Carrier) => {
    console.log("Selecting carrier:", carrier);
    
    // Ensure mcNumber is a string (handle potential null values)
    const mcNumber = carrier.mcNumber || "";
    
    if (form && nameFieldName && idFieldName) {
      // Set carrier ID and name
      form.setValue(idFieldName, carrier.id);
      form.setValue(nameFieldName, carrier.name);
      
      // Set MC Number if field name provided and carrier has mcNumber
      if (mcNumberFieldName) {
        console.log("Setting MC Number to:", mcNumber);
        
        // Ensure we trigger change events by using form.setValue
        form.setValue(mcNumberFieldName, mcNumber, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        });
        
        // Also update the DOM input value to ensure it's displayed
        const mcNumberField = document.querySelector(`input[name="${mcNumberFieldName}"]`) as HTMLInputElement;
        if (mcNumberField) {
          mcNumberField.value = mcNumber;
        }
      }
    }
    
    // Call onChange callback if provided
    if (onChange) {
      onChange({
        id: carrier.id,
        name: carrier.name,
        mcNumber: mcNumber
      });
    }
    
    // Call onCarrierSelect callback if provided (for BookingWizard compatibility)
    if (onCarrierSelect) {
      onCarrierSelect(carrier.id, carrier);
    }
    
    setOpen(false);
  }, [form, idFieldName, nameFieldName, mcNumberFieldName, onChange, onCarrierSelect]);
  
  const handleAddCarrier = useCallback(() => {
    if (searchQuery.trim()) {
      console.log("Adding new carrier:", searchQuery);
      
      const trimmedName = searchQuery.trim();
      let currentMcNumber = "";
      
      // Handle form updates if form is available
      if (form && nameFieldName && idFieldName) {
        // Set the carrier name - Force validation to pass
        form.setValue(nameFieldName, trimmedName, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        });
        
        // Ensure no validation errors for carrier name
        form.clearErrors(nameFieldName);
        
        // Also directly update the DOM value to ensure it displays properly
        const carrierNameField = document.querySelector(`input[name="${nameFieldName}"]`) as HTMLInputElement;
        if (carrierNameField) {
          carrierNameField.value = trimmedName;
        }
        
        // Clear carrier ID for new carriers that don't exist in the system yet
        form.setValue(idFieldName, undefined, { shouldValidate: true });
        
        // Don't reset MC Number if mcNumberFieldName is provided
        if (mcNumberFieldName) {
          currentMcNumber = form.getValues(mcNumberFieldName) || "";
          console.log("Current MC Number:", currentMcNumber);
          
          // Always ensure the MC Number field is properly set with validation
          form.setValue(mcNumberFieldName, currentMcNumber, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true
          });
          
          // Also update the DOM input value to ensure it's displayed
          const mcNumberField = document.querySelector(`input[name="${mcNumberFieldName}"]`) as HTMLInputElement;
          if (mcNumberField) {
            mcNumberField.value = currentMcNumber;
          }
        }
        
        // Log final form state for debugging
        console.log("Form values after adding carrier:", {
          carrierName: nameFieldName ? form.getValues(nameFieldName) : undefined,
          carrierId: idFieldName ? form.getValues(idFieldName) : undefined,
          mcNumber: mcNumberFieldName ? form.getValues(mcNumberFieldName) : undefined
        });
      }
      
      // Call onChange callback if provided
      if (onChange) {
        onChange({
          name: trimmedName,
          mcNumber: currentMcNumber
        });
      }
      
      // Call onCarrierSelect callback with a temporary ID for new carriers
      if (onCarrierSelect) {
        // Use a negative ID to indicate this is a new carrier not yet saved
        const tempCarrierId = -1;
        onCarrierSelect(tempCarrierId, {
          id: tempCarrierId,
          name: trimmedName,
          mcNumber: currentMcNumber
        });
      }
      
      setOpen(false);
      setAddingNewCarrier(false);
    }
  }, [searchQuery, form, idFieldName, nameFieldName, mcNumberFieldName, onChange, onCarrierSelect]);
  
  return (
    <FormItem className={cn("flex flex-col", className)}>
      <FormLabel>{label}{required && "*"}</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between text-left font-normal"
            >
              <span className="flex-grow truncate">
                {carrierNameValue || placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search carriers..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            {isSearching && (
              <div className="py-6 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching carriers...
              </div>
            )}
            {!isSearching && carriers.length === 0 && (
              <CommandEmpty>
                <div className="py-3 text-center text-sm">
                  No carriers found.
                  
                  {!addingNewCarrier ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mx-auto"
                        onClick={() => setAddingNewCarrier(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add "{searchQuery}"
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2 text-left p-2 border rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Add New Carrier</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingNewCarrier(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Carrier name"
                          className="w-full"
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddCarrier}
                          >
                            Add Carrier
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAddingNewCarrier(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CommandEmpty>
            )}
            {!isSearching && carriers.length > 0 && (
              <CommandGroup heading="Existing Carriers">
                {carriers.map(carrier => (
                  <CommandItem
                    key={carrier.id}
                    value={carrier.name}
                    onSelect={() => handleSelectCarrier(carrier)}
                  >
                    <div className="flex flex-col w-full">
                      <div className="flex items-center">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            String(carrierNameValue) === carrier.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{carrier.name}</span>
                      </div>
                      {carrier.mcNumber && (
                        <span className="text-xs text-muted-foreground ml-6">
                          MC: {carrier.mcNumber}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {searchQuery && (
                  <CommandItem
                    onSelect={handleAddCarrier}
                    className="text-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add new carrier: "{searchQuery}"
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}