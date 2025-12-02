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
import { CalendarIcon, Clock, User, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isBefore, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhone, normalizePhone } from '@/utils/phone';
import { cn } from '@/lib/utils';

export default function AgendamentoPublico() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedService, setSelectedService] = useState('');
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Buscar perfil do salão (público)
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['public-profile', slug],
    queryFn: async () => {
      console.log('🔍 Buscando perfil com slug:', slug);
      const { data, error } = await supabase
        // IMPORTANTE: use uma view/tabela pública segura no Supabase,
        // por exemplo: public_booking_profiles (apenas colunas necessárias)
        .from('public_booking_profiles')
        .select('*')
        .eq('slug', slug)
        .eq('agendamento_online_ativo', true)
        .maybeSingle();
      
      // Erro real de banco
      if (error) {
        console.error('❌ Erro ao buscar perfil:', error);
        console.error('Detalhes do erro:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      if (!data) {
        console.warn('⚠️ Nenhum perfil encontrado para o slug:', slug);
        return null;
      }

      console.log('✅ Perfil encontrado:', data);
      return data;
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

  // Buscar bloqueios de colaboradores
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

  // Gerar horários disponíveis
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const start = 7; // 7h
    const end = 22; // 22h
    
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

  const availableTimeSlots = useMemo(() => {
    if (!selectedCollaborator || !selectedDate || !selectedService) return [];
    
    const selectedServiceData = services.find(s => s.id === selectedService);
    const serviceDuration = selectedServiceData?.duration || 60; // duração em minutos
    
    return generateTimeSlots().filter(time => {
      // Verificar se há conflito com agendamentos existentes considerando a duração
      const hasConflict = existingAppointments.some(apt => 
        hasTimeConflict(time, serviceDuration, apt)
      );
      
      // Verificar se colaborador está bloqueado
      const isBlocked = collaboratorBlocks.length > 0;
      
      return !hasConflict && !isBlocked;
    });
  }, [selectedCollaborator, selectedDate, selectedService, existingAppointments, collaboratorBlocks, services]);

  // Criar agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !selectedDate || !selectedService || !selectedTime || !selectedCollaborator) {
        throw new Error('Dados incompletos. Por favor, selecione todos os campos obrigatórios.');
      }

      const formattedDate = format(selectedDate, 'yyyy-MM-dd');

      // VALIDAÇÃO: Verificar se colaborador está bloqueado
      const { data: blocks } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .lte('start_date', formattedDate)
        .gte('end_date', formattedDate);

      if (blocks && blocks.length > 0) {
        throw new Error('Profissional está com a agenda bloqueada nesta data');
      }

      // VALIDAÇÃO CRÍTICA: Verificar se o colaborador já tem agendamento que conflita com o horário
      const service = services.find(s => s.id === selectedService);
      const newServiceDuration = service?.duration || 60;

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

      const normalizedPhone = normalizePhone(clientPhone);

      const { error } = await supabase
        .from('appointments')
        .insert({
          user_id: profile.user_id,
          service_id: selectedService,
          appointment_date: formattedDate,
          appointment_time: selectedTime,
          client_name: clientName,
          client_phone: normalizedPhone,
          collaborator_id: selectedCollaborator,
          total_amount: service?.price || 0,
          status: 'agendado',
          notes: 'Agendamento realizado via link público'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setShowSuccess(true);
      // Reset form
      setTimeout(() => {
        setSelectedDate(undefined);
        setSelectedService('');
        setSelectedCollaborator('');
        setSelectedTime('');
        setClientName('');
        setClientPhone('');
        setShowSuccess(false);
      }, 5000);
    },
    onError: (error: any) => {
      console.error('Erro ao criar agendamento:', error);
      // Armazenar mensagem de erro para exibir abaixo dos horários
      setErrorMessage(error?.message || 'Erro ao criar agendamento. Tente novamente.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAppointmentMutation.mutate();
  };

  const handlePhoneChange = (value: string) => {
    const digits = normalizePhone(value).slice(0, 11);
    setClientPhone(formatPhone(digits));
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
            <p className="text-muted-foreground mb-4">
              Seu agendamento foi realizado com sucesso.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">
                  {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horário:</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{clientName}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Em breve você receberá uma confirmação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{profile.business_name}</h1>
          {profile.about && (
            <p className="text-muted-foreground">{profile.about}</p>
          )}
          {profile.address && (
            <p className="text-sm text-muted-foreground mt-2">{profile.address}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Seleção de Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Selecione a Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => isBefore(date, startOfDay(new Date()))}
                  locale={ptBR}
                  className="rounded-md border pointer-events-auto"
                />
              </CardContent>
            </Card>

            {/* Seleção de Serviço e Horário */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Selecione o Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{service.name}</span>
                            <span className="text-sm text-muted-foreground ml-4">
                              R$ {service.price.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {collaborators.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profissional *
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {availableCollaborators.length === 0 ? (
                      <div className="text-center py-4">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum profissional cadastrado para este serviço.
                        </p>
                      </div>
                    ) : (
                      <Select
                        value={selectedCollaborator}
                        onValueChange={setSelectedCollaborator}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um profissional" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCollaborators.map(collab => (
                            <SelectItem key={collab.id} value={collab.id}>
                              {collab.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedDate && selectedService && selectedCollaborator && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Horários Disponíveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collaboratorBlocks.length > 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
                        <p className="font-semibold text-foreground mb-2">
                          Profissional Indisponível
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          Este profissional está com a agenda bloqueada no período selecionado.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Motivo: {collaboratorBlocks[0].reason}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          De {format(parseISO(collaboratorBlocks[0].start_date), 'dd/MM/yyyy')} até {format(parseISO(collaboratorBlocks[0].end_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[200px]">
                        {availableTimeSlots.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>Nenhum horário disponível para esta data</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {availableTimeSlots.map(time => (
                              <Button
                                key={time}
                                type="button"
                                variant={selectedTime === time ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedTime(time)}
                                className="w-full"
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    )}
                    
                    {/* Mensagem de erro abaixo dos horários */}
                    {errorMessage && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Dados do Cliente */}
          {selectedDate && selectedService && selectedTime && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Seus Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={clientPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={
                    createAppointmentMutation.isPending || 
                    !clientName || 
                    !clientPhone ||
                    !selectedCollaborator ||
                    collaboratorBlocks.length > 0
                  }
                >
                  {createAppointmentMutation.isPending ? 'Agendando...' : 'Confirmar Agendamento'}
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
