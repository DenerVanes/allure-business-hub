
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SpecialtySelectorProps {
  specialties: string[];
  onSpecialtiesChange: (specialties: string[]) => void;
}

export function SpecialtySelector({ specialties, onSpecialtiesChange }: SpecialtySelectorProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('');

  // Buscar categorias únicas dos serviços existentes
  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories-from-services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('category')
        .eq('user_id', user.id)
        .eq('active', true);

      if (error) throw error;
      
      // Extrair categorias únicas e filtrar valores vazios
      const uniqueCategories = [...new Set(data?.map(service => service.category).filter(Boolean))] || [];
      
      return uniqueCategories.map((category, index) => ({
        id: `category-${index}`,
        name: category
      }));
    },
    enabled: !!user?.id,
  });

  const addSpecialty = () => {
    if (selectedCategory && !specialties.includes(selectedCategory)) {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) {
        onSpecialtiesChange([...specialties, category.name]);
        setSelectedCategory('');
      }
    }
  };

  const removeSpecialty = (specialtyToRemove: string) => {
    onSpecialtiesChange(specialties.filter(s => s !== specialtyToRemove));
  };

  // Filtrar categorias já selecionadas
  const availableCategories = categories.filter(category => 
    !specialties.includes(category.name)
  );

  return (
    <div className="space-y-3">
      <Label>Especialidades</Label>
      
      <div className="flex gap-2">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione uma categoria de serviço..." />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSpecialty}
          disabled={!selectedCategory}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {specialties.map((specialty, index) => (
            <Badge key={index} variant="secondary" className="gap-1">
              {specialty}
              <button
                type="button"
                onClick={() => removeSpecialty(specialty)}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
