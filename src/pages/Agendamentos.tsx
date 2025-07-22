
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, User, Phone, Plus, Check, X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Agendamentos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [activeTab, setActiveTab] = useState('hoje');

  const { data: appointments = [], isLoading } = useQuery({
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

  const getFilteredAppointments = () => {
    const now = new Date();
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.appointment_date);
      
      switch (activeTab) {
        case 'hoje':
          return isToday(appointmentDate);
        case 'semana':
          return isThisWeek(appointmentDate, { locale: ptBR });
        case 'mes':
          return isThisMonth(appointmentDate);
        default:
          return true;
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      agendado: { label: 'Agendado', variant: 'secondary' as const },
      confirmado: { label: 'Confirmado', variant: 'default' as const },
      finalizado: { label: 'Finalizado', variant: 'outline' as const },
      cancelado: { label: 'Cancelado', variant: 'destructive' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.agendado;
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  const filteredAppointments = getFilteredAppointments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus agendamentos</p>
        </div>
        <Button onClick={() => setShowNewAppointment(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Esta Semana</TabsTrigger>
          <TabsTrigger value="mes">Este Mês</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agendamentos - {activeTab === 'hoje' ? 'Hoje' : activeTab === 'semana' ? 'Esta Semana' : 'Este Mês'}
                <Badge variant="outline" className="ml-auto">
                  {filteredAppointments.length} agendamento(s)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento encontrado para este período.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(appointment.appointment_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {appointment.appointment_time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {appointment.clients?.name || appointment.client_name}
                            </span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {appointment.clients?.phone || appointment.client_phone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{appointment.services?.name}</span>
                            <span className="text-sm text-muted-foreground">
                              R$ {appointment.services?.price} • {appointment.services?.duration}min
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(appointment.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {appointment.status === 'agendado' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  id: appointment.id, 
                                  status: 'confirmado' 
                                })}
                                disabled={updateAppointmentMutation.isPending}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            {appointment.status === 'confirmado' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  id: appointment.id, 
                                  status: 'finalizado' 
                                })}
                                disabled={updateAppointmentMutation.isPending}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            {appointment.status !== 'cancelado' && appointment.status !== 'finalizado' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  id: appointment.id, 
                                  status: 'cancelado' 
                                })}
                                disabled={updateAppointmentMutation.isPending}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewAppointmentModal
        open={showNewAppointment}
        onOpenChange={setShowNewAppointment}
      />
    </div>
  );
};

export default Agendamentos;
