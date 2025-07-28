
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Check, Eye, CheckCircle, X, Calendar, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { TodayAgendaModal } from './TodayAgendaModal';
import { RescheduleModal } from './RescheduleModal';

export const TodaySchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const today = new Date();

  const { data: appointments = [], isLoading } = useQuery({
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
      return data || [];
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
                      <div className="text-sm text-muted-foreground mb-2">
                        {appointment.services?.name || 'Serviço'} - R$ {appointment.total_amount || 0}
                      </div>
                      
                      {/* Botões de ação */}
                      <div className="flex gap-2 flex-wrap">
                        {appointment.status === 'agendado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppointmentMutation.mutate({ appointmentId: appointment.id, status: 'confirmado' })}
                            disabled={updateAppointmentMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirmar
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReschedule(appointment)}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          Reagendar
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAppointmentMutation.mutate({ appointmentId: appointment.id, status: 'cancelado' })}
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteAppointmentMutation.mutate(appointment.id)}
                          disabled={deleteAppointmentMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => updateAppointmentMutation.mutate({ appointmentId: appointment.id, status: 'finalizado' })}
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Finalizar
                        </Button>
                      </div>
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
    </>
  );
};
