import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Clock, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CalendarViewModal = ({ open, onOpenChange }: CalendarViewModalProps) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: appointments = [] } = useQuery({
    queryKey: ['calendar-appointments', user?.id, format(monthStart, 'yyyy-MM'), selectedCollaborator],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          services (name, price, duration),
          clients (name, phone),
          collaborators (name)
        `)
        .eq('user_id', user.id)
        .gte('appointment_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('appointment_time', { ascending: true });

      if (selectedCollaborator !== 'all') {
        query = query.eq('collaborator_id', selectedCollaborator);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open
  });

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(parseISO(apt.appointment_date), date)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'bg-blue-500';
      case 'confirmado': return 'bg-green-500';
      case 'finalizado': return 'bg-gray-500';
      case 'cancelado': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const selectedDayAppointments = selectedDate ? getAppointmentsForDay(selectedDate) : [];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Agenda - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoje
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filtrar por colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {collaborators.map(collab => (
                  <SelectItem key={collab.id} value={collab.id}>
                    {collab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* Calendário */}
            <div className="col-span-7">
              <div className="border rounded-lg p-4">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {weekDays.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Dias do mês */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Espaços vazios antes do primeiro dia */}
                  {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Dias do mês */}
                  {daysInMonth.map(day => {
                    const dayAppointments = getAppointmentsForDay(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isPast = day < new Date() && !isToday(day);

                    return (
                      <button
                        key={day.toString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "aspect-square p-2 rounded-lg border relative transition-all",
                          "hover:border-primary hover:shadow-sm",
                          isSelected && "border-primary bg-primary/10 shadow-sm",
                          isToday(day) && "border-primary font-bold",
                          isPast && "text-muted-foreground",
                          !isSameMonth(day, currentMonth) && "text-muted-foreground/50"
                        )}
                      >
                        <div className="text-sm">{format(day, 'd')}</div>
                        {dayAppointments.length > 0 && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {dayAppointments.slice(0, 3).map((apt, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  getStatusColor(apt.status)
                                )}
                              />
                            ))}
                            {dayAppointments.length > 3 && (
                              <div className="text-xs">+{dayAppointments.length - 3}</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legenda */}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Agendado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Confirmado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-muted-foreground">Finalizado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Cancelado</span>
                </div>
              </div>
            </div>

            {/* Lista de agendamentos do dia selecionado */}
            <div className="col-span-5">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">
                  {selectedDate 
                    ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                    : 'Selecione um dia'}
                </h3>

                <ScrollArea className="h-[450px]">
                  {selectedDayAppointments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum agendamento neste dia</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayAppointments.map(apt => (
                        <div 
                          key={apt.id}
                          className="p-3 bg-surface/50 rounded-lg border border-border/30 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{apt.appointment_time}</span>
                            </div>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-white border-0",
                                getStatusColor(apt.status)
                              )}
                            >
                              {apt.status}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{apt.client_name}</span>
                            </div>
                            
                            {apt.collaborators?.name && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                <span>Profissional: {apt.collaborators.name}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Briefcase className="h-3.5 w-3.5" />
                              <span>{apt.services?.name}</span>
                            </div>

                            {apt.total_amount && (
                              <div className="text-primary font-medium">
                                R$ {apt.total_amount.toFixed(2)}
                              </div>
                            )}

                            {apt.observations && (
                              <div className="text-muted-foreground text-xs mt-2 pt-2 border-t">
                                {apt.observations}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
