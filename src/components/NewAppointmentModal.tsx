
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
import { Calendar as CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [selectedServiceId, setSelectedServiceId] = useState(appointment?.service_id || '');
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Filtrar serviços baseado na pesquisa
  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    service.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const { error } = await supabase
        .from('appointments')
        .insert({
          ...appointmentData,
          user_id: user?.id,
          status: 'agendado'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
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
        .update(appointmentData)
        .eq('id', appointment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
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
    setSelectedServiceId('');
    setNotes('');
    setServiceSearch('');
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setIsCalendarOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !time || !clientName || !selectedServiceId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    const selectedService = services.find(s => s.id === selectedServiceId);
    const totalAmount = selectedService?.price || 0;
    
    const appointmentData = {
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
      client_name: clientName,
      client_phone: clientPhone,
      service_id: selectedServiceId,
      notes,
      total_amount: totalAmount
    };

    if (appointment) {
      updateAppointmentMutation.mutate(appointmentData);
    } else {
      createAppointmentMutation.mutate(appointmentData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden">
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
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
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
              <Label htmlFor="service">Serviço *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar serviço..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{service.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            R$ {service.price} - {service.duration}min
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
