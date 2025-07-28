
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Check, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { TodayAgendaModal } from './TodayAgendaModal';

export const TodaySchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFullAgenda, setShowFullAgenda] = useState(false);
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
        .order('appointment_time')
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const finalizeAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'finalizado' })
        .eq('id', appointmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Serviço finalizado',
        description: 'O agendamento foi marcado como finalizado.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível finalizar o serviço.',
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

  if (isLoading) {
    return (
      <Card>
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
      <Card>
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
                <div key={appointment.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {format(new Date(`2000-01-01T${appointment.appointment_time}`), 'HH:mm')}
                      </span>
                      <Badge className={getStatusColor(appointment.status)}>
                        {getStatusLabel(appointment.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{appointment.client_name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {appointment.services?.name || 'Serviço'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => finalizeAppointmentMutation.mutate(appointment.id)}
                    disabled={finalizeAppointmentMutation.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Finalizar
                  </Button>
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
    </>
  );
};
