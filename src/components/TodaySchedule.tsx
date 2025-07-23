
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Phone, User, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';
import { RescheduleModal } from './RescheduleModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const TodaySchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name, price, duration),
          clients (name, phone)
        `)
        .eq('user_id', user.id)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });
      
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
        .eq('user_id', user.id);
      
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

  // Filtrar apenas agendamentos de hoje que não estão finalizados
  const todayAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.appointment_date);
    return isToday(appointmentDate) && appointment.status !== 'finalizado';
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
          icon: AlertCircle, 
          label: 'Desconhecido' 
        };
    }
  };

  const getCollaboratorName = (collaboratorId: string) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    return collaborator?.name || 'Não informado';
  };

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      <Card className="col-span-full lg:col-span-2 shadow-soft border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Agenda de Hoje
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {todayAppointments.length} agendamentos
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">
            {today}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum agendamento para hoje</p>
              <p className="text-sm">Que tal aproveitar para organizar ou relaxar?</p>
            </div>
          ) : (
            todayAppointments.map((appointment) => {
              const statusConfig = getStatusConfig(appointment.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <div 
                  key={appointment.id} 
                  className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/30 hover:shadow-soft transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-semibold text-primary">
                        {appointment.appointment_time}
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {appointment.clients?.name || appointment.client_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{appointment.clients?.phone || appointment.client_phone}</span>
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
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRescheduleAppointment(appointment)}
                        className="text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Reagendar
                      </Button>
                      
                      {appointment.status === 'agendado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAppointmentMutation.mutate({ 
                            id: appointment.id, 
                            status: 'confirmado' 
                          })}
                          className="text-xs"
                        >
                          Confirmar
                        </Button>
                      )}
                      
                      {appointment.status === 'confirmado' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateAppointmentMutation.mutate({ 
                            id: appointment.id, 
                            status: 'finalizado' 
                          })}
                          className="text-xs"
                        >
                          Finalizar
                        </Button>
                      )}
                      
                      {appointment.status !== 'cancelado' && appointment.status !== 'finalizado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAppointmentMutation.mutate({ 
                            id: appointment.id, 
                            status: 'cancelado' 
                          })}
                          className="text-xs"
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          <div className="pt-4 border-t border-border/30">
            <Button variant="outline" size="sm" className="w-full">
              <Calendar className="h-4 w-4 mr-2" />
              Ver agenda completa
            </Button>
          </div>
        </CardContent>
      </Card>

      {rescheduleAppointment && (
        <RescheduleModal
          open={!!rescheduleAppointment}
          onOpenChange={(open) => !open && setRescheduleAppointment(null)}
          appointment={rescheduleAppointment}
        />
      )}
    </>
  );
};
