import { useState, useMemo } from 'react';
import { format, parseISO, addMinutes, setHours, setMinutes, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentCard } from './AppointmentCard';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { TimeSlotAppointmentsDrawer } from './TimeSlotAppointmentsDrawer';

interface DayViewProps {
  appointments: any[];
  selectedDate: Date;
  onTimeSlotClick?: (date: Date, time: string) => void;
  onAppointmentClick?: (appointment: any) => void;
  startHour?: number;
  endHour?: number;
  slotHeight?: number; // Altura em pixels de cada slot de 30 minutos
  maxCardsPerSlot?: number; // Máximo de cards visíveis por slot
}

export const DayView = ({
  appointments,
  selectedDate,
  onTimeSlotClick,
  onAppointmentClick,
  startHour = 8,
  endHour = 20,
  slotHeight = 60, // 60px por slot de 30 minutos = 120px por hora
  maxCardsPerSlot = 2,
}: DayViewProps) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ time: string; appointments: any[] } | null>(null);
  // Gerar slots de tempo (a cada 30 minutos)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, [startHour, endHour]);

  // Filtrar agendamentos do dia selecionado
  const dayAppointments = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return appointments.filter(apt => {
      const aptDate = format(parseISO(apt.appointment_date), 'yyyy-MM-dd');
      return aptDate === dateStr;
    });
  }, [appointments, selectedDate]);

  // Calcular posição e altura dos cards
  const getAppointmentPosition = (appointment: any) => {
    const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = appointment.services?.duration || 60;
    
    // Posição em pixels (cada 30 minutos = slotHeight pixels)
    const startOffset = startMinutes - (startHour * 60);
    const top = (startOffset / 30) * slotHeight;
    const height = Math.max((duration / 30) * slotHeight, 80); // Mínimo 80px
    
    return { top, height };
  };

  // Organizar agendamentos em lanes para evitar sobreposição
  const appointmentLanes = useMemo(() => {
    const lanes: any[][] = [];
    
    // Ordenar agendamentos por horário
    const sortedAppointments = [...dayAppointments].sort((a, b) => {
      return a.appointment_time.localeCompare(b.appointment_time);
    });
    
    sortedAppointments.forEach(appointment => {
      const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const duration = appointment.services?.duration || 60;
      const endMinutes = startMinutes + duration;
      
      // Encontrar uma lane disponível
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const canPlace = lanes[i].every(apt => {
          const [aptHours, aptMinutes] = apt.appointment_time.split(':').map(Number);
          const aptStartMinutes = aptHours * 60 + aptMinutes;
          const aptDuration = apt.services?.duration || 60;
          const aptEndMinutes = aptStartMinutes + aptDuration;
          
          // Verificar se não há sobreposição
          return endMinutes <= aptStartMinutes || startMinutes >= aptEndMinutes;
        });
        
        if (canPlace) {
          lanes[i].push(appointment);
          placed = true;
          break;
        }
      }
      
      // Se não encontrou lane disponível, criar uma nova
      if (!placed) {
        lanes.push([appointment]);
      }
    });
    
    return lanes;
  }, [dayAppointments]);

  const handleTimeSlotClick = (time: string) => {
    if (onTimeSlotClick) {
      const [hours, minutes] = time.split(':').map(Number);
      const dateTime = setMinutes(setHours(selectedDate, hours), minutes);
      onTimeSlotClick(dateTime, time);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">
          {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dayAppointments.length} agendamento{dayAppointments.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="relative">
          {/* Grid de horários */}
          <div className="flex border rounded-lg overflow-hidden">
            {/* Coluna de horários */}
            <div className="w-16 sm:w-20 flex-shrink-0 border-r bg-muted/30">
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className={cn(
                    "h-[60px] flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b",
                    index % 2 === 0 && "font-medium"
                  )}
                >
                  {index % 2 === 0 && time}
                </div>
              ))}
            </div>

            {/* Área de agendamentos */}
            <div className="flex-1 relative" style={{ minHeight: `${timeSlots.length * slotHeight}px` }}>
              {/* Slots clicáveis - apenas slots sem agendamentos */}
              {timeSlots.map((time) => {
                const [hours, minutes] = time.split(':').map(Number);
                const slotStartMinutes = hours * 60 + minutes;
                const slotTop = ((slotStartMinutes - startHour * 60) / 30) * slotHeight;
                
                // Verificar se há agendamento neste slot
                const hasAppointment = dayAppointments.some(apt => {
                  const [aptHours, aptMinutes] = apt.appointment_time.split(':').map(Number);
                  const aptStartMinutes = aptHours * 60 + aptMinutes;
                  const aptDuration = apt.services?.duration || 60;
                  return (
                    slotStartMinutes >= aptStartMinutes &&
                    slotStartMinutes < aptStartMinutes + aptDuration
                  );
                });
                
                if (hasAppointment) return null;
                
                return (
                  <button
                    key={time}
                    onClick={() => handleTimeSlotClick(time)}
                    className={cn(
                      "absolute left-0 right-0 border-b border-dashed border-border/30",
                      "hover:bg-primary/5 transition-colors cursor-pointer",
                      "flex items-center justify-center opacity-0 hover:opacity-100 group"
                    )}
                    style={{
                      top: `${slotTop}px`,
                      height: `${slotHeight}px`,
                    }}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </button>
                );
              })}

              {/* Cards de agendamentos - usando lanes para evitar sobreposição */}
              {appointmentLanes.map((lane, laneIndex) => {
                const laneWidth = 100 / appointmentLanes.length;
                const leftOffset = laneIndex * laneWidth;
                
                // Agrupar por horário dentro da lane
                const groupedByTime: Record<string, any[]> = {};
                lane.forEach(appointment => {
                  const timeKey = appointment.appointment_time.split(':').slice(0, 2).join(':');
                  if (!groupedByTime[timeKey]) {
                    groupedByTime[timeKey] = [];
                  }
                  groupedByTime[timeKey].push(appointment);
                });

                return Object.entries(groupedByTime).map(([timeKey, timeAppointments]) => {
                  const firstAppointment = timeAppointments[0];
                  const { top, height } = getAppointmentPosition(firstAppointment);
                  const visibleAppointments = timeAppointments.slice(0, maxCardsPerSlot);
                  const remainingCount = timeAppointments.length - maxCardsPerSlot;
                  
                  return (
                    <div
                      key={`${timeKey}-${laneIndex}`}
                      className="absolute"
                      style={{
                        left: `${leftOffset + 1}%`,
                        width: `${laneWidth - 2}%`,
                        top: `${top}px`,
                        height: `${Math.max(height, 80)}px`,
                        zIndex: 5,
                      }}
                    >
                      <div className="flex flex-col gap-1 h-full">
                        {visibleAppointments.map((appointment) => (
                          <div key={appointment.id} className="flex-1 min-h-0">
                            <AppointmentCard
                              appointment={appointment}
                              onClick={() => onAppointmentClick?.(appointment)}
                              className="h-full"
                            />
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="w-full cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center py-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTimeSlot({ time: timeKey, appointments: timeAppointments });
                            }}
                          >
                            +{remainingCount} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Drawer para múltiplos agendamentos do mesmo horário */}
      {selectedTimeSlot && (
        <TimeSlotAppointmentsDrawer
          open={!!selectedTimeSlot}
          onOpenChange={(open) => !open && setSelectedTimeSlot(null)}
          appointments={selectedTimeSlot.appointments}
          time={selectedTimeSlot.time}
          date={selectedDate}
          onAppointmentClick={onAppointmentClick}
        />
      )}
    </div>
  );
};

