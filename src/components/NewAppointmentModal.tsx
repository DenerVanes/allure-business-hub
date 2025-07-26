import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { ServiceSelector } from './ServiceSelector';

const appointmentSchema = z.object({
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  appointmentDate: z.date({
    required_error: 'Data é obrigatória',
  }),
  appointmentTime: z.string().min(1, 'Horário é obrigatório'),
  collaboratorId: z.string().optional(),
  observations: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

// Type for collaborator with matching specialties
type CollaboratorWithSpecialties = {
  active: boolean;
  created_at: string;
  email: string;
  id: string;
  name: string;
  phone: string;
  photo_url: string;
  specialty: string[];
  updated_at: string;
  user_id: string;
  matchingSpecialties?: string[];
};

interface NewAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewAppointmentModal = ({ open, onOpenChange }: NewAppointmentModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServices, setSelectedServices] = useState([
    {
      id: '1',
      serviceId: '',
      service: {} as any
    }
  ]);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      observations: '',
    },
  });

  // Buscar colaboradores do usuário
  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Buscar bloqueios dos colaboradores
  const { data: collaboratorBlocks = [] } = useQuery({
    queryKey: ['collaborator-blocks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborator_blocks')
        .select(`
          *,
          collaborators!inner(name, user_id)
        `)
        .eq('collaborators.user_id', user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Verificar se colaborador está bloqueado na data selecionada
  const checkCollaboratorAvailability = (collaboratorId: string, date: Date) => {
    const selectedDate = format(date, 'yyyy-MM-dd');
    const blocks = collaboratorBlocks.filter(block => 
      block.collaborator_id === collaboratorId &&
      selectedDate >= block.start_date &&
      selectedDate <= block.end_date
    );
    return blocks;
  };

  // Filtrar colaboradores com base nos serviços selecionados
  const getAvailableCollaborators = (): CollaboratorWithSpecialties[] => {
    const validServices = selectedServices.filter(s => s.serviceId);
    if (validServices.length === 0) {
      return collaborators.map(collaborator => ({
        ...collaborator,
        matchingSpecialties: []
      }));
    }

    const serviceCategories = validServices.map(s => s.service.category).filter(Boolean);
    
    return collaborators.filter(collaborator => {
      if (!collaborator.specialty || collaborator.specialty.length === 0) {
        return true; // Colaborador sem especialidade pode fazer qualquer serviço
      }
      
      return serviceCategories.some(category => 
        collaborator.specialty.some((spec: string) => 
          spec.toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(spec.toLowerCase())
        )
      );
    }).map(collaborator => {
      const matchingSpecialties = collaborator.specialty?.filter((spec: string) =>
        serviceCategories.some(category =>
          spec.toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(spec.toLowerCase())
        )
      ) || [];

      return {
        ...collaborator,
        matchingSpecialties
      };
    });
  };

  const onSubmit = async (data: AppointmentFormData) => {
    if (!user?.id) return;

    // Validar se pelo menos um serviço foi selecionado
    const validServices = selectedServices.filter(s => s.serviceId);
    if (validServices.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos um serviço.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar bloqueios do colaborador se selecionado
    if (data.collaboratorId) {
      const blocks = checkCollaboratorAvailability(data.collaboratorId, data.appointmentDate);
      if (blocks.length > 0) {
        const block = blocks[0];
        toast({
          title: 'Colaborador indisponível',
          description: `O profissional está indisponível de ${format(new Date(block.start_date), 'dd/MM/yyyy')} até ${format(new Date(block.end_date), 'dd/MM/yyyy')} por: ${block.reason}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const appointmentDate = data.appointmentDate;
      
      // Calcular valores totais
      const totalAmount = validServices.reduce((total, service) => {
        return total + (service.service.price || 0);
      }, 0);

      // Criar o agendamento principal
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          client_name: data.clientName,
          client_phone: data.clientPhone,
          appointment_date: format(appointmentDate, 'yyyy-MM-dd'),
          appointment_time: data.appointmentTime,
          service_id: validServices[0].serviceId, // Primeiro serviço como principal
          collaborator_id: data.collaboratorId || null,
          observations: data.observations || null,
          status: 'agendado',
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Se há múltiplos serviços, criar registros na tabela de relacionamento
      if (validServices.length > 1) {
        const serviceRelations = validServices.map(service => ({
          appointment_id: appointmentData.id,
          service_id: service.serviceId,
        }));

        const { error: relationsError } = await supabase
          .from('appointment_services')
          .insert(serviceRelations);

        if (relationsError) throw relationsError;
      }

      toast({
        title: 'Agendamento criado!',
        description: 'O agendamento foi criado com sucesso.',
      });

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      form.reset();
      setSelectedServices([{ id: '1', serviceId: '', service: {} as any }]);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para formatar horário
  const formatTime = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 4) {
      if (numbers.length >= 3) {
        return numbers.slice(0, 2) + ':' + numbers.slice(2);
      }
      return numbers;
    }
    return value;
  };

  const getTodayInBrazil = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo agendamento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome da cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(11) 99999-9999" 
                        {...field}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 11) {
                            value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                            field.onChange(value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            const today = getTodayInBrazil();
                            return date < today;
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="08:00"
                        value={field.value}
                        onChange={(e) => {
                          const formattedTime = formatTime(e.target.value);
                          field.onChange(formattedTime);
                        }}
                        maxLength={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <FormLabel>Serviços</FormLabel>
              <ServiceSelector
                selectedServices={selectedServices}
                onServicesChange={setSelectedServices}
              />
            </div>

            <FormField
              control={form.control}
              name="collaboratorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailableCollaborators().map((collaborator) => {
                        const appointmentDate = form.watch('appointmentDate');
                        const blocks = appointmentDate ? checkCollaboratorAvailability(collaborator.id, appointmentDate) : [];
                        const isBlocked = blocks.length > 0;
                        
                        return (
                          <SelectItem 
                            key={collaborator.id} 
                            value={collaborator.id}
                            disabled={isBlocked}
                          >
                            <div className="flex items-center gap-2">
                              {collaborator.photo_url ? (
                                <img
                                  src={collaborator.photo_url}
                                  alt={collaborator.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                  <UserCheck className="h-3 w-3" />
                                </div>
                              )}
                              <span>
                                {collaborator.name}
                                {collaborator.matchingSpecialties && collaborator.matchingSpecialties.length > 0 && (
                                  <span className="text-sm text-muted-foreground ml-1">
                                    - {collaborator.matchingSpecialties.join(', ')}
                                  </span>
                                )}
                                {isBlocked && (
                                  <span className="text-sm text-red-500 ml-1">(Indisponível)</span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Adicione observações sobre o atendimento..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  "Salvando..."
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4" />
                    Criar Agendamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
