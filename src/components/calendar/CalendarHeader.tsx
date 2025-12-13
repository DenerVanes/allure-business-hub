import { Calendar, CalendarDays, List, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ViewMode = 'week' | 'month' | 'list';

interface Collaborator {
  id: string;
  name: string;
}

interface CalendarHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  collaborators?: Collaborator[];
  selectedCollaboratorId?: string;
  onCollaboratorChange?: (collaboratorId: string) => void;
}

export const CalendarHeader = ({
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
  onPrevious,
  onNext,
  onToday,
  collaborators = [],
  selectedCollaboratorId = 'all',
  onCollaboratorChange,
}: CalendarHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
        {/* Tabs de visualização */}
        <div className="flex items-center gap-1 sm:gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('week')}
            className={cn(
              "gap-1 sm:gap-2 text-xs sm:text-sm",
              viewMode === 'week' && "bg-background shadow-sm text-foreground font-medium"
            )}
          >
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Semana</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('month')}
            className={cn(
              "gap-1 sm:gap-2 text-xs sm:text-sm",
              viewMode === 'month' && "bg-background shadow-sm text-foreground font-medium"
            )}
          >
            <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Mês</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={cn(
              "gap-1 sm:gap-2 text-xs sm:text-sm",
              viewMode === 'list' && "bg-background shadow-sm text-foreground font-medium"
            )}
          >
            <List className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
        </div>

        {/* Navegação de data */}
        {viewMode !== 'list' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrevious}>
              ←
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={onNext}>
              →
            </Button>
            
            {/* Filtro de Profissional */}
            {collaborators.length > 0 && onCollaboratorChange && (
              <Select value={selectedCollaboratorId} onValueChange={onCollaboratorChange}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {collaborators.map((collab) => (
                    <SelectItem key={collab.id} value={collab.id}>
                      {collab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

