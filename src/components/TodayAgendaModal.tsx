
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Phone, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Função para converter minutos em formato HH:MM
const formatDuration = (minutes: number): string => {
  if (!minutes || minutes < 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

interface TodayAgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TodayAgendaModal = ({ open, onOpenChange }: TodayAgendaModalProps) => {
  const { user } = useAuth();
  const today = new Date();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['today-appointments-full', user?.id, format(today, 'yyyy-MM-dd')],
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
        .order('appointment_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800';
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      case 'finalizado':
        return 'bg-gray-100 text-gray-800';
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
      case 'cancelado':
        return 'Cancelado';
      case 'finalizado':
        return 'Finalizado';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agenda de Hoje</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Agenda de Hoje - {format(today, "dd/MM/yyyy", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum agendamento para hoje.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(`2000-01-01T${appointment.appointment_time}`), 'HH:mm')}
                        </span>
                      </div>
                      <Badge className={getStatusColor(appointment.status)}>
                        {getStatusLabel(appointment.status)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{appointment.client_name}</span>
                      </div>
                      
                      {appointment.client_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {appointment.client_phone}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {appointment.services?.name || 'Serviço'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({formatDuration(appointment.services?.duration || 0)})
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          R$ {appointment.total_amount || 0}
                        </span>
                      </div>
                      
                      {appointment.notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          {appointment.notes}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
