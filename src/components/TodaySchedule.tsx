import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Check, Eye, CheckCircle, X, Calendar, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { TodayAgendaModal } from './TodayAgendaModal';
import { RescheduleModal } from './RescheduleModal';
import { FinalizeAppointmentModal } from './FinalizeAppointmentModal';

type AppointmentWithCollaborator = any & { collaborator_name?: string };

export const TodaySchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const today = new Date();

  const { data: appointments = [], isLoading } = useQuery<AppointmentWithCollaborator[]>({
    queryKey: ['today-appointments', user?.id, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name, price, duration)
        `)
        .eq('user_id', user.id)
        .eq('appointment_date', format(today, 'yyyy-MM-dd'))
        .in('status', ['agendado', 'confirmado'])
        .order('appointment_time');
      
      if (error) throw error;
      
      // Buscar dados dos colaboradores separadamente
      if (data && data.length > 0) {
        const collaboratorIds = data
          .map(apt => apt.collaborator_id)
          .filter(Boolean);
        
        if (collaboratorIds.length > 0) {
          const { data: collaboratorsData } = await supabase
            .from('collaborators')
            .select('id, name')
            .in('id', collaboratorIds);
          
          // Adicionar nome do colaborador aos agendamentos
          return data.map(apt => ({
            ...apt,
            collaborator_name: collaboratorsData?.find(c => c.id === apt.collaborator_id)?.name
          })) as AppointmentWithCollaborator[];
        }
      }
      
      return (data || []) as AppointmentWithCollaborator[];
    },
    enabled: !!user?.id
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);
      
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      
      const statusMessages = {
        finalizado: 'Serviço finalizado',
        confirmado: 'Agendamento confirmado',
        cancelado: 'Agendamento cancelado'
      };
      
      toast({
        title: statusMessages[status as keyof typeof statusMessages],
        description: `O agendamento foi ${status === 'finalizado' ? 'finalizado' : status === 'confirmado' ? 'confirmado' : 'cancelado'}.`,
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
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800';
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'Agendado';
      case 'confirmado':
        return 'Confirmado';
      default:
        return status;
    }
  };

  const handleReschedule = (appointment: any) => {
    setSelectedAppointment(appointment);
    setShowRescheduleModal(true);
  };

  const handleFinalize = (appointment: any) => {
    setSelectedAppointment(appointment);
    setShowFinalizeModal(true);
  };

  const handleAction = (appointmentId: string, action: string, appointment?: any) => {
    setOpenPopoverId(null);
    
    if (action === 'reschedule') {
      handleReschedule(appointment);
    } else if (action === 'delete') {
      deleteAppointmentMutation.mutate(appointmentId);
    } else {
      updateAppointmentMutation.mutate({ appointmentId, status: action });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agenda de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agenda de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum agendamento para hoje.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-lg">
                          {format(new Date(`2000-01-01T${appointment.appointment_time}`), 'HH:mm')}
                        </span>
                        <Badge className={getStatusColor(appointment.status)}>
                          {getStatusLabel(appointment.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.client_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {appointment.services?.name || 'Serviço'} - R$ {appointment.total_amount || 0}
                      </div>
                      {appointment.collaborator_name && (
                        <div className="text-sm text-muted-foreground mb-3">
                          Profissional: {appointment.collaborator_name}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {appointment.status === 'agendado' ? (
                        <Button
                          size="sm"
                          onClick={() => updateAppointmentMutation.mutate({ appointmentId: appointment.id, status: 'confirmado' })}
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Confirmar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleFinalize(appointment)}
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Finalizar
                        </Button>
                      )}
                      
                      <Popover 
                        open={openPopoverId === appointment.id} 
                        onOpenChange={(open) => setOpenPopoverId(open ? appointment.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1">
                          <div className="space-y-1">
                            {appointment.status === 'agendado' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => handleAction(appointment.id, 'confirmado')}
                                disabled={updateAppointmentMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Confirmar
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => handleAction(appointment.id, 'reschedule', appointment)}
                            >
                              <Calendar className="h-3 w-3 mr-2" />
                              Reagendar
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => handleAction(appointment.id, 'cancelado')}
                              disabled={updateAppointmentMutation.isPending}
                            >
                              <X className="h-3 w-3 mr-2" />
                              Cancelar
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-red-600 hover:text-red-700"
                              onClick={() => handleAction(appointment.id, 'delete')}
                              disabled={deleteAppointmentMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Excluir
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowFullAgenda(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver agenda completa
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TodayAgendaModal
        open={showFullAgenda}
        onOpenChange={setShowFullAgenda}
      />

      <RescheduleModal
        open={showRescheduleModal}
        onOpenChange={setShowRescheduleModal}
        appointment={selectedAppointment}
      />

      <FinalizeAppointmentModal
        open={showFinalizeModal}
        onOpenChange={setShowFinalizeModal}
        appointment={selectedAppointment}
      />
    </>
  );
};
