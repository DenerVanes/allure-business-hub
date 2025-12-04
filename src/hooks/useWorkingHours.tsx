import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export function useWorkingHours(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['working-hours', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('working_hours')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week');

      if (error) throw error;

      return (data || []).map(h => ({
        ...h,
        breaks: (h.breaks as unknown as Break[]) || [],
        start_time: h.start_time?.slice(0, 5) || '08:00',
        end_time: h.end_time?.slice(0, 5) || '18:00',
      })) as WorkingHour[];
    },
    enabled: !!userId,
  });
}

/**
 * Gera slots de horário baseado nas configurações de working_hours
 */
export function generateAvailableTimeSlots(
  workingHours: WorkingHour[],
  dayOfWeek: number,
  serviceDurationMinutes: number = 30
): string[] {
  const dayConfig = workingHours.find(h => h.day_of_week === dayOfWeek);
  
  // Se o dia não está configurado ou está fechado, retorna array vazio
  if (!dayConfig || !dayConfig.is_open) {
    return [];
  }

  const slots: string[] = [];
  const [startHour, startMin] = dayConfig.start_time.split(':').map(Number);
  const [endHour, endMin] = dayConfig.end_time.split(':').map(Number);

  // Converter para minutos para facilitar cálculos
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Converter breaks para minutos
  const breaks = dayConfig.breaks.map(b => ({
    start: parseInt(b.start.split(':')[0]) * 60 + parseInt(b.start.split(':')[1]),
    end: parseInt(b.end.split(':')[0]) * 60 + parseInt(b.end.split(':')[1]),
  }));

  // Gerar slots de 30 em 30 minutos
  for (let current = startMinutes; current < endMinutes; current += 30) {
    // Verificar se o slot + duração do serviço está dentro do horário de funcionamento
    const slotEnd = current + serviceDurationMinutes;
    if (slotEnd > endMinutes) continue;

    // Verificar se o slot colide com algum intervalo
    const isInBreak = breaks.some(b => {
      // Slot inicia durante o intervalo
      if (current >= b.start && current < b.end) return true;
      // Slot termina durante o intervalo
      if (slotEnd > b.start && slotEnd <= b.end) return true;
      // Slot contém o intervalo
      if (current <= b.start && slotEnd >= b.end) return true;
      return false;
    });

    if (!isInBreak) {
      const hours = Math.floor(current / 60);
      const mins = current % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }
  }

  return slots;
}

/**
 * Verifica se um dia específico está aberto
 */
export function isDayOpen(workingHours: WorkingHour[], dayOfWeek: number): boolean {
  const dayConfig = workingHours.find(h => h.day_of_week === dayOfWeek);
  return dayConfig?.is_open ?? false;
}
