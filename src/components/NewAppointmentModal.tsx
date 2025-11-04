
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ServiceSelector } from './ServiceSelector';

interface NewAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: any;
}

export const NewAppointmentModal = ({ open, onOpenChange, appointment }: NewAppointmentModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [date, setDate] = useState<Date | undefined>(
    appointment ? new Date(appointment.appointment_date) : undefined
  );
  const [time, setTime] = useState(appointment?.appointment_time || '');
  const [clientName, setClientName] = useState(appointment?.client_name || '');
  const [clientPhone, setClientPhone] = useState(appointment?.client_phone || '');
  const [selectedServices, setSelectedServices] = useState<any[]>(
    appointment ? [{ 
      id: '1', 
      serviceId: appointment.service_id, 
      service: { id: appointment.service_id, name: '', price: 0, duration: 0, category: '' },
      collaboratorId: appointment.collaborator_id 
    }] : [{ 
      id: '1', 
      serviceId: '', 
      service: { id: '', name: '', price: 0, duration: 0, category: '' } 
    }]
  );
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      // Para múltiplos serviços, criar um agendamento para cada serviço
      const appointments = selectedServices.map(selectedService => ({
        ...appointmentData,
        service_id: selectedService.serviceId,
        collaborator_id: selectedService.collaboratorId,
        total_amount: selectedService.service.price,
        user_id: user?.id,
        status: 'agendado'
      }));

      for (const apt of appointments) {
        const { error } = await supabase
          .from('appointments')
          .insert(apt);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      toast({
        title: 'Agendamento criado',
        description: 'O agendamento foi criado com sucesso.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          ...appointmentData,
          service_id: selectedServices[0]?.serviceId,
          collaborator_id: selectedServices[0]?.collaboratorId,
          total_amount: selectedServices[0]?.service?.price
        })
        .eq('id', appointment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      toast({
        title: 'Agendamento atualizado',
        description: 'O agendamento foi atualizado com sucesso.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setDate(undefined);
    setTime('');
    setClientName('');
    setClientPhone('');
    setSelectedServices([{ 
      id: '1', 
      serviceId: '', 
      service: { id: '', name: '', price: 0, duration: 0, category: '' } 
    }]);
    setNotes('');
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setIsCalendarOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !time || !clientName || !selectedServices[0]?.serviceId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    const appointmentData = {
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
      client_name: clientName,
      client_phone: clientPhone,
      notes
    };

    if (appointment) {
      updateAppointmentMutation.mutate(appointmentData);
    } else {
      createAppointmentMutation.mutate(appointmentData);
    }
  };

  // Converter tempo para formato 24h brasileiro
  const convertTo24Hour = (timeValue: string) => {
    if (!timeValue) return '';
    
    // Se já está no formato 24h, retorna como está
    if (timeValue.includes(':') && !timeValue.includes(' ')) {
      return timeValue;
    }
    
    return timeValue;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {appointment ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] overflow-y-auto pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="time">Horário *</Label>
                <Input
                  id="time"
                  type="time"
                  value={convertTo24Hour(time)}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  step="300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Nome do Cliente *</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite o nome do cliente"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefone</Label>
                <Input
                  id="client-phone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Digite o telefone do cliente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Serviços *</Label>
              <ServiceSelector
                selectedServices={selectedServices}
                onServicesChange={setSelectedServices}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createAppointmentMutation.isPending || updateAppointmentMutation.isPending}
              >
                {appointment ? 'Atualizar' : 'Criar'} Agendamento
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
