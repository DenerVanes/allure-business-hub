import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Trash2, Copy, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Break {
  start: string;
  end: string;
}

interface WorkingHour {
  id?: string;
  user_id: string;
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  breaks: Break[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const DEFAULT_HOURS: Omit<WorkingHour, 'id' | 'user_id'>[] = DAYS_OF_WEEK.map(day => ({
  day_of_week: day.value,
  is_open: day.value !== 0, // Domingo fechado por padrão
  start_time: '08:00',
  end_time: day.value === 6 ? '12:00' : '18:00', // Sábado até 12h
  breaks: [],
}));

export function BusinessHoursConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Buscar horários de atendimento
  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['working-hours', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('working_hours')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (error) throw error;
      
      return (data || []).map(h => ({
        ...h,
        breaks: (h.breaks as unknown as Break[]) || [],
        start_time: h.start_time?.slice(0, 5) || '08:00',
        end_time: h.end_time?.slice(0, 5) || '18:00',
      })) as WorkingHour[];
    },
    enabled: !!user?.id,
  });

  // Inicializar horários quando os dados são carregados
  useEffect(() => {
    if (savedHours && savedHours.length > 0) {
      setWorkingHours(savedHours);
    } else if (user?.id && savedHours && savedHours.length === 0) {
      // Se não há horários salvos, usar os padrões
      setWorkingHours(DEFAULT_HOURS.map(h => ({ ...h, user_id: user.id })));
    }
  }, [savedHours, user?.id]);

  // Mutation para salvar horários
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Primeiro, deletar todos os horários existentes
      const { error: deleteError } = await supabase
        .from('working_hours')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Inserir os novos horários
      const { error: insertError } = await supabase
        .from('working_hours')
        .insert(
          workingHours.map(h => ({
            user_id: user.id,
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            start_time: h.start_time,
            end_time: h.end_time,
            breaks: h.breaks as unknown as any,
          }))
        );

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-hours', user?.id] });
      setHasChanges(false);
      toast({
        title: 'Horários salvos!',
        description: 'Seus horários de atendimento foram atualizados.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar os horários.',
        variant: 'destructive',
      });
    },
  });

  const updateHour = (dayOfWeek: number, field: keyof WorkingHour, value: any) => {
    setWorkingHours(prev => 
      prev.map(h => 
        h.day_of_week === dayOfWeek 
          ? { ...h, [field]: value }
          : h
      )
    );
    setHasChanges(true);
  };

  const addBreak = (dayOfWeek: number) => {
    setWorkingHours(prev =>
      prev.map(h =>
        h.day_of_week === dayOfWeek
          ? { ...h, breaks: [...h.breaks, { start: '12:00', end: '13:00' }] }
          : h
      )
    );
    setHasChanges(true);
  };

  const removeBreak = (dayOfWeek: number, breakIndex: number) => {
    setWorkingHours(prev =>
      prev.map(h =>
        h.day_of_week === dayOfWeek
          ? { ...h, breaks: h.breaks.filter((_, i) => i !== breakIndex) }
          : h
      )
    );
    setHasChanges(true);
  };

  const updateBreak = (dayOfWeek: number, breakIndex: number, field: 'start' | 'end', value: string) => {
    setWorkingHours(prev =>
      prev.map(h =>
        h.day_of_week === dayOfWeek
          ? {
              ...h,
              breaks: h.breaks.map((b, i) =>
                i === breakIndex ? { ...b, [field]: value } : b
              ),
            }
          : h
      )
    );
    setHasChanges(true);
  };

  const copyToAllDays = () => {
    const firstOpenDay = workingHours.find(h => h.is_open);
    if (!firstOpenDay) {
      toast({
        title: 'Nenhum dia configurado',
        description: 'Configure pelo menos um dia antes de copiar.',
        variant: 'destructive',
      });
      return;
    }

    setWorkingHours(prev =>
      prev.map(h => ({
        ...h,
        is_open: true,
        start_time: firstOpenDay.start_time,
        end_time: firstOpenDay.end_time,
        breaks: [...firstOpenDay.breaks],
      }))
    );
    setHasChanges(true);
    toast({
      title: 'Horários copiados',
      description: 'Os horários foram aplicados a todos os dias.',
    });
  };

  const validateHours = (dayOfWeek: number): string | null => {
    const hour = workingHours.find(h => h.day_of_week === dayOfWeek);
    if (!hour || !hour.is_open) return null;

    const start = hour.start_time;
    const end = hour.end_time;

    if (start >= end) {
      return 'Horário de início deve ser antes do término';
    }

    for (const b of hour.breaks) {
      if (b.start >= b.end) {
        return 'Intervalo inválido: início deve ser antes do fim';
      }
      if (b.start < start || b.end > end) {
        return 'Intervalo deve estar dentro do horário de funcionamento';
      }
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horários de Atendimento
        </CardTitle>
        <CardDescription>
          Configure os dias e horários em que você atende. Esses horários serão usados no agendamento online e interno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Botões de ação */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyToAllDays}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar para todos os dias
          </Button>
        </div>

        {/* Cards de dias da semana */}
        <div className="space-y-4">
          {DAYS_OF_WEEK.map(day => {
            const hour = workingHours.find(h => h.day_of_week === day.value);
            if (!hour) return null;

            const error = validateHours(day.value);

            return (
              <Card key={day.value} className={`${!hour.is_open ? 'opacity-60' : ''}`}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Nome do dia e switch */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <Switch
                        checked={hour.is_open}
                        onCheckedChange={(checked) => updateHour(day.value, 'is_open', checked)}
                      />
                      <Label className="font-medium">{day.label}</Label>
                    </div>

                    {hour.is_open && (
                      <>
                        {/* Horários */}
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <Label className="text-xs text-muted-foreground mb-1">Início</Label>
                            <Input
                              type="time"
                              value={hour.start_time}
                              onChange={(e) => updateHour(day.value, 'start_time', e.target.value)}
                              className="w-[120px]"
                            />
                          </div>
                          <span className="mt-5">até</span>
                          <div className="flex flex-col">
                            <Label className="text-xs text-muted-foreground mb-1">Término</Label>
                            <Input
                              type="time"
                              value={hour.end_time}
                              onChange={(e) => updateHour(day.value, 'end_time', e.target.value)}
                              className="w-[120px]"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Intervalos/Pausas */}
                  {hour.is_open && (
                    <div className="mt-4 pl-0 sm:pl-[180px]">
                      <div className="space-y-2">
                        {hour.breaks.map((breakItem, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Intervalo:</span>
                            <Input
                              type="time"
                              value={breakItem.start}
                              onChange={(e) => updateBreak(day.value, index, 'start', e.target.value)}
                              className="w-[100px]"
                            />
                            <span className="text-sm">às</span>
                            <Input
                              type="time"
                              value={breakItem.end}
                              onChange={(e) => updateBreak(day.value, index, 'end', e.target.value)}
                              className="w-[100px]"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBreak(day.value, index)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addBreak(day.value)}
                          className="mt-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar intervalo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Mensagem de erro */}
                  {error && (
                    <p className="text-sm text-destructive mt-2">{error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Botão salvar */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="min-w-[150px]"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Horários
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
