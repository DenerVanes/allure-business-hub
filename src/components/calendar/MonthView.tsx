import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MonthViewProps {
  appointments: any[];
  selectedDate: Date;
  onDayClick?: (date: Date) => void;
}

export const MonthView = ({
  appointments,
  selectedDate,
  onDayClick,
}: MonthViewProps) => {
  // Calcular dias do mês
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  }, [calendarStart, calendarEnd]);

  // Agrupar agendamentos por dia
  const appointmentsByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    calendarDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      grouped[dateStr] = appointments.filter(apt => {
        const aptDate = format(parseISO(apt.appointment_date), 'yyyy-MM-dd');
        return aptDate === dateStr;
      });
    });
    return grouped;
  }, [appointments, calendarDays]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Organizar dias em semanas (7 dias por semana)
  const weeks = useMemo(() => {
    const weeksArray: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeksArray.push(calendarDays.slice(i, i + 7));
    }
    return weeksArray;
  }, [calendarDays]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">
          {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="border rounded-lg overflow-hidden">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {weekDays.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="divide-y">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 divide-x">
                {week.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayAppointments = appointmentsByDay[dateStr] || [];
                  const isCurrentMonth = isSameMonth(day, selectedDate);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "min-h-[120px] p-2 border-r last:border-r-0 cursor-pointer transition-all",
                        "hover:bg-primary/10 hover:border-primary/30",
                        !isCurrentMonth && "bg-muted/20",
                        isCurrentDay && "bg-primary/5 border-primary/50"
                      )}
                      onClick={() => onDayClick?.(day)}
                    >
                      <div className={cn(
                        "text-sm font-semibold mb-2",
                        isCurrentDay && "text-primary",
                        !isCurrentMonth && "text-muted-foreground/50"
                      )}>
                        {format(day, 'd')}
                      </div>
                      
                      {dayAppointments.length > 0 && (
                        <div className="mt-2">
                          <div className={cn(
                            "text-xs font-medium px-2 py-1.5 rounded-md inline-block transition-colors",
                            isCurrentDay 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted text-muted-foreground hover:bg-primary/20"
                          )}>
                            {dayAppointments.length} agendamento{dayAppointments.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

