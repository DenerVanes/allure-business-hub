import { useState, useEffect } from 'react';
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

  // Buscar perfil do salão
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['public-profile', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .eq('agendamento_online_ativo', true)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar serviços
  const { data: services = [] } = useQuery({
    queryKey: ['public-services', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
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

  // Buscar agendamentos existentes
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['public-appointments', profile?.user_id, selectedDate, selectedCollaborator],
    queryFn: async () => {
      if (!profile?.user_id || !selectedDate) return [];
      
      let query = supabase
        .from('appointments')
        .select('appointment_time, collaborator_id')
        .eq('user_id', profile.user_id)
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .in('status', ['agendado', 'confirmado']);

      if (selectedCollaborator) {
        query = query.eq('collaborator_id', selectedCollaborator);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id && !!selectedDate
  });

  // Buscar bloqueios de colaboradores
  const { data: collaboratorBlocks = [] } = useQuery({
    queryKey: ['public-blocks', selectedCollaborator, selectedDate],
    queryFn: async () => {
      if (!selectedCollaborator || !selectedDate) return [];
      
      const { data, error } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', selectedCollaborator)
        .lte('start_date', format(selectedDate, 'yyyy-MM-dd'))
        .gte('end_date', format(selectedDate, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCollaborator && !!selectedDate
  });

  // Gerar horários disponíveis
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const start = 8; // 8h
    const end = 20; // 20h
    
    for (let hour = start; hour < end; hour++) {
      for (let minute of ['00', '30']) {
        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        slots.push(time);
      }
    }
    
    return slots;
  };

  const availableTimeSlots = generateTimeSlots().filter(time => {
    // Verificar se já existe agendamento neste horário
    const hasAppointment = existingAppointments.some(apt => 
      apt.appointment_time === time && 
      (!selectedCollaborator || apt.collaborator_id === selectedCollaborator)
    );
    
    // Verificar se colaborador está bloqueado
    const isBlocked = collaboratorBlocks.length > 0;
    
    return !hasAppointment && !isBlocked;
  });

  // Criar agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !selectedDate || !selectedService || !selectedTime) {
        throw new Error('Dados incompletos');
      }

      const normalizedPhone = normalizePhone(clientPhone);
      const service = services.find(s => s.id === selectedService);

      const { error } = await supabase
        .from('appointments')
        .insert({
          user_id: profile.user_id,
          service_id: selectedService,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: selectedTime,
          client_name: clientName,
          client_phone: normalizedPhone,
          collaborator_id: selectedCollaborator || null,
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
                      Profissional (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Qualquer profissional</SelectItem>
                        {collaborators.map(collab => (
                          <SelectItem key={collab.id} value={collab.id}>
                            {collab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {selectedDate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Horários Disponíveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  disabled={createAppointmentMutation.isPending || !clientName || !clientPhone}
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
