import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, User, Briefcase, CheckCircle, AlertCircle, Scissors } from 'lucide-react';
import { VisualServiceSelector } from '@/components/VisualServiceSelector';
import { CouponInput } from '@/components/marketing/CouponInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isBefore, startOfDay, addDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhone, normalizePhone } from '@/utils/phone';
import { cn } from '@/lib/utils';
import { generateAvailableTimeSlots, isDayOpen } from '@/hooks/useWorkingHours';
import { getAvailableTimeSlots, isCollaboratorAvailable } from '@/utils/collaboratorSchedule';
import { type CupomMes } from '@/utils/promotionStorage';

interface Break {
  start: string;
  end: string;
}

interface WorkingHour {
  id: string;
  user_id: string;
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  breaks: Break[];
}

// Interface explícita para o perfil público
interface PublicBookingProfile {
  user_id: string;
  agendamento_online_ativo: boolean;
  slug: string;
  business_name: string;
  about: string | null;
  address: string | null;
}

export default function AgendamentoPublico() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedService, setSelectedService] = useState('');
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientBirthDate, setClientBirthDate] = useState('');
  const [birthDateError, setBirthDateError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [cupomCode, setCupomCode] = useState('');
  const [appliedCupom, setAppliedCupom] = useState<{ cupom: CupomMes; desconto: number } | null>(null);

  // Buscar perfil do salão (público)
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['public-profile', slug],
    queryFn: async (): Promise<PublicBookingProfile | null> => {
      console.log('🔍 Buscando perfil com slug:', slug);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, agendamento_online_ativo, slug, business_name, about, address')
        .eq('slug', slug)
        .eq('agendamento_online_ativo', true)
        .maybeSingle();
      
      // Erro real de banco
      if (error) {
        console.error('❌ Erro ao buscar perfil:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('⚠️ Nenhum perfil encontrado para o slug:', slug);
        return null;
      }

      console.log('✅ Perfil encontrado:', data);
      return data as PublicBookingProfile;
    },
    retry: false
  });

  // Buscar serviços
  const { data: services = [], error: servicesError } = useQuery({
    queryKey: ['public-services', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      console.log('🔍 Buscando serviços para user_id:', profile.user_id);
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          service_categories ( name )
        `)
        .eq('user_id', profile.user_id)
        .eq('active', true);
      
      if (error) {
        console.error('❌ Erro ao buscar serviços:', error);
        throw error;
      }

      const mapped = (data || []).map(service => ({
        ...service,
        category: service.service_categories?.name || service.category
      }));
      console.log('✅ Serviços encontrados:', mapped.length);
      return mapped;
    },
    enabled: !!profile?.user_id,
    retry: false
  });

  // Buscar colaboradores
  const { data: collaborators = [] } = useQuery({
    queryKey: ['public-collaborators', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Buscar horários de atendimento
  const { data: workingHours = [] } = useQuery({
    queryKey: ['public-working-hours', profile?.user_id],
    queryFn: async (): Promise<WorkingHour[]> => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('working_hours')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('day_of_week');
      
      if (error) throw error;
      
      return (data || []).map(h => ({
        ...h,
        breaks: (h.breaks as unknown as Break[]) || [],
        start_time: h.start_time?.slice(0, 5) || '08:00',
        end_time: h.end_time?.slice(0, 5) || '18:00',
      })) as WorkingHour[];
    },
    enabled: !!profile?.user_id
  });

  const selectedServiceData = useMemo(
    () => services.find(service => service.id === selectedService),
    [services, selectedService]
  );

  const serviceCategory = selectedServiceData?.category ?? null;

  const availableCollaborators = useMemo(() => {
    if (!serviceCategory) {
      return collaborators;
    }

    const normalizedCategory = serviceCategory.toLowerCase();
    return collaborators.filter(collaborator => {
      if (!Array.isArray(collaborator.specialty) || collaborator.specialty.length === 0) {
        return false;
      }

      return collaborator.specialty.some(
        (spec: string) => spec?.toLowerCase() === normalizedCategory
      );
    });
  }, [collaborators, serviceCategory]);

  // Colaborador selecionado para exibir foto
  const selectedCollaboratorData = useMemo(() => {
    if (!selectedCollaborator) return null;
    return availableCollaborators.find(c => c.id === selectedCollaborator);
  }, [selectedCollaborator, availableCollaborators]);

  // Buscar agendamentos existentes com duração do serviço
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['public-appointments', profile?.user_id, selectedDate, selectedCollaborator],
    queryFn: async () => {
      if (!profile?.user_id || !selectedDate || !selectedCollaborator) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          appointment_time,
          collaborator_id,
          services (duration)
        `)
        .eq('user_id', profile.user_id)
        .eq('collaborator_id', selectedCollaborator)
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .in('status', ['agendado', 'confirmado']);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id && !!selectedDate && !!selectedCollaborator
  });

  // Buscar bloqueios de colaboradores (dia inteiro)
  const { data: collaboratorBlocks = [] } = useQuery({
    queryKey: ['public-blocks', selectedCollaborator, selectedDate],
    queryFn: async () => {
      if (!selectedCollaborator || !selectedDate) return [];
      
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .lte('start_date', formattedDate)
        .gte('end_date', formattedDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCollaborator && !!selectedDate
  });

  // Buscar bloqueios por horário do colaborador
  // Buscar horários de trabalho do colaborador
  const { data: collaboratorSchedules = [] } = useQuery({
    queryKey: ['collaborator-schedules-public', selectedCollaborator],
    queryFn: async () => {
      if (!selectedCollaborator) return [];
      
      const { data, error } = await (supabase
        .from('collaborator_schedules' as any)
        .select('*')
        .eq('collaborator_id', selectedCollaborator));
      
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!selectedCollaborator
  });

  const { data: collaboratorTimeBlocks = [] } = useQuery({
    queryKey: ['public-time-blocks', selectedCollaborator, selectedDate],
    queryFn: async () => {
      if (!selectedCollaborator || !selectedDate) return [];
      
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('collaborator_time_blocks' as any)
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .eq('block_date', formattedDate)
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCollaborator && !!selectedDate
  });

  // Limpar colaborador e horário quando serviço mudar
  useEffect(() => {
    setSelectedCollaborator('');
    setSelectedTime('');
  }, [selectedService]);

  // Limpar horário quando colaborador mudar
  useEffect(() => {
    setSelectedTime('');
    setErrorMessage(''); // Limpar mensagem de erro ao mudar colaborador
  }, [selectedCollaborator]);

  // Limpar mensagem de erro quando o horário mudar
  useEffect(() => {
    setErrorMessage('');
  }, [selectedTime]);

  // Limpar cupom aplicado quando serviço ou horário mudar
  useEffect(() => {
    setAppliedCupom(null);
    setCupomCode('');
  }, [selectedService, selectedTime]);

  // Reset collaborator if current selection no longer available for chosen service
  useEffect(() => {
    if (selectedCollaborator) {
      const stillAvailable = availableCollaborators.some(
        collaborator => collaborator.id === selectedCollaborator
      );

      if (!stillAvailable) {
        setSelectedCollaborator('');
      }
    }
  }, [availableCollaborators, selectedCollaborator]);

  // Limpar horário se colaborador estiver bloqueado
  useEffect(() => {
    if (collaboratorBlocks.length > 0) {
      setSelectedTime('');
    }
  }, [collaboratorBlocks]);

  // Gerar horários disponíveis baseado nos horários de atendimento
  const generateTimeSlots = (dayOfWeek: number, serviceDuration: number = 30) => {
    // Se tem working hours configurados, usar eles
    if (workingHours.length > 0) {
      return generateAvailableTimeSlots(workingHours, dayOfWeek, serviceDuration);
    }
    
    // Fallback: horários fixos se não houver configuração
    const slots: string[] = [];
    const start = 8;
    const end = 18;
    
    for (let hour = start; hour < end; hour++) {
      for (let minute of ['00', '30']) {
        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        slots.push(time);
      }
    }
    
    return slots;
  };

  // Função para verificar conflito de horário considerando duração
  const hasTimeConflict = (newTime: string, newServiceDuration: number, existingApt: any) => {
    const [newHours, newMinutes] = newTime.split(':').map(Number);
    const newStart = newHours * 60 + newMinutes; // minutos desde meia-noite
    const newEnd = newStart + newServiceDuration;

    const [aptHours, aptMinutes] = existingApt.appointment_time.split(':').map(Number);
    const aptStart = aptHours * 60 + aptMinutes;
    const aptDuration = (existingApt.services as any)?.duration || 60; // duração em minutos
    const aptEnd = aptStart + aptDuration;

    // Verifica se há sobreposição de horários
    // Conflito se: novo início está dentro do período existente OU novo fim está dentro do período existente
    // OU novo período engloba completamente o período existente
    return (newStart < aptEnd && newEnd > aptStart);
  };

  // Verificar se um dia está fechado
  const isDateDisabled = (date: Date) => {
    // Não permitir datas passadas
    if (isBefore(date, startOfDay(new Date()))) return true;
    
    // Se tem working hours, verificar se o dia está aberto
    if (workingHours.length > 0) {
      const dayOfWeek = getDay(date);
      return !isDayOpen(workingHours, dayOfWeek);
    }
    
    return false;
  };

  // Função para verificar se um horário está bloqueado por bloqueio de horário específico
  const isTimeBlockedByTimeBlock = (time: string, serviceDuration: number) => {
    if (!collaboratorTimeBlocks || collaboratorTimeBlocks.length === 0) return false;
    
    const [timeH, timeM] = time.split(':').map(Number);
    const aptStart = timeH * 60 + timeM;
    const aptEnd = aptStart + serviceDuration;
    
    return collaboratorTimeBlocks.some((block: any) => {
      const [blockStartH, blockStartM] = block.start_time.split(':').map(Number);
      const [blockEndH, blockEndM] = block.end_time.split(':').map(Number);
      const blockStart = blockStartH * 60 + blockStartM;
      const blockEnd = blockEndH * 60 + blockEndM;
      
      // Conflito se houver sobreposição
      return aptStart < blockEnd && aptEnd > blockStart;
    });
  };

  const availableTimeSlots = useMemo(() => {
    if (!selectedCollaborator || !selectedDate || !selectedService) return [];
    
    const selectedServiceData = services.find(s => s.id === selectedService);
    const serviceDuration = selectedServiceData?.duration || 60; // duração em minutos
    const dayOfWeek = getDay(selectedDate);
    
    // Se o dia está fechado, não mostrar horários
    if (workingHours.length > 0 && !isDayOpen(workingHours, dayOfWeek)) {
      return [];
    }

    // Verificar horários de trabalho do colaborador
    if (collaboratorSchedules.length > 0) {
      const slots = getAvailableTimeSlots(
        collaboratorSchedules as any,
        selectedDate,
        30, // intervalo de 30 minutos
        existingAppointments,
        serviceDuration
      );
      
      // Filtrar slots que não conflitam com bloqueios
      return slots.filter(time => {
        const isTimeBlocked = isTimeBlockedByTimeBlock(time, serviceDuration);
        return !isTimeBlocked;
      });
    }
    
    return generateTimeSlots(dayOfWeek, serviceDuration).filter(time => {
      // Verificar se há conflito com agendamentos existentes considerando a duração
      const hasConflict = existingAppointments.some(apt => 
        hasTimeConflict(time, serviceDuration, apt)
      );
      
      // Verificar se colaborador está bloqueado (dia inteiro)
      const isDayBlocked = collaboratorBlocks.length > 0;
      
      // Verificar se o horário específico está bloqueado
      const isTimeBlocked = isTimeBlockedByTimeBlock(time, serviceDuration);
      
      return !hasConflict && !isDayBlocked && !isTimeBlocked;
    });
  }, [selectedCollaborator, selectedDate, selectedService, existingAppointments, collaboratorBlocks, collaboratorTimeBlocks, collaboratorSchedules, services, workingHours]);

  // Função para formatar data enquanto digita (dd/mm/aaaa)
  const formatBirthDate = (value: string): string => {
    // Remove tudo que não é número
    const digits = value.replace(/\D/g, '');
    
    // Limita a 8 dígitos (ddmmyyyy)
    const limitedDigits = digits.slice(0, 8);
    
    // Aplica a máscara dd/mm/aaaa
    if (limitedDigits.length <= 2) {
      return limitedDigits;
    } else if (limitedDigits.length <= 4) {
      return `${limitedDigits.slice(0, 2)}/${limitedDigits.slice(2)}`;
    } else {
      return `${limitedDigits.slice(0, 2)}/${limitedDigits.slice(2, 4)}/${limitedDigits.slice(4)}`;
    }
  };

  // Função para converter dd/mm/aaaa para yyyy-MM-dd (formato ISO)
  const convertToISODate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.length !== 10) return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Validar valores
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
    
    // Formatar para ISO (yyyy-MM-dd)
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  // Função para validar data de nascimento
  const validateBirthDate = (dateStr: string): boolean => {
    if (!dateStr || dateStr.length !== 10) return false;
    
    const isoDate = convertToISODate(dateStr);
    if (!isoDate) return false;
    
    // Verificar se a data é válida
    const date = parseISO(isoDate);
    if (isNaN(date.getTime())) return false;
    
    // Verificar se a data não é no futuro
    if (isBefore(startOfDay(new Date()), startOfDay(date))) return false;
    
    // Verificar se não é muito antiga (mais de 150 anos)
    const maxAge = addDays(new Date(), -150 * 365);
    if (isBefore(startOfDay(date), startOfDay(maxAge))) return false;
    
    return true;
  };

  // Criar agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !selectedDate || !selectedService || !selectedTime || !selectedCollaborator) {
        throw new Error('Dados incompletos. Por favor, selecione todos os campos obrigatórios.');
      }

      const formattedDate = format(selectedDate, 'yyyy-MM-dd');

      // VALIDAÇÃO: Verificar se telefone tem DDD (mínimo 10 dígitos)
      const normalizedPhone = normalizePhone(clientPhone);
      if (normalizedPhone.length < 10) {
        throw new Error('Telefone deve conter DDD (mínimo 10 dígitos). Exemplo: (11) 98765-4321');
      }

      // VALIDAÇÃO: Verificar se data de nascimento foi preenchida
      if (!clientBirthDate || clientBirthDate.trim() === '') {
        throw new Error('Data de nascimento é obrigatória');
      }

      // Converter data de dd/mm/aaaa para yyyy-MM-dd (formato ISO)
      const isoBirthDate = convertToISODate(clientBirthDate);
      if (!isoBirthDate || !validateBirthDate(clientBirthDate)) {
        throw new Error('Data de nascimento inválida. Use o formato dd/mm/aaaa');
      }

      // VALIDAÇÃO: Verificar horários de trabalho do colaborador
      if (selectedCollaborator && selectedTime) {
        const { data: collaboratorData } = await supabase
          .from('collaborators')
          .select('*')
          .eq('id', selectedCollaborator)
          .single();

        if (collaboratorData) {
          const { data: schedules } = await (supabase
            .from('collaborator_schedules' as any)
            .select('*')
            .eq('collaborator_id', selectedCollaborator));

          if (schedules && schedules.length > 0) {
            const validation = isCollaboratorAvailable(
              collaboratorData,
              schedules as any,
              selectedDate,
              selectedTime
            );

            if (!validation.available) {
              throw new Error(validation.reason || 'Colaborador não está disponível neste horário');
            }
          }
        }
      }

      // VALIDAÇÃO: Verificar se colaborador está bloqueado (dia inteiro)
      const { data: blocks } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .lte('start_date', formattedDate)
        .gte('end_date', formattedDate);

      if (blocks && blocks.length > 0) {
        throw new Error('Profissional está com a agenda bloqueada nesta data');
      }

      // VALIDAÇÃO: Verificar se o horário específico está bloqueado
      const service = services.find(s => s.id === selectedService);
      const newServiceDuration = service?.duration || 60;
      
      const { data: timeBlocksData } = await supabase
        .from('collaborator_time_blocks' as any)
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .eq('block_date', formattedDate);

      if (timeBlocksData && timeBlocksData.length > 0) {
        const [timeH, timeM] = selectedTime.split(':').map(Number);
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

      // VALIDAÇÃO CRÍTICA: Verificar se o colaborador já tem agendamento que conflita com o horário

      // Buscar todos os agendamentos do dia para verificar conflitos
      const { data: existingApts, error: checkError } = await supabase
        .from('appointments')
        .select(`
          *,
          collaborators (name),
          services (name, duration)
        `)
        .eq('user_id', profile.user_id)
        .eq('collaborator_id', selectedCollaborator)
        .eq('appointment_date', formattedDate)
        .in('status', ['agendado', 'confirmado']);

      if (checkError) throw checkError;

      // Verificar conflitos considerando a duração
      if (existingApts && existingApts.length > 0) {
        const [newHours, newMinutes] = selectedTime.split(':').map(Number);
        const newStart = newHours * 60 + newMinutes; // minutos desde meia-noite
        const newEnd = newStart + newServiceDuration;

        for (const existingApt of existingApts) {
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
              `${collaboratorName} já possui um atendimento agendado para ${format(selectedDate, 'dd/MM/yyyy')} das ${existingApt.appointment_time} às ${aptEndTimeStr}. Por gentileza, selecione outro horário.`
            );
          }
        }
      }

      const trimmedClientName = clientName.trim();

      // Buscar ou criar cliente (mesma lógica do agendamento interno)
      let clientId: string | null = null;
      if (normalizedPhone) {
        const { data: existing, error: findErr } = await supabase
          .from('clients')
          .select('id, name')
          .eq('user_id', profile.user_id)
          .eq('phone', normalizedPhone)
          .limit(1)
          .maybeSingle();

        if (findErr && findErr.code !== 'PGRST116') throw findErr;

        if (existing?.id) {
          // Cliente já existe pelo telefone - NÃO atualizar dados, manter dados originais do primeiro cadastro
          // O telefone é o identificador único, então mantemos os dados do primeiro cadastro
          clientId = existing.id;
        } else {
          // Cliente não existe, criar novo
          const { data: inserted, error: insertErr } = await supabase
            .from('clients')
            .insert({
              user_id: profile.user_id,
              name: trimmedClientName,
              phone: normalizedPhone,
              birth_date: isoBirthDate,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertErr) throw insertErr;
          clientId = inserted.id;
        }
      }

      // VALIDAÇÃO E APLICAÇÃO DO CUPOM NO BACKEND (apenas se foi aplicado)
      let valorFinal = service?.price || 0;
      let cupomValidado = false;
      let cupomUseId: string | null = null;
      
      if (cupomCode && cupomCode.trim() && appliedCupom) {
        // Validar e registrar uso do cupom no backend APENAS APÓS validar todos os outros dados
        // (Isso evita marcar cupom como usado se houver erro antes de criar o agendamento)
        // Converter data de nascimento para formato ISO
        const isoBirthDateForCoupon = isoBirthDate || null;
        
        const { data: cupomValidation, error: cupomError } = await supabase
          .rpc('validate_and_use_coupon', {
            p_user_id: profile.user_id,
            p_codigo_cupom: cupomCode.trim().toUpperCase(),
            p_cliente_telefone: normalizedPhone,
            p_valor_original: service?.price || 0,
            p_cliente_birth_date: isoBirthDateForCoupon,
            p_appointment_id: null // Será atualizado após criar o agendamento
          });

        if (cupomError) {
          throw new Error(cupomError.message || 'Erro ao validar cupom');
        }

        if (!cupomValidation || !cupomValidation.valid) {
          throw new Error(cupomValidation?.error || 'Cupom inválido ou expirado');
        }

        // Usar valores calculados pelo backend
        valorFinal = parseFloat(cupomValidation.valor_final);
        cupomValidado = true;
        cupomUseId = cupomValidation.use_id;
      }

      // Criar agendamento com valor já calculado (com ou sem desconto)
      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .insert({
          user_id: profile.user_id,
          service_id: selectedService,
          appointment_date: formattedDate,
          appointment_time: selectedTime,
          client_name: trimmedClientName,
          client_phone: normalizedPhone,
          client_id: clientId, // Associar ao cliente criado/encontrado
          collaborator_id: selectedCollaborator,
          total_amount: valorFinal,
          status: 'agendado',
          notes: cupomValidado 
            ? `Agendamento realizado via link público. Cupom ${cupomCode.trim().toUpperCase()} aplicado.`
            : 'Agendamento realizado via link público'
        })
        .select('id')
        .single();

      if (error) {
        // Se houver erro ao criar agendamento, tentar reverter o uso do cupom (opcional)
        // Por enquanto apenas lançar o erro
        throw error;
      }

      // Atualizar o appointment_id no registro de uso do cupom (se foi usado)
      if (cupomValidado && appointmentData?.id && cupomUseId) {
        const { error: updateError } = await supabase
          .from('coupon_uses')
          .update({ appointment_id: appointmentData.id })
          .eq('id', cupomUseId);

        if (updateError) {
          console.error('Erro ao atualizar appointment_id no cupom:', updateError);
          // Não quebrar o fluxo se isso falhar, o cupom já foi validado
        }
      }
    },
    onSuccess: () => {
      setShowSuccess(true);
      // Limpar cupom após sucesso
      setCupomCode('');
      setAppliedCupom(null);
      // Limpar campo de cupom
      // Não limpar campos automaticamente - aguardar botão do usuário
    },
    onError: (error: any) => {
      console.error('Erro ao criar agendamento:', error);
      // Se o erro for de cupom, limpar o cupom aplicado
      if (error?.message?.includes('cupom') || error?.message?.includes('Cupom')) {
        setAppliedCupom(null);
        setCupomCode('');
      }
      // Armazenar mensagem de erro para exibir abaixo dos horários
      setErrorMessage(error?.message || 'Erro ao criar agendamento. Tente novamente.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar DDD obrigatório antes de submeter
    const normalizedPhone = normalizePhone(clientPhone);
    if (normalizedPhone.length < 10) {
      setPhoneError('Telefone deve conter DDD (mínimo 10 dígitos)');
      return;
    }
    
    // Validar data de nascimento obrigatória
    if (!clientBirthDate || clientBirthDate.trim() === '') {
      setErrorMessage('Data de nascimento é obrigatória');
      setBirthDateError('Data de nascimento é obrigatória');
      return;
    }
    
    // Validar formato da data
    if (clientBirthDate.length !== 10 || !validateBirthDate(clientBirthDate)) {
      setErrorMessage('Data de nascimento inválida. Use o formato dd/mm/aaaa');
      setBirthDateError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
      return;
    }
    
    setPhoneError('');
    setBirthDateError('');
    setErrorMessage('');
    createAppointmentMutation.mutate();
  };

  const handlePhoneChange = (value: string) => {
    const digits = normalizePhone(value).slice(0, 11);
    setClientPhone(formatPhone(digits));
    
    // Validar DDD obrigatório
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Telefone deve conter DDD (mínimo 10 dígitos)');
    } else {
      setPhoneError('');
    }
  };

  const handleBirthDateChange = (value: string) => {
    const formatted = formatBirthDate(value);
    setClientBirthDate(formatted);
    
    // Validar quando tiver 10 caracteres (dd/mm/aaaa)
    if (formatted.length === 10) {
      if (validateBirthDate(formatted)) {
        setBirthDateError('');
      } else {
        setBirthDateError('Data inválida. Use o formato dd/mm/aaaa');
      }
    } else if (formatted.length > 0) {
      setBirthDateError('');
    } else {
      setBirthDateError('');
    }
  };

  const handleNewAppointment = () => {
    // Limpar todos os campos e voltar para a tela de agendamento
    setSelectedDate(undefined);
    setSelectedService('');
    setSelectedCollaborator('');
    setSelectedTime('');
    setClientName('');
    setClientPhone('');
    setClientBirthDate('');
    setShowSuccess(false);
    setPhoneError('');
    setBirthDateError('');
    setErrorMessage('');
  };

  if (profileLoading) {
    return (
      <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#E9D5FF]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    console.error('❌ Erro ao carregar perfil:', profileError);
    return (
      <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#E9D5FF] p-4">
        <Card className="max-w-md w-full shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Erro ao carregar</h2>
            <p className="text-muted-foreground mb-2">
              {profileError instanceof Error ? profileError.message : 'Erro desconhecido'}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Verifique o console do navegador (F12) para mais detalhes.
            </p>
            <div className="mt-4 p-3 bg-destructive/10 rounded text-left text-xs font-mono overflow-auto max-h-32">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(profileError, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#E9D5FF] p-4">
        <Card className="max-w-md w-full shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Salão não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Este link de agendamento não está disponível ou foi desativado.
            </p>
            <p className="text-xs text-muted-foreground">
              Slug buscado: <code className="bg-muted px-2 py-1 rounded">{slug}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#E9D5FF] p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 px-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 mb-6 shadow-lg">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-[#9333EA] to-[#F472B6] bg-clip-text text-transparent">
              Agendamento Confirmado!
            </h2>
            <p className="text-muted-foreground mb-6 text-base">
              Seu agendamento foi realizado com sucesso. Você receberá uma confirmação em breve.
            </p>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl space-y-3 text-sm border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Data:</span>
                <span className="font-semibold text-foreground">
                  {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Horário:</span>
                <span className="font-semibold text-foreground">{selectedTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Serviço:</span>
                <span className="font-semibold text-foreground">
                  {services.find(s => s.id === selectedService)?.name}
                </span>
              </div>
              {selectedCollaboratorData && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Profissional:</span>
                  <span className="font-semibold text-foreground">
                    {selectedCollaboratorData.name}
                  </span>
                </div>
              )}
            </div>
            <Button
              onClick={handleNewAppointment}
              className="w-full mt-6 h-12 text-base font-semibold bg-gradient-to-r from-[#9333EA] to-[#F472B6] hover:from-[#7E22CE] hover:to-[#E11D8F] text-white shadow-lg"
            >
              Fazer Novo Agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen overflow-y-auto bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#E9D5FF]">
      <div className="w-full min-h-full py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
        {/* Header do Salão - Melhorado */}
        <Card className="mb-6 sm:mb-8 shadow-lg border-0 overflow-hidden bg-gradient-to-br from-white to-primary/5">
          <CardContent className="pt-8 pb-8 px-6 sm:px-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#F472B6] to-[#9333EA] mb-4 shadow-md">
                <CalendarIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#9333EA] to-[#F472B6] bg-clip-text text-transparent mb-3">
                {profile.business_name}
              </h1>
              {profile.about && (
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {profile.about}
                </p>
              )}
              {profile.address && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{profile.address}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          {/* Container de Serviços - Largura total quando não há serviço selecionado */}
          {!selectedService ? (
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm mb-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  Serviço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VisualServiceSelector
                  services={services}
                  value={selectedService}
                  onChange={setSelectedService}
                  placeholder="Selecione o serviço"
                />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Seleção de Serviço, Profissional e Data */}
            <div className="space-y-6">
              {/* Seleção de Serviço - Mostra apenas quando há serviço selecionado */}
              {selectedService && (
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      Serviço
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VisualServiceSelector
                      services={services}
                      value={selectedService}
                      onChange={setSelectedService}
                      placeholder="Selecione o serviço"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Seleção de Profissional */}
              {selectedService && (
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      Profissional
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {availableCollaborators.length === 0 ? (
                      <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          Nenhum profissional disponível para este serviço.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Selecione o profissional" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCollaborators.map(collaborator => (
                            <SelectItem key={collaborator.id} value={collaborator.id}>
                              <div className="flex items-center gap-3">
                                {collaborator.photo_url ? (
                                  <img
                                    src={collaborator.photo_url}
                                    alt={collaborator.name}
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-5 w-5" />
                                )}
                                <span>{collaborator.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Seleção de Data */}
              {selectedCollaborator && (
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={isDateDisabled}
                      locale={ptBR}
                      className="rounded-md border-2 border-primary/20 shadow-sm"
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Coluna 2: Horários e Dados do Cliente */}
            <div className="space-y-6">
              {/* Seleção de Horário */}
              {selectedDate && selectedService && selectedCollaborator && (
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      Horário
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collaboratorBlocks.length > 0 ? (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-800">
                          Profissional Indisponível: {collaboratorBlocks[0]?.reason}
                        </AlertDescription>
                      </Alert>
                    ) : selectedService && availableTimeSlots.length === 0 ? (
                      <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          Nenhum horário disponível para esta data.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <ScrollArea className="h-[250px] pr-4">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {availableTimeSlots.map(time => (
                            <Button
                              key={time}
                              type="button"
                              variant={selectedTime === time ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "w-full transition-all duration-200",
                                selectedTime === time 
                                  ? "bg-gradient-to-r from-[#9333EA] to-[#F472B6] text-white shadow-md scale-105" 
                                  : "hover:bg-primary/10 hover:border-primary/50"
                              )}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    
                    {/* Mostrar apenas erros que NÃO sejam de cupom */}
                    {errorMessage && !errorMessage.toLowerCase().includes('cupom') && (
                      <Alert variant="destructive" className="mt-4 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Dados do Cliente */}
              {selectedTime && (
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Seus Dados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-base font-medium">
                        Nome Completo *
                      </Label>
                      <Input
                        id="name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Seu nome completo"
                        required
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-base font-medium">
                        Telefone *
                      </Label>
                      <Input
                        id="phone"
                        value={clientPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(00) 00000-0000"
                        required
                        className={`h-12 text-base ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      {phoneError && (
                        <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                      )}
                      {!phoneError && normalizePhone(clientPhone).length > 0 && normalizePhone(clientPhone).length < 10 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Digite o DDD + número do telefone (mínimo 10 dígitos)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthDate" className="text-base font-medium">
                        Data de Nascimento *
                      </Label>
                      <Input
                        id="birthDate"
                        type="text"
                        inputMode="numeric"
                        value={clientBirthDate}
                        onChange={(e) => handleBirthDateChange(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        className={`h-12 text-base ${birthDateError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        maxLength={10}
                        required
                      />
                      {birthDateError && (
                        <p className="text-sm text-red-600 mt-1">{birthDateError}</p>
                      )}
                      {!birthDateError && clientBirthDate.length > 0 && clientBirthDate.length < 10 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Digite a data no formato dd/mm/aaaa
                        </p>
                      )}
                    </div>

                    {/* Campo de Cupom */}
                    {selectedService && clientPhone && normalizePhone(clientPhone).length >= 10 && profile?.user_id && (() => {
                      const service = services.find(s => s.id === selectedService);
                      return service ? (
                        <CouponInput
                          value={cupomCode}
                          onChange={setCupomCode}
                          onApply={(cupom, desconto) => {
                            // Se cupom não tem código ou desconto é 0, limpar appliedCupom
                            if (!cupom.codigo || desconto <= 0) {
                              setAppliedCupom(null);
                            } else {
                              setAppliedCupom({ cupom, desconto });
                            }
                          }}
                          clienteTelefone={clientPhone}
                          clienteNome={clientName}
                          clienteBirthDate={clientBirthDate}
                          valorServico={service.price || 0}
                          userId={profile.user_id}
                        />
                      ) : null;
                    })()}

                    {appliedCupom && appliedCupom.cupom && appliedCupom.cupom.codigo && appliedCupom.desconto > 0 && (() => {
                      const service = services.find(s => s.id === selectedService);
                      return service ? (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-green-800">
                            Desconto aplicado: {appliedCupom.cupom.percentualDesconto}% (-R$ {appliedCupom.desconto.toFixed(2)})
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Valor final: R$ {((service?.price || 0) - appliedCupom.desconto).toFixed(2)}
                          </p>
                        </div>
                      ) : null;
                    })()}

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#9333EA] to-[#F472B6] hover:from-[#7C2D9A] hover:to-[#DB2777] text-white shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={!clientName || !clientPhone || normalizePhone(clientPhone).length < 10 || !clientBirthDate || clientBirthDate.length !== 10 || !validateBirthDate(clientBirthDate) || !!birthDateError || createAppointmentMutation.isPending}
                    >
                      {createAppointmentMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Agendando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Confirmar Agendamento
                        </span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
