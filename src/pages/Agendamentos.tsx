
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Calendar, Plus, Search, MoreVertical, Clock, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isWithinInterval, addDays, subDays, startOfWeek, addWeeks, subWeeks, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ptBR } from 'date-fns/locale';
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { FinalizeAppointmentModal } from '@/components/FinalizeAppointmentModal';
import { AppointmentDateFilter, DateFilter } from '@/components/AppointmentDateFilter';
import { CalendarHeader, ViewMode } from '@/components/calendar/CalendarHeader';
import { WeekView } from '@/components/calendar/WeekView';
import { MonthView } from '@/components/calendar/MonthView';
import { AppointmentDetailsDrawer } from '@/components/calendar/AppointmentDetailsDrawer';

export default function Agendamentos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState<string | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>(undefined);
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);
  const [finalizeAppointment, setFinalizeAppointment] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: 'all',
    label: 'Todos'
  });
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('all');

  useEffect(() => {
    if (location.state?.prefillPhone) {
      setPrefillPhone(location.state.prefillPhone);
      setShowNewModal(true);
    }
  }, [location.state]);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name, price, duration),
          clients (name, phone),
          collaborators (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      // Invalidar query de detalhes do cupom quando status mudar
      queryClient.invalidateQueries({ queryKey: ['coupon-details'] });
      toast({
        title: 'Agendamento atualizado',
        description: 'Status alterado com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      toast({
        title: 'Agendamento excluído',
        description: 'O agendamento foi excluído com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'agendado':
        return { 
          color: 'bg-blue-100 text-blue-800 border-blue-200', 
          icon: Clock, 
          label: 'Agendado' 
        };
      case 'confirmado':
        return { 
          color: 'bg-green-100 text-green-800 border-green-200', 
          icon: CheckCircle, 
          label: 'Confirmado' 
        };
      case 'finalizado':
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: CheckCircle, 
          label: 'Finalizado' 
        };
      case 'cancelado':
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          icon: XCircle, 
          label: 'Cancelado' 
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: Clock, 
          label: 'Desconhecido' 
        };
    }
  };

  const getCollaboratorName = (collaboratorId: string) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    return collaborator?.name || 'Não informado';
  };

  const handleDeleteAppointment = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteAppointmentMutation.mutate(id);
    }
  };

  // Navegação de datas
  const handlePrevious = () => {
    if (viewMode === 'day') {
      setSelectedDate(subDays(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(subWeeks(selectedDate, 1));
    } else if (viewMode === 'month') {
      setSelectedDate(addMonths(selectedDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(addWeeks(selectedDate, 1));
    } else if (viewMode === 'month') {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Clique em horário vazio
  const handleTimeSlotClick = (date: Date, time: string) => {
    setPrefillDate(date);
    setPrefillTime(time);
    setShowNewModal(true);
  };

  // Clique em dia para mudar para visualização semanal (da visualização mensal)
  const handleDayClickFromMonth = (date: Date) => {
    setSelectedDate(date);
    setViewMode('week');
  };


  // Clique no card de agendamento
  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setShowDetailsDrawer(true);
  };

  // Filtrar agendamentos por data
  const filterAppointmentsByDate = (appointments: any[]) => {
    if (dateFilter.type === 'all') return appointments;
    
    if (!dateFilter.startDate || !dateFilter.endDate) return appointments;

    return appointments.filter(appointment => {
      const appointmentDate = parseISO(appointment.appointment_date);
      return isWithinInterval(appointmentDate, {
        start: dateFilter.startDate!,
        end: dateFilter.endDate!
      });
    });
  };

  // Filtrar agendamentos por busca (apenas na visualização Lista)
  const filterAppointmentsBySearch = (appointments: any[]) => {
    if (viewMode !== 'list' || !searchTerm) return appointments;
    
    return appointments.filter(appointment => {
      const clientName = (appointment.clients?.name || appointment.client_name || '').toLowerCase();
      const serviceName = (appointment.services?.name || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      return clientName.includes(term) || serviceName.includes(term);
    });
  };

  // Filtrar agendamentos por colaborador
  const filterAppointmentsByCollaborator = (appointments: any[]) => {
    if (selectedCollaboratorId === 'all') return appointments;
    
    return appointments.filter(appointment => {
      return appointment.collaborator_id === selectedCollaboratorId;
    });
  };

  // Filtrar agendamentos cancelados (não mostrar nas visualizações de calendário)
  const filterAppointmentsByViewMode = (appointments: any[]) => {
    if (viewMode === 'list') {
      // Na visualização lista, mostrar todos incluindo cancelados
      return appointments;
    }
    // Nas visualizações de calendário (week, month), excluir cancelados
    return appointments.filter(appointment => appointment.status !== 'cancelado');
  };

  const filteredAppointments = filterAppointmentsByViewMode(
    filterAppointmentsBySearch(
      filterAppointmentsByCollaborator(
        filterAppointmentsByDate(appointments)
      )
    )
  );


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus agendamentos
          </p>
        </div>
        <Button onClick={() => {
          setPrefillDate(undefined);
          setPrefillTime(undefined);
          setShowNewModal(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Header com tabs e navegação */}
      <CalendarHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentDate={selectedDate}
        onDateChange={setSelectedDate}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        collaborators={collaborators}
        selectedCollaboratorId={selectedCollaboratorId}
        onCollaboratorChange={setSelectedCollaboratorId}
      />

      {/* Filtro de Datas - apenas na visualização Lista */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-4">
          <AppointmentDateFilter
            currentFilter={dateFilter}
            onFilterChange={setDateFilter}
          />
        </div>
      )}

      {/* Visualizações */}
      <Card className="min-h-[600px]">
        <CardContent className="p-6">
          {viewMode === 'week' && (
            <WeekView
              appointments={filteredAppointments}
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              onTimeSlotClick={handleTimeSlotClick}
            />
          )}

          {viewMode === 'month' && (
            <MonthView
              appointments={filteredAppointments}
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClickFromMonth}
            />
          )}

          {viewMode === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou serviço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum agendamento encontrado</p>
                </div>
              ) : (
                filteredAppointments.map((appointment) => {
                  const statusConfig = getStatusConfig(appointment.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div 
                      key={appointment.id} 
                      className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/30 hover:shadow-soft transition-all duration-200 cursor-pointer"
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-center min-w-[80px]">
                          <div className="text-sm font-medium text-muted-foreground">
                            {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")}
                          </div>
                          <div className="text-lg font-semibold text-primary">
                            {appointment.appointment_time}
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          <div className="font-medium text-foreground">
                            {appointment.client_name || appointment.clients?.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {appointment.client_phone || appointment.clients?.phone}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {appointment.services?.name}
                          </div>
                          {appointment.collaborator_id && (
                            <div className="text-sm text-muted-foreground">
                              Profissional: {getCollaboratorName(appointment.collaborator_id)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="outline" 
                          className={`${statusConfig.color} flex items-center gap-1`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <NewAppointmentModal
        open={showNewModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewModal(false);
            setPrefillPhone(null);
            setPrefillDate(undefined);
            setPrefillTime(undefined);
          } else {
            setShowNewModal(true);
          }
        }}
        prefillPhone={prefillPhone || undefined}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
      />

      <AppointmentDetailsDrawer
        open={showDetailsDrawer}
        onOpenChange={setShowDetailsDrawer}
        appointment={selectedAppointment}
        onConfirm={(id) => updateAppointmentMutation.mutate({ id, status: 'confirmado' })}
        onFinalize={(appointment) => setFinalizeAppointment(appointment)}
        onReschedule={(appointment) => setRescheduleAppointment(appointment)}
        onCancel={(id) => updateAppointmentMutation.mutate({ id, status: 'cancelado' })}
        onDelete={handleDeleteAppointment}
      />

      {rescheduleAppointment && (
        <RescheduleModal
          open={!!rescheduleAppointment}
          onOpenChange={(open) => !open && setRescheduleAppointment(null)}
          appointment={rescheduleAppointment}
        />
      )}

      {finalizeAppointment && (
        <FinalizeAppointmentModal
          open={!!finalizeAppointment}
          onOpenChange={(open) => !open && setFinalizeAppointment(null)}
          appointment={finalizeAppointment}
        />
      )}
    </div>
  );
}
