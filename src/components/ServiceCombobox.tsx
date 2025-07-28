
import { useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
}

interface ServiceComboboxProps {
  services: Service[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const ServiceCombobox = ({ services, value, onChange, placeholder = "Selecione um serviço..." }: ServiceComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const selectedService = services.find(service => service.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedService ? (
            <div className="flex justify-between items-center w-full">
              <span>{selectedService.name}</span>
              <span className="text-sm text-muted-foreground ml-2">
                R$ {selectedService.price} - {selectedService.duration}min
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Pesquisar serviço..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
            <CommandGroup>
              {services
                .filter(service => 
                  service.name.toLowerCase().includes(searchValue.toLowerCase()) ||
                  service.category.toLowerCase().includes(searchValue.toLowerCase())
                )
                .map((service) => (
                  <CommandItem
                    key={service.id}
                    value={service.id}
                    onSelect={() => {
                      onChange(service.id);
                      setOpen(false);
                      setSearchValue('');
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === service.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>{service.name}</span>
                        <span className="text-xs text-muted-foreground">Categoria: {service.category}</span>
                      </div>
                      <span className="text-sm text-muted-foreground ml-2">
                        R$ {service.price} - {service.duration}min
                      </span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
