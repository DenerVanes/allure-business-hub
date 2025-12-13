import { Clock, User, Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, addMinutes, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentCardProps {
  appointment: any;
  onClick?: () => void;
  className?: string;
}

export const AppointmentCard = ({ appointment, onClick, className }: AppointmentCardProps) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'agendado':
        return {
          color: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300',
          label: 'Agendado',
        };
      case 'confirmado':
        return {
          color: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
          label: 'Confirmado',
        };
      case 'finalizado':
        return {
          color: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300',
          label: 'Finalizado',
        };
      case 'cancelado':
        return {
          color: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300',
          label: 'Cancelado',
        };
      default:
        return {
          color: 'bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-300',
          label: 'Desconhecido',
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const clientName = appointment.client_name || appointment.clients?.name || 'Cliente não informado';
  const serviceName = appointment.services?.name || 'Serviço não informado';
  const collaboratorName = appointment.collaborators?.name || appointment.collaborator_name || null;
  const duration = appointment.services?.duration || 60; // Default 60 minutos

  // Calcular horário final
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    try {
      // Parse do horário inicial (formato HH:mm ou HH:mm:ss)
      const timeOnly = startTime.split(':').slice(0, 2).join(':'); // Remove segundos se houver
      const [hours, minutes] = timeOnly.split(':').map(Number);
      const startDate = setMinutes(setHours(new Date(), hours), minutes);
      const endDate = addMinutes(startDate, durationMinutes);
      return format(endDate, 'HH:mm');
    } catch {
      return '';
    }
  };

  const startTime = appointment.appointment_time?.split(':').slice(0, 2).join(':') || '';
  const endTime = calculateEndTime(startTime, duration);
  const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
        "flex flex-col gap-2 min-h-[80px]",
        statusConfig.color,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-semibold text-sm truncate">{timeRange}</span>
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs flex-shrink-0", statusConfig.color)}
        >
          {statusConfig.label}
        </Badge>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{clientName}</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground truncate">{serviceName}</span>
        </div>

        {collaboratorName && (
          <div className="text-xs text-muted-foreground truncate">
            Profissional: {collaboratorName}
          </div>
        )}

        {appointment.total_amount && (
          <div className="text-xs font-semibold text-primary mt-1">
            R$ {Number(appointment.total_amount).toFixed(2).replace('.', ',')}
          </div>
        )}
      </div>
    </div>
  );
};

