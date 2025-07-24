
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarIcon, Filter } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type DateFilter = {
  type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom' | 'all';
  startDate?: Date;
  endDate?: Date;
  label: string;
};

interface AppointmentDateFilterProps {
  onFilterChange: (filter: DateFilter) => void;
  currentFilter: DateFilter;
}

export const AppointmentDateFilter = ({ onFilterChange, currentFilter }: AppointmentDateFilterProps) => {
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  const getDateFilter = (type: DateFilter['type']): DateFilter => {
    const today = new Date();
    
    switch (type) {
      case 'today':
        return {
          type: 'today',
          startDate: startOfDay(today),
          endDate: endOfDay(today),
          label: 'Hoje'
        };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return {
          type: 'yesterday',
          startDate: startOfDay(yesterday),
          endDate: endOfDay(yesterday),
          label: 'Ontem'
        };
      case 'thisWeek':
        return {
          type: 'thisWeek',
          startDate: startOfWeek(today, { locale: ptBR }),
          endDate: endOfWeek(today, { locale: ptBR }),
          label: 'Esta Semana'
        };
      case 'thisMonth':
        return {
          type: 'thisMonth',
          startDate: startOfMonth(today),
          endDate: endOfMonth(today),
          label: 'Este Mês'
        };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return {
          type: 'lastMonth',
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
          label: 'Mês Passado'
        };
      case 'all':
      default:
        return {
          type: 'all',
          label: 'Todos'
        };
    }
  };

  const handleFilterSelect = (type: DateFilter['type']) => {
    if (type === 'custom') {
      setShowCustomDialog(true);
      return;
    }
    
    const filter = getDateFilter(type);
    onFilterChange(filter);
  };

  const handleCustomFilter = () => {
    if (customStartDate && customEndDate) {
      const filter: DateFilter = {
        type: 'custom',
        startDate: startOfDay(customStartDate),
        endDate: endOfDay(customEndDate),
        label: `${format(customStartDate, 'dd/MM/yyyy')} - ${format(customEndDate, 'dd/MM/yyyy')}`
      };
      onFilterChange(filter);
      setShowCustomDialog(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            {currentFilter.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleFilterSelect('all')}>
            Todos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('today')}>
            Hoje
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('yesterday')}>
            Ontem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('thisWeek')}>
            Esta Semana
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('thisMonth')}>
            Este Mês
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('lastMonth')}>
            Mês Passado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFilterSelect('custom')}>
            Período Personalizado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Filtro Personalizado</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Calendar
                mode="single"
                selected={customStartDate}
                onSelect={setCustomStartDate}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Calendar
                mode="single"
                selected={customEndDate}
                onSelect={setCustomEndDate}
                disabled={(date) => customStartDate ? date < customStartDate : false}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCustomFilter}
              disabled={!customStartDate || !customEndDate}
            >
              Aplicar Filtro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
