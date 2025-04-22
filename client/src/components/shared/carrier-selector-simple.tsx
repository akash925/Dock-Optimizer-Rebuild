import { useState, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Carrier {
  id: number;
  name: string;
  mcNumber?: string;
}

interface SimpleSelectorProps {
  onSelect: (carrier: Carrier) => void;
  selectedCarrierId?: number;
}

export function SimplifiedCarrierSelector({ 
  onSelect, 
  selectedCarrierId 
}: SimpleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  // Load carriers
  useEffect(() => {
    const fetchCarriers = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest('GET', '/api/carriers');
        if (res.ok) {
          const data = await res.json();
          setCarriers(data);
          
          // If we have a selectedCarrierId, try to find it
          if (selectedCarrierId) {
            const selected = data.find((c: Carrier) => c.id === selectedCarrierId);
            if (selected) {
              setSelectedCarrier(selected);
            }
          }
        }
      } catch (error) {
        console.error("Error loading carriers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCarriers();
  }, [selectedCarrierId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCarrier ? selectedCarrier.name : "Select carrier..."}
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]">
        <Command>
          <CommandInput placeholder="Search carriers..." />
          <CommandList>
            <CommandEmpty>No carriers found</CommandEmpty>
            <CommandGroup>
              {carriers.map((carrier) => (
                <CommandItem
                  key={carrier.id}
                  value={carrier.name}
                  onSelect={() => {
                    setSelectedCarrier(carrier);
                    onSelect(carrier);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCarrier?.id === carrier.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{carrier.name}</span>
                    {carrier.mcNumber && (
                      <span className="text-xs text-muted-foreground">
                        MC# {carrier.mcNumber}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}