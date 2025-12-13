import { useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, isSameDay, eachDayOfInterval, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CompactAppointmentBar } from './CompactAppointmentBar';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface WeekViewProps {
  appointments: any[];
  selectedDate: Date;
  onAppointmentClick?: (appointment: any) => void;
  onTimeSlotClick?: (date: Date, time: string) => void;
  onDayClick?: (date: Date) => void;
  startHour?: number;
  endHour?: number;
  slotHeight?: number;
}

export const WeekView = ({
  appointments,
  selectedDate,
  onAppointmentClick,
  onTimeSlotClick,
  onDayClick,
  startHour = 6,
  endHour = 24,
  slotHeight = 60,
}: WeekViewProps) => {
  const [hoveredAppointmentId, setHoveredAppointmentId] = useState<string | null>(null);
  
  // Calcular dias da semana (Segunda a Sexta como padrão, ou Domingo a Sábado)
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Domingo
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });
  }, [selectedDate]);

  // Gerar slots de tempo (a cada 30 minutos)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, [startHour, endHour]);

  // Agrupar agendamentos por dia
  const appointmentsByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      grouped[dateStr] = appointments.filter(apt => {
        const aptDate = format(parseISO(apt.appointment_date), 'yyyy-MM-dd');
        return aptDate === dateStr;
      });
    });
    return grouped;
  }, [appointments, weekDays]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Calcular posição e altura dos cards baseado na duração do serviço
  const getAppointmentPosition = (appointment: any) => {
    const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = appointment.services?.duration || 60; // Duração em minutos
    
    const startOffset = startMinutes - (startHour * 60);
    const top = (startOffset / 30) * slotHeight;
    // Altura baseada na duração: cada 30 minutos = 1 slotHeight
    const height = Math.max((duration / 30) * slotHeight, 50); // Mínimo 50px para legibilidade
    
    return { top, height };
  };

  const handleTimeSlotClick = (date: Date, time: string) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(date, time);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">
          Semana de {format(weekDays[0], "dd 'de' MMMM", { locale: ptBR })} a {format(weekDays[6], "dd 'de' MMMM", { locale: ptBR })}
        </h2>
      </div>

      <div className="flex-1">
        <div className="relative">
          {/* Grid principal */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            {/* Cabeçalho dos dias */}
            <div className="flex border-b bg-muted/30">
              {/* Espaço para coluna de horários */}
              <div className="w-16 sm:w-20 flex-shrink-0 border-r"></div>
              {/* Dias da semana */}
              {weekDays.map((day, index) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAppointments = appointmentsByDay[dateStr] || [];
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex-1 min-w-[120px] sm:min-w-[150px] p-2 border-r last:border-r-0 text-center cursor-pointer transition-colors",
                      "hover:bg-muted/50",
                      isToday && "bg-primary/10 font-semibold"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {dayNames[index]}
                    </div>
                    <div className={cn(
                      "text-lg font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dayAppointments.length} agendamento{dayAppointments.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Grid de horários e agendamentos */}
            <div className="flex overflow-x-auto relative">
              {/* Coluna de horários */}
              <div className="w-16 sm:w-20 flex-shrink-0 border-r bg-muted/30 relative z-0">
                {timeSlots.map((time, index) => {
                  // Verificar se este horário está relacionado ao card hovered
                  const [hours, minutes] = time.split(':').map(Number);
                  const slotStartMinutes = hours * 60 + minutes;
                  const slotEndMinutes = slotStartMinutes + 30;
                  
                  // Encontrar o agendamento hovered
                  const hoveredAppointment = appointments.find(apt => apt.id === hoveredAppointmentId);
                  let isHighlighted = false;
                  
                  if (hoveredAppointment) {
                    const [aptHours, aptMinutes] = hoveredAppointment.appointment_time.split(':').map(Number);
                    const aptStartMinutes = aptHours * 60 + aptMinutes;
                    const aptDuration = hoveredAppointment.services?.duration || 60;
                    const aptEndMinutes = aptStartMinutes + aptDuration;
                    
                    // Verificar se este slot está dentro do horário do agendamento hovered
                    isHighlighted = slotStartMinutes >= aptStartMinutes && slotStartMinutes < aptEndMinutes;
                  }
                  
                  return (
                    <div
                      key={time}
                      className={cn(
                        "h-[60px] flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b relative",
                        index % 2 === 0 && "font-medium",
                        isHighlighted && "bg-purple-100/50 dark:bg-purple-900/20"
                      )}
                    >
                      {index % 2 === 0 && time.replace(':00', 'h')}
                    </div>
                  );
                })}
              </div>

              {/* Overlay de sombreado global quando hover (se estende por todas as colunas) */}
              {hoveredAppointmentId && (() => {
                const hoveredAppointment = appointments.find(apt => apt.id === hoveredAppointmentId);
                if (!hoveredAppointment) return null;
                
                const { top, height } = getAppointmentPosition(hoveredAppointment);
                
                return (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: '80px',
                      right: '0px',
                      top: `${top}px`,
                      height: `${height}px`,
                      zIndex: 1,
                      backgroundColor: 'rgba(168, 85, 247, 0.08)',
                    }}
                  />
                );
              })()}

              {/* Colunas dos dias */}
              {weekDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAppointments = appointmentsByDay[dateStr] || [];
                const isToday = isSameDay(day, new Date());
                
                // Verificar se há um agendamento hovered neste dia
                const hoveredAppointment = hoveredAppointmentId 
                  ? appointments.find(apt => apt.id === hoveredAppointmentId && format(parseISO(apt.appointment_date), 'yyyy-MM-dd') === dateStr)
                  : null;
                
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex-1 min-w-[120px] sm:min-w-[150px] relative border-r last:border-r-0",
                      isToday && "bg-primary/5"
                    )}
                    style={{ minHeight: `${timeSlots.length * slotHeight}px` }}
                  >

                  {/* Slots clicáveis */}
                  {timeSlots.map((time) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const slotStartMinutes = hours * 60 + minutes;
                    const slotTop = ((slotStartMinutes - startHour * 60) / 30) * slotHeight;
                    
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
                        onClick={() => handleTimeSlotClick(day, time)}
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

                    {/* Posicionar agendamentos baseado no horário e duração */}
                    {dayAppointments.map((appointment) => {
                      const { top, height } = getAppointmentPosition(appointment);
                      
                      return (
                        <div
                          key={appointment.id}
                          className="absolute left-1 right-1"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            zIndex: 5,
                          }}
                          onMouseEnter={() => setHoveredAppointmentId(appointment.id)}
                          onMouseLeave={() => setHoveredAppointmentId(null)}
                        >
                          <CompactAppointmentBar
                            appointment={appointment}
                            onClick={() => onAppointmentClick?.(appointment)}
                            className="h-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
