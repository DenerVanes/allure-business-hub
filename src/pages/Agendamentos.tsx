
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Calendar, Plus, Search, MoreVertical, Clock, CheckCircle, XCircle, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { RescheduleModal } from '@/components/RescheduleModal';

export default function Agendamentos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
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
        .order('appointment_date', { ascending: false })
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

  const filteredAppointments = appointments.filter(appointment =>
    appointment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.services?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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
        <Button onClick={() => setShowNewModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lista de Agendamentos
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
                    className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/30 hover:shadow-soft transition-all duration-200"
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
                          {appointment.clients?.name || appointment.client_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.clients?.phone || appointment.client_phone}
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
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {appointment.status === 'agendado' && (
                            <DropdownMenuItem
                              onClick={() => updateAppointmentMutation.mutate({ 
                                id: appointment.id, 
                                status: 'confirmado' 
                              })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmar
                            </DropdownMenuItem>
                          )}
                          
                          {appointment.status === 'confirmado' && (
                            <DropdownMenuItem
                              onClick={() => updateAppointmentMutation.mutate({ 
                                id: appointment.id, 
                                status: 'finalizado' 
                              })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Finalizar
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem
                            onClick={() => setRescheduleAppointment(appointment)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Reagendar
                          </DropdownMenuItem>
                          
                          {appointment.status !== 'cancelado' && appointment.status !== 'finalizado' && (
                            <DropdownMenuItem
                              onClick={() => updateAppointmentMutation.mutate({ 
                                id: appointment.id, 
                                status: 'cancelado' 
                              })}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <NewAppointmentModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
      />

      {rescheduleAppointment && (
        <RescheduleModal
          open={!!rescheduleAppointment}
          onOpenChange={(open) => !open && setRescheduleAppointment(null)}
          appointment={rescheduleAppointment}
        />
      )}
    </div>
  );
}
