
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface SpecialtySelectorProps {
  specialties: string[];
  onSpecialtiesChange: (specialties: string[]) => void;
}

export function SpecialtySelector({ specialties, onSpecialtiesChange }: SpecialtySelectorProps) {
  const [newSpecialty, setNewSpecialty] = useState('');

  const addSpecialty = () => {
    if (newSpecialty.trim() && !specialties.includes(newSpecialty.trim())) {
      onSpecialtiesChange([...specialties, newSpecialty.trim()]);
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialtyToRemove: string) => {
    onSpecialtiesChange(specialties.filter(s => s !== specialtyToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSpecialty();
    }
  };

  return (
    <div className="space-y-3">
      <Label>Especialidades</Label>
      
      <div className="flex gap-2">
        <Input
          placeholder="Digite uma especialidade..."
          value={newSpecialty}
          onChange={(e) => setNewSpecialty(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSpecialty}
          disabled={!newSpecialty.trim()}
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
