import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Clock, User, Phone, DollarSign, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilianDate, convertToSupabaseDate } from '@/utils/timezone';

interface AppointmentsStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: 'all' | 'agendado' | 'confirmado' | 'finalizado' | 'cancelado';
  title: string;
  // Lista opcional já filtrada a partir do Dashboard
  appointmentsOverride?: any[];
}

export function AppointmentsStatusModal({ 
  open, 
  onOpenChange, 
  status,
  title,
  appointmentsOverride
}: AppointmentsStatusModalProps) {
  const { user } = useAuth();
  const todayString = convertToSupabaseDate(getBrazilianDate());

  const usingOverride = Array.isArray(appointmentsOverride);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments-status', user?.id, status, todayString, open],
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
        .eq('appointment_date', todayString)
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      let filtered = data || [];
      if (status !== 'all') {
        filtered = filtered.filter(apt => apt.status === status);
      }
      return filtered;
    },
    enabled: !!user?.id && open && !usingOverride
  });

  const finalAppointments = usingOverride
    ? [...(appointmentsOverride as any[])]
        .filter(apt => apt.appointment_date === todayString)
        .filter(apt => (status === 'all' ? true : apt.status === status))
        .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)))
    : appointments;

  const getStatusConfig = (appointmentStatus: string) => {
    switch (appointmentStatus) {
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
          icon: AlertTriangle, 
          label: 'Desconhecido' 
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Carregando...</div>
            </div>
          ) : finalAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-50" />
              <p>Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {finalAppointments.map((appointment) => {
                const statusConfig = getStatusConfig(appointment.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div 
                    key={appointment.id}
                    className="p-4 bg-surface/50 rounded-lg border border-border/30 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                            <Clock className="h-5 w-5" />
                            {appointment.appointment_time}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${statusConfig.color} flex items-center gap-1`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {appointment.clients?.name || appointment.client_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{appointment.clients?.phone || appointment.client_phone}</span>
                          </div>

                          <div className="text-muted-foreground">
                            <span className="font-medium">Serviço:</span> {appointment.services?.name}
                          </div>

                          {appointment.collaborator_id && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Profissional:</span> {(appointment as any).collaborators?.name || 'Não informado'}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              R$ {Number(appointment.total_amount || appointment.services?.price || 0).toFixed(2)}
                            </span>
                          </div>

                          {appointment.observations && (
                            <div className="text-muted-foreground mt-2 pt-2 border-t">
                              <span className="font-medium">Observações:</span> {appointment.observations}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
