import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Briefcase, CheckCircle, XCircle, Edit, Trash2, Phone, MessageSquare } from 'lucide-react';
import { format, parseISO, addMinutes, setHours, setMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ConfirmWithClientModal } from '@/components/ConfirmWithClientModal';
import { useAuth } from '@/hooks/useAuth';

interface AppointmentDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any | null;
  onEdit?: (appointment: any) => void;
  onDelete?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onFinalize?: (appointment: any) => void;
  onCancel?: (id: string) => void;
  onReschedule?: (appointment: any) => void;
}

const SENT_MESSAGES_KEY = 'whatsapp_confirmation_sent_';

export const AppointmentDetailsDrawer = ({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onDelete,
  onConfirm,
  onFinalize,
  onCancel,
  onReschedule,
}: AppointmentDetailsDrawerProps) => {
  const { user } = useAuth();
  const [showConfirmWithClientModal, setShowConfirmWithClientModal] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  
  // Verificar se já foi enviada mensagem para este agendamento
  useEffect(() => {
    if (appointment?.id && user?.id && open) {
      const sentMessagesKey = `${SENT_MESSAGES_KEY}${user.id}`;
      const sentMessages = JSON.parse(localStorage.getItem(sentMessagesKey) || '[]');
      setHasSentMessage(sentMessages.includes(appointment.id));
    } else {
      setHasSentMessage(false);
    }
  }, [appointment?.id, user?.id, open]);
  
  if (!appointment) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'agendado':
        return {
          color: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300',
          label: 'Agendado',
        };
      case 'confirmado':
        return {
          color: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
          label: 'Confirmado',
        };
      case 'finalizado':
        return {
          color: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300',
          label: 'Finalizado',
        };
      case 'cancelado':
        return {
          color: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300',
          label: 'Cancelado',
        };
      default:
        return {
          color: 'bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-300',
          label: 'Desconhecido',
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const clientName = appointment.client_name || appointment.clients?.name || 'Cliente não informado';
  const clientPhone = appointment.client_phone || appointment.clients?.phone || '';
  const serviceName = appointment.services?.name || 'Serviço não informado';
  const collaboratorName = appointment.collaborators?.name || appointment.collaborator_name || 'Não informado';
  
  // Calcular horário final
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    try {
      // Parse do horário inicial (formato HH:mm ou HH:mm:ss)
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDate = setMinutes(setHours(new Date(), hours), minutes);
      const endDate = addMinutes(startDate, durationMinutes);
      return format(endDate, 'HH:mm');
    } catch {
      return '';
    }
  };

  const serviceDuration = appointment.services?.duration || 60; // Default 60 minutos
  const startTime = appointment.appointment_time?.split(':').slice(0, 2).join(':') || ''; // Remove segundos se houver
  const endTime = calculateEndTime(startTime, serviceDuration);
  const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Detalhes do Agendamento</span>
            <Badge variant="outline" className={cn(statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Informações do Cliente */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Cliente</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{clientName}</span>
              </div>
              {clientPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{clientPhone}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Informações do Agendamento */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Agendamento</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {format(parseISO(appointment.appointment_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{timeRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{serviceName}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Profissional: {collaboratorName}</span>
              </div>
              {appointment.total_amount && (
                <div className="pt-2">
                  <span className="text-lg font-semibold text-primary">
                    R$ {Number(appointment.total_amount).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {appointment.observations && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Observações</h3>
                <p className="text-sm text-muted-foreground">{appointment.observations}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Ações */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Ações</h3>
            <div className="flex flex-col gap-2">
              {appointment.status === 'agendado' && (
                <>
                  {!hasSentMessage && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowConfirmWithClientModal(true)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Confirmar com Cliente
                    </Button>
                  )}
                  
                  {onConfirm && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        onConfirm(appointment.id);
                        onOpenChange(false);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar Agendamento
                    </Button>
                  )}
                </>
              )}

              {appointment.status === 'confirmado' && onFinalize && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onFinalize(appointment);
                    onOpenChange(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar Serviço
                </Button>
              )}

              {onReschedule && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onReschedule(appointment);
                    onOpenChange(false);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Reagendar
                </Button>
              )}

              {appointment.status !== 'cancelado' && appointment.status !== 'finalizado' && onCancel && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
                      onCancel(appointment.id);
                      onOpenChange(false);
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar Agendamento
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                      onDelete(appointment.id);
                      onOpenChange(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Agendamento
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Modal de Confirmar com Cliente */}
      {showConfirmWithClientModal && (
        <ConfirmWithClientModal
          open={showConfirmWithClientModal}
          onOpenChange={setShowConfirmWithClientModal}
          clientName={clientName}
          clientPhone={clientPhone}
          appointmentDate={appointment.appointment_date}
          appointmentTime={startTime}
          serviceName={serviceName}
          appointmentId={appointment.id}
          onMessageSent={() => {
            setHasSentMessage(true);
          }}
        />
      )}
    </Sheet>
  );
};

