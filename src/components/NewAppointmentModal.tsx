
import { useEffect, useState } from 'react';
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
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ServiceSelector } from './ServiceSelector';
import { formatPhone, normalizePhone } from '@/utils/phone';
import { isCollaboratorAvailable } from '@/utils/collaboratorSchedule';

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
  const [clientPhone, setClientPhone] = useState(formatPhone(appointment?.client_phone || ''));
  const [clientBirthDate, setClientBirthDate] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<any[]>(
    appointment ? [{ 
      id: '1', 
      serviceId: appointment.service_id, 
      service: { id: appointment.service_id, name: '', price: 0, duration: 0, category: '' },
      collaboratorId: appointment.collaborator_id,
      collaboratorIds: appointment.collaborator_id ? [appointment.collaborator_id] : []
    }] : [{ 
      id: '1', 
      serviceId: '', 
      service: { id: '', name: '', price: 0, duration: 0, category: '' },
      collaboratorIds: []
    }]
  );
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Obter o primeiro colaborador selecionado do primeiro serviço
  const selectedCollaboratorIds = selectedServices[0]?.collaboratorIds || [];
  const selectedCollaboratorId = selectedCollaboratorIds.length > 0 ? selectedCollaboratorIds[0] : selectedServices[0]?.collaboratorId;
  
  // Buscar TODOS os bloqueios do colaborador selecionado (não apenas da data)
  const { data: allCollaboratorBlocks = [] } = useQuery({
    queryKey: ['collaborator-blocks-all', selectedCollaboratorId],
    queryFn: async () => {
      if (!selectedCollaboratorId) return [];
      
      const { data, error } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', selectedCollaboratorId)
        .order('start_date');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCollaboratorId
  });

  // Buscar bloqueios por horário do colaborador para a data selecionada
  const { data: collaboratorTimeBlocks = [] } = useQuery({
    queryKey: ['collaborator-time-blocks', selectedCollaboratorId, date],
    queryFn: async () => {
      if (!selectedCollaboratorId || !date) return [];
      
      const formattedDate = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('collaborator_time_blocks' as any)
        .select('*')
        .eq('collaborator_id', selectedCollaboratorId)
        .eq('block_date', formattedDate)
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCollaboratorId && !!date
  });

  // Verificar se a data selecionada está dentro de algum bloqueio
  const isDateBlocked = date && allCollaboratorBlocks.some(block => {
    const blockStart = new Date(block.start_date);
    const blockEnd = new Date(block.end_date);
    const selectedDate = new Date(date);
    
    // Normalizar para comparar apenas as datas (sem hora)
    blockStart.setHours(0, 0, 0, 0);
    blockEnd.setHours(23, 59, 59, 999);
    selectedDate.setHours(0, 0, 0, 0);
    
    return selectedDate >= blockStart && selectedDate <= blockEnd;
  });

  // Buscar informações do colaborador para exibir o nome
  const { data: selectedCollaborator } = useQuery({
    queryKey: ['collaborator', selectedCollaboratorId],
    queryFn: async () => {
      if (!selectedCollaboratorId) return null;
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('name')
        .eq('id', selectedCollaboratorId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCollaboratorId
  });

  // Buscar clientes filtrados por nome para autocomplete
  const { data: clientSuggestions = [] } = useQuery({
    queryKey: ['clients-search', user?.id, clientName],
    queryFn: async () => {
      if (!user?.id || !clientName || clientName.length < 2) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, birth_date')
        .eq('user_id', user.id)
        .ilike('name', `%${clientName}%`)
        .limit(10)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && clientName.length >= 2 && !selectedClientId
  });

  useEffect(() => {
    if (!appointment) {
      setClientName('');
      setClientPhone('');
      setClientBirthDate('');
      setSelectedClientId(null);
      setShowClientSuggestions(false);
      return;
    }

    setClientName(appointment.client_name || '');
    setClientPhone(formatPhone(appointment.client_phone || ''));
    setSelectedClientId(null);
    setShowClientSuggestions(false);
  }, [appointment]);

  const handlePhoneChange = (value: string) => {
    const digits = normalizePhone(value).slice(0, 11);
    setClientPhone(formatPhone(digits));
  };

  const handleClientSelect = (client: any) => {
    setClientName(client.name);
    setClientPhone(formatPhone(client.phone || ''));
    if (client.birth_date) {
      // Formatar data de nascimento para dd/mm/yyyy
      const birthDate = new Date(client.birth_date);
      const formattedDate = format(birthDate, 'dd/MM/yyyy');
      setClientBirthDate(formattedDate);
    }
    setSelectedClientId(client.id);
    setShowClientSuggestions(false);
  };

  const handleClientNameChange = (value: string) => {
    setClientName(value);
    setSelectedClientId(null);
    if (value.length >= 2) {
      setShowClientSuggestions(true);
    } else {
      setShowClientSuggestions(false);
    }
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

        // VALIDAÇÃO: Verificar horários de trabalho do colaborador
        if (selectedCollaboratorId && date && appointmentData.appointment_time) {
          const formattedDate = format(date, 'yyyy-MM-dd');
          // Criar data sem problemas de timezone - usar apenas ano, mês e dia
          const [year, month, day] = formattedDate.split('-').map(Number);
          const selectedDate = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
          selectedDate.setHours(0, 0, 0, 0);

          // Buscar colaborador e seus horários
          const { data: collaboratorData } = await supabase
            .from('collaborators')
            .select('*')
            .eq('id', selectedCollaboratorId)
            .single();

          if (collaboratorData) {
            const { data: schedules } = await (supabase
              .from('collaborator_schedules' as any)
              .select('*')
              .eq('collaborator_id', selectedCollaboratorId));

            const typedSchedules = schedules as any[] | null;

            console.log('🔍 DEBUG - Validação de horário do colaborador:');
            console.log('Data selecionada (string):', formattedDate);
            console.log('Data objeto:', selectedDate);
            console.log('Data ISO:', selectedDate.toISOString());
            console.log('Data local:', selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
            console.log('Dia da semana (getDay()):', selectedDate.getDay(), '-', ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][selectedDate.getDay()]);
            console.log('Horário selecionado:', appointmentData.appointment_time);
            console.log('Colaborador ID:', selectedCollaboratorId);
            console.log('Colaborador:', collaboratorData.name);
            console.log('Colaborador ativo:', collaboratorData.active);
            console.log('Schedules encontrados:', typedSchedules);
            console.log('Schedules detalhados:', typedSchedules?.map(s => ({
              id: s.id,
              day_of_week: s.day_of_week,
              enabled: s.enabled,
              start_time: s.start_time,
              end_time: s.end_time
            })));

            if (typedSchedules && typedSchedules.length > 0) {
              const validation = isCollaboratorAvailable(
                collaboratorData,
                typedSchedules,
                selectedDate,
                appointmentData.appointment_time
              );

              console.log('Resultado da validação:', validation);

              if (!validation.available) {
                throw new Error(validation.reason || 'Colaborador não está disponível neste horário');
              }
            } else {
              console.warn('⚠️ Nenhum schedule encontrado para o colaborador');
              // Se não houver schedules, permitir o agendamento (compatibilidade com sistema antigo)
            }
          }
        }

        // VALIDAÇÃO: Verificar se colaborador está bloqueado na data selecionada
        if (selectedCollaboratorId && date) {
          const formattedDate = format(date, 'yyyy-MM-dd');
          const selectedDate = new Date(formattedDate);
          selectedDate.setHours(0, 0, 0, 0);
        
        const { data: blocks } = await supabase
          .from('collaborator_blocks')
          .select('*')
          .eq('collaborator_id', selectedCollaboratorId);

        if (blocks && blocks.length > 0) {
          const isBlocked = blocks.some(block => {
            const blockStart = new Date(block.start_date);
            const blockEnd = new Date(block.end_date);
            blockStart.setHours(0, 0, 0, 0);
            blockEnd.setHours(23, 59, 59, 999);
            return selectedDate >= blockStart && selectedDate <= blockEnd;
          });

          if (isBlocked) {
            const blockingBlock = blocks.find(block => {
              const blockStart = new Date(block.start_date);
              const blockEnd = new Date(block.end_date);
              blockStart.setHours(0, 0, 0, 0);
              blockEnd.setHours(23, 59, 59, 999);
              return selectedDate >= blockStart && selectedDate <= blockEnd;
            });
            
            throw new Error(
              `Profissional está ausente no período de ${format(new Date(blockingBlock.start_date), 'dd/MM/yyyy')} até ${format(new Date(blockingBlock.end_date), 'dd/MM/yyyy')}`
            );
          }
        }

        // VALIDAÇÃO: Verificar se o horário específico está bloqueado
        if (appointmentData.appointment_time) {
          const newService = selectedServices[0]?.service;
          const newServiceDuration = newService?.duration || 60;
          
          const { data: timeBlocksData } = await supabase
            .from('collaborator_time_blocks' as any)
            .select('*')
            .eq('collaborator_id', selectedCollaboratorId)
            .eq('block_date', formattedDate);

          if (timeBlocksData && timeBlocksData.length > 0) {
            const [timeH, timeM] = appointmentData.appointment_time.split(':').map(Number);
            const aptStart = timeH * 60 + timeM;
            const aptEnd = aptStart + newServiceDuration;

            for (const block of timeBlocksData) {
              const [blockStartH, blockStartM] = (block as any).start_time.split(':').map(Number);
              const [blockEndH, blockEndM] = (block as any).end_time.split(':').map(Number);
              const blockStart = blockStartH * 60 + blockStartM;
              const blockEnd = blockEndH * 60 + blockEndM;

              if (aptStart < blockEnd && aptEnd > blockStart) {
                throw new Error(
                  `Este colaborador não está disponível neste horário devido a um bloqueio de agenda (${(block as any).start_time.slice(0, 5)} às ${(block as any).end_time.slice(0, 5)}).`
                );
              }
            }
          }
        }

        // VALIDAÇÃO CRÍTICA: Verificar se o colaborador já tem agendamento que conflita com o horário
        // (apenas para novos agendamentos, não para edição do mesmo agendamento)
        if (selectedCollaboratorId && date && appointmentData.appointment_time) {
          // Obter duração do serviço que está sendo agendado
          const newService = selectedServices[0]?.service;
          const newServiceDuration = newService?.duration || 60;

          // Buscar todos os agendamentos do dia para verificar conflitos
          const { data: existingApts, error: checkError } = await supabase
            .from('appointments')
            .select(`
              *,
              collaborators (name),
              services (name, duration)
            `)
            .eq('user_id', user.id)
            .eq('collaborator_id', selectedCollaboratorId)
            .eq('appointment_date', formattedDate)
            .in('status', ['agendado', 'confirmado']);

          if (checkError) throw checkError;

          // Verificar conflitos considerando a duração
          if (existingApts && existingApts.length > 0) {
            const [newHours, newMinutes] = appointmentData.appointment_time.split(':').map(Number);
            const newStart = newHours * 60 + newMinutes; // minutos desde meia-noite
            const newEnd = newStart + newServiceDuration;

            for (const existingApt of existingApts) {
              // Ignorar se for o mesmo agendamento sendo editado
              if (appointment && existingApt.id === appointment.id) continue;

              const [aptHours, aptMinutes] = existingApt.appointment_time.split(':').map(Number);
              const aptStart = aptHours * 60 + aptMinutes;
              const aptDuration = (existingApt.services as any)?.duration || 60;
              const aptEnd = aptStart + aptDuration;

              // Verifica se há sobreposição de horários
              if (newStart < aptEnd && newEnd > aptStart) {
                const collaboratorName = (existingApt.collaborators as any)?.name || 'Profissional';
                const existingServiceName = (existingApt.services as any)?.name || '';
                
                // Calcular horário de término do agendamento existente
                const aptStartTime = new Date();
                aptStartTime.setHours(aptHours, aptMinutes, 0, 0);
                const aptEndTime = new Date(aptStartTime.getTime() + aptDuration * 60000);
                const aptEndTimeStr = format(aptEndTime, 'HH:mm');

                throw new Error(
                  `${collaboratorName} já possui um atendimento agendado para ${format(date, 'dd/MM/yyyy')} das ${existingApt.appointment_time} às ${aptEndTimeStr}. Por gentileza, selecione outro horário.`
                );
              }
            }
          }
        }
      }

      const normalizedPhone = normalizePhone(appointmentData.client_phone);
      const trimmedClientName = clientName.trim();

      let clientId: string | null = null;
      if (normalizedPhone) {
        const { data: existing, error: findErr } = await supabase
          .from('clients')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('phone', normalizedPhone)
          .limit(1)
          .maybeSingle();

        if (findErr && findErr.code !== 'PGRST116') throw findErr; // ignore no rows

        if (existing?.id) {
          // Cliente já existe pelo telefone - NÃO atualizar dados, manter dados originais do primeiro cadastro
          // O telefone é o identificador único, então mantemos os dados do primeiro cadastro
          clientId = existing.id;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('clients')
            .insert({
              user_id: user.id,
              name: trimmedClientName,
              phone: normalizedPhone,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertErr) throw insertErr;
          clientId = inserted.id;

          // Atualizar lista de clientes para a aba Clientes
          if (user?.id) {
            queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
          }
        }
      }

      // Para múltiplos serviços, criar um agendamento para cada serviço
      // Se houver múltiplos colaboradores, criar um agendamento para cada combinação serviço-colaborador
      const appointments: any[] = [];
      
      selectedServices.forEach(selectedService => {
        const collaboratorIds = selectedService.collaboratorIds || (selectedService.collaboratorId ? [selectedService.collaboratorId] : []);
        
        if (collaboratorIds.length > 0) {
          // Criar um agendamento para cada colaborador selecionado
          collaboratorIds.forEach(collaboratorId => {
            appointments.push({
              ...appointmentData,
              service_id: selectedService.serviceId,
              collaborator_id: collaboratorId,
              total_amount: selectedService.service.price,
              user_id: user?.id,
              status: 'agendado',
              client_id: clientId,
              client_phone: normalizedPhone,
            });
          });
        } else {
          // Se não houver colaborador selecionado, criar agendamento sem colaborador
          appointments.push({
            ...appointmentData,
            service_id: selectedService.serviceId,
            collaborator_id: null,
            total_amount: selectedService.service.price,
            user_id: user?.id,
            status: 'agendado',
            client_id: clientId,
            client_phone: normalizedPhone,
          });
        }
      });

      for (const apt of appointments) {
        // Garantir que todos os campos obrigatórios estão presentes
        const appointmentToInsert = {
          user_id: user?.id,
          service_id: apt.service_id,
          client_name: apt.client_name || trimmedClientName,
          client_phone: apt.client_phone || normalizedPhone,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          status: apt.status || 'agendado',
          collaborator_id: apt.collaborator_id || null,
          total_amount: apt.total_amount || 0,
          client_id: apt.client_id || null,
          notes: notes || null,
          observations: notes || null,
        };
        
        // Validar campos obrigatórios antes de inserir
        if (!appointmentToInsert.service_id) {
          throw new Error('Serviço é obrigatório');
        }
        if (!appointmentToInsert.client_name) {
          throw new Error('Nome do cliente é obrigatório');
        }
        if (!appointmentToInsert.client_phone) {
          throw new Error('Telefone do cliente é obrigatório');
        }
        if (!appointmentToInsert.appointment_date) {
          throw new Error('Data do agendamento é obrigatória');
        }
        if (!appointmentToInsert.appointment_time) {
          throw new Error('Horário do agendamento é obrigatório');
        }
        
        const { error } = await supabase
          .from('appointments')
          .insert(appointmentToInsert);
        
        if (error) {
          console.error('Erro ao inserir agendamento:', error);
          console.error('Dados sendo inseridos:', appointmentToInsert);
          // Melhorar mensagem de erro do Supabase
          if (error.code === '23503') {
            throw new Error('Erro de referência: Verifique se o serviço ou colaborador existe.');
          } else if (error.code === '23505') {
            throw new Error('Já existe um agendamento com estes dados.');
          } else if (error.message) {
            throw new Error(error.message);
          } else {
            throw new Error(`Erro ao criar agendamento: ${error.code || 'Erro desconhecido'}`);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
      }
      queryClient.refetchQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Agendamento criado',
        description: 'O agendamento foi criado com sucesso.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error?.message || 'Não foi possível criar o agendamento.';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Erro ao criar agendamento:', error);
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const normalizedPhone = normalizePhone(appointmentData.client_phone);
      const trimmedClientName = clientName.trim();

      if (!normalizedPhone) {
        throw new Error('Telefone do cliente é obrigatório.');
      }

      let targetClientId = appointment?.client_id ?? null;

      const { data: existing, error: findErr } = await supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('phone', normalizedPhone)
        .limit(1)
        .maybeSingle();

      if (findErr && findErr.code !== 'PGRST116') throw findErr;

      if (existing?.id) {
        targetClientId = existing.id;

        if (trimmedClientName && trimmedClientName !== existing.name) {
          const { error: updateErr } = await supabase
            .from('clients')
            .update({
              name: trimmedClientName,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .eq('user_id', user.id);

          if (updateErr) throw updateErr;
        }

        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
        }
      } else if (targetClientId) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update({
            name: trimmedClientName,
            phone: normalizedPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetClientId)
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('clients')
          .insert({
            user_id: user.id,
            name: trimmedClientName,
            phone: normalizedPhone,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        targetClientId = inserted.id;

        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
        }
      }

      const firstService = selectedServices[0];
      const collaboratorId = firstService?.collaboratorIds?.[0] || firstService?.collaboratorId || null;
      
      const { error } = await supabase
        .from('appointments')
        .update({
          ...appointmentData,
          service_id: firstService?.serviceId,
          collaborator_id: collaboratorId,
          total_amount: firstService?.service?.price,
          client_id: targetClientId,
          client_phone: normalizedPhone,
          client_name: trimmedClientName,
        })
        .eq('id', appointment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-status'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
      }
      toast({
        title: 'Agendamento atualizado',
        description: 'O agendamento foi atualizado com sucesso.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error?.message || 'Não foi possível atualizar o agendamento.';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Erro ao atualizar agendamento:', error);
    }
  });

  const resetForm = () => {
    setDate(undefined);
    setTime('');
    setClientName('');
    setClientPhone('');
    setClientBirthDate('');
    setSelectedClientId(null);
    setShowClientSuggestions(false);
    setSelectedServices([{ 
      id: '1', 
      serviceId: '', 
      service: { id: '', name: '', price: 0, duration: 0, category: '' },
      collaboratorIds: []
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

    const trimmedClientName = clientName.trim();
    const normalizedPhone = normalizePhone(clientPhone);

    if (!trimmedClientName) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do cliente.',
        variant: 'destructive',
      });
      return;
    }

    if (!normalizedPhone || normalizedPhone.length < 10) {
      toast({
        title: 'Telefone inválido',
        description: 'Informe um telefone válido com DDD.',
        variant: 'destructive',
      });
      return;
    }

    const appointmentData = {
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
      client_name: trimmedClientName,
      client_phone: normalizedPhone,
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
              <div className="space-y-2 relative">
                <Label htmlFor="client-name">Nome do Cliente *</Label>
                <div className="relative">
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    onFocus={() => clientName.length >= 2 && setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    placeholder="Digite o nome do cliente"
                    required
                  />
                  {showClientSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {clientSuggestions.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-primary/10 hover:text-foreground transition-colors rounded-sm"
                          onClick={() => handleClientSelect(client)}
                        >
                          <div className="font-medium">{client.name}</div>
                          {client.phone && (
                            <div className="text-sm text-muted-foreground">{formatPhone(client.phone)}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefone</Label>
                <Input
                  id="client-phone"
                  value={clientPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Digite o telefone do cliente"
                  required
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

            {selectedCollaboratorId && allCollaboratorBlocks.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">
                    {selectedCollaborator?.name || 'Este profissional'} está ausente
                  </p>
                  <p className="text-sm mb-2">Períodos de ausência:</p>
                  <div className="space-y-2">
                    {allCollaboratorBlocks.map((block) => (
                      <div key={block.id} className="bg-destructive/10 p-2 rounded text-sm">
                        <p className="font-medium">
                          {format(new Date(block.start_date), 'dd/MM/yyyy')} até {format(new Date(block.end_date), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <strong>Motivo:</strong> {block.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                  {isDateBlocked && (
                    <p className="text-sm font-medium mt-2 text-destructive">
                      ⚠️ A data selecionada está dentro de um período de ausência!
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

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
                disabled={
                  createAppointmentMutation.isPending || 
                  updateAppointmentMutation.isPending || 
                  isDateBlocked
                }
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
