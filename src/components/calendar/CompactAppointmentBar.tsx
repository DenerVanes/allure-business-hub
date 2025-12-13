import { cn } from '@/lib/utils';

interface CompactAppointmentBarProps {
  appointment: any;
  onClick?: () => void;
  className?: string;
}

export const CompactAppointmentBar = ({ appointment, onClick, className }: CompactAppointmentBarProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/30';
      case 'confirmado':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30';
      case 'finalizado':
        return 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300 hover:bg-green-500/30';
      case 'cancelado':
        return 'bg-red-500/20 border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-700 dark:text-gray-300 hover:bg-gray-500/30';
    }
  };

  const statusColor = getStatusColor(appointment.status);
  const clientName = appointment.client_name || appointment.clients?.name || 'Cliente não informado';
  const serviceName = appointment.services?.name || 'Serviço não informado';
  const appointmentTime = appointment.appointment_time?.split(':').slice(0, 2).join(':') || '';
  
  // Calcular horário final baseado na duração
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    try {
      const [hours, minutes] = startTime.split(':').slice(0, 2).map(Number);
      const totalMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };
  
  const duration = appointment.services?.duration || 60;
  const endTime = calculateEndTime(appointmentTime, duration);
  const timeRange = endTime ? `${appointmentTime} - ${endTime}` : appointmentTime;

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-2 py-1.5 rounded border cursor-pointer transition-all hover:shadow-sm",
        "flex flex-col justify-center gap-0.5 h-full",
        statusColor,
        className
      )}
    >
      <div className="text-xs font-medium truncate">
        {clientName}
      </div>
      <div className="text-xs text-muted-foreground/80 truncate">
        {timeRange}
      </div>
      <div className="text-xs text-muted-foreground/70 truncate">
        {serviceName}
      </div>
    </div>
  );
};

