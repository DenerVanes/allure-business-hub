
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Collaborator {
  id: string;
  name: string;
  specialty: string[];
  photo_url?: string;
}

interface CollaboratorSelectorProps {
  serviceCategory: string;
  selectedCollaboratorIds: string[];
  onCollaboratorsChange: (collaboratorIds: string[]) => void;
}

export const CollaboratorSelector = ({ 
  serviceCategory, 
  selectedCollaboratorIds, 
  onCollaboratorsChange 
}: CollaboratorSelectorProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filtrar colaboradores com base na categoria do serviço
  const availableCollaborators = collaborators.filter(collaborator => {
    if (!collaborator.specialty || collaborator.specialty.length === 0) {
      return true; // Colaborador sem especialidade pode fazer qualquer serviço
    }
    
    return collaborator.specialty.some((spec: string) => 
      spec.toLowerCase() === serviceCategory.toLowerCase()
    );
  });

  // Filtrar colaboradores por busca
  const filteredCollaborators = availableCollaborators.filter(collaborator =>
    collaborator.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const selectedCollaborators = availableCollaborators.filter(c => 
    selectedCollaboratorIds.includes(c.id)
  );

  const handleCollaboratorToggle = (collaboratorId: string) => {
    const isSelected = selectedCollaboratorIds.includes(collaboratorId);
    if (isSelected) {
      onCollaboratorsChange(selectedCollaboratorIds.filter(id => id !== collaboratorId));
    } else {
      onCollaboratorsChange([...selectedCollaboratorIds, collaboratorId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCollaborators.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedCollaborators.slice(0, 2).map((collaborator) => (
                <span
                  key={collaborator.id}
                  className="bg-primary/10 text-primary px-2 py-1 rounded text-xs"
                >
                  {collaborator.name}
                </span>
              ))}
              {selectedCollaborators.length > 2 && (
                <span className="text-muted-foreground text-xs">
                  +{selectedCollaborators.length - 2} mais
                </span>
              )}
            </div>
          ) : (
            "Selecione profissional(is)"
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Pesquisar profissional..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
            <CommandGroup>
              {filteredCollaborators.map((collaborator) => (
                <CommandItem
                  key={collaborator.id}
                  value={collaborator.id}
                  onSelect={() => handleCollaboratorToggle(collaborator.id)}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    checked={selectedCollaboratorIds.includes(collaborator.id)}
                    onChange={() => handleCollaboratorToggle(collaborator.id)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {collaborator.photo_url ? (
                      <img
                        src={collaborator.photo_url}
                        alt={collaborator.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-xs font-medium">
                          {collaborator.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{collaborator.name}</span>
                      {collaborator.specialty && collaborator.specialty.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {collaborator.specialty.join(', ')}
                        </span>
                      )}
                    </div>
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
