/**
 * Utilitários para gerenciamento de horários de colaboradores
 */

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface WorkScheduleDay {
  day: DayOfWeek;
  enabled: boolean;
  startTime: string; // Formato: "HH:mm"
  endTime: string;   // Formato: "HH:mm"
}

export interface CollaboratorSchedule {
  id?: string;
  collaborator_id: string;
  day_of_week: DayOfWeek;
  enabled: boolean;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Converte minutos para formato HH:mm
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Converte formato HH:mm para minutos
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Obtém o dia da semana de uma data
 * JavaScript getDay() retorna: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  const daysMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = date.getDay();
  const dayOfWeek = daysMap[dayIndex];
  
  console.log('📅 DEBUG getDayOfWeek:', {
    date: date.toISOString(),
    getDay: dayIndex,
    dayOfWeek: dayOfWeek,
    dateString: date.toLocaleDateString('pt-BR', { weekday: 'long' })
  });
  
  return dayOfWeek;
}

/**
 * Valida se um colaborador está disponível em um determinado dia e horário
 * IMPORTANTE: endTime é INCLUSIVO (permite agendamento no horário final)
 */
export function isCollaboratorAvailable(
  collaborator: any,
  schedules: CollaboratorSchedule[],
  appointmentDate: Date,
  appointmentTime: string
): { available: boolean; reason?: string } {
  // 1. Verificar se colaborador está ativo
  if (!collaborator.active) {
    return { available: false, reason: 'Colaborador inativo' };
  }

  // 2. Obter dia da semana do agendamento
  const dayOfWeek = getDayOfWeek(appointmentDate);

  console.log('🔍 DEBUG isCollaboratorAvailable:', {
    dayOfWeek,
    schedulesCount: schedules.length,
    schedules: schedules.map(s => ({ day: s.day_of_week, enabled: s.enabled, start: s.start_time, end: s.end_time }))
  });

  // 3. Buscar configuração do dia (case-insensitive para garantir)
  const daySchedule = schedules.find(s => 
    s.day_of_week?.toLowerCase() === dayOfWeek?.toLowerCase()
  );

  console.log('📋 Schedule encontrado para o dia:', {
    dayOfWeek,
    daySchedule,
    allSchedules: schedules.map(s => ({
      day: s.day_of_week,
      enabled: s.enabled,
      start: s.start_time,
      end: s.end_time
    }))
  });

  // 4. Verificar se colaborador trabalha neste dia
  if (!daySchedule || !daySchedule.enabled) {
    const availableDays = schedules
      .filter(s => s.enabled)
      .map(s => s.day_of_week)
      .join(', ');
    console.error('❌ Colaborador não trabalha neste dia:', {
      dayOfWeek,
      availableDays,
      daySchedule
    });
    return { 
      available: false, 
      reason: `Colaborador não trabalha neste dia (${dayOfWeek}). Dias disponíveis: ${availableDays || 'nenhum'}` 
    };
  }

  // 5. Verificar se horários estão configurados
  if (!daySchedule.start_time || !daySchedule.end_time) {
    return { available: false, reason: 'Horários não configurados para este dia' };
  }

  // 6. Converter horários para comparação
  const appointmentMinutes = timeToMinutes(appointmentTime);
  const startMinutes = timeToMinutes(daySchedule.start_time);
  const endMinutes = timeToMinutes(daySchedule.end_time);

  // 7. Validar horário (endTime é INCLUSIVO)
  if (appointmentMinutes < startMinutes || appointmentMinutes > endMinutes) {
    return {
      available: false,
      reason: `Colaborador atende de ${daySchedule.start_time} às ${daySchedule.end_time}`
    };
  }

  return { available: true };
}

/**
 * Gera slots de horários disponíveis para um colaborador em uma data
 */
export function getAvailableTimeSlots(
  schedules: CollaboratorSchedule[],
  date: Date,
  slotInterval: number = 30, // minutos entre cada slot
  existingAppointments: any[] = [],
  serviceDuration: number = 60 // duração do serviço em minutos
): string[] {
  // 1. Obter dia da semana
  const dayOfWeek = getDayOfWeek(date);

  // 2. Buscar horário do dia
  const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);

  if (!daySchedule || !daySchedule.enabled || !daySchedule.start_time || !daySchedule.end_time) {
    return []; // Não trabalha neste dia
  }

  // 3. Gerar slots
  const slots: string[] = [];
  let currentTime = timeToMinutes(daySchedule.start_time);
  const endTime = timeToMinutes(daySchedule.end_time);

  while (currentTime <= endTime) {
    const timeString = minutesToTime(currentTime);

    // Verificar se não conflita com agendamentos existentes
    const hasConflict = existingAppointments.some(apt => {
      const aptTime = timeToMinutes(apt.appointment_time);
      const aptEndTime = aptTime + (apt.duration || serviceDuration);
      const slotEndTime = currentTime + serviceDuration;

      // Conflito se: slot começa antes do fim do agendamento E slot termina depois do início do agendamento
      return currentTime < aptEndTime && slotEndTime > aptTime;
    });

    if (!hasConflict) {
      slots.push(timeString);
    }

    currentTime += slotInterval;
  }

  return slots;
}

/**
 * Resumo legível dos horários de trabalho
 */
export function formatWorkScheduleSummary(schedules: CollaboratorSchedule[]): string {
  const dayNames: Record<DayOfWeek, string> = {
    monday: 'Seg',
    tuesday: 'Ter',
    wednesday: 'Qua',
    thursday: 'Qui',
    friday: 'Sex',
    saturday: 'Sáb',
    sunday: 'Dom'
  };

  const enabledDays = schedules
    .filter(s => s.enabled && s.start_time && s.end_time)
    .map(s => `${dayNames[s.day_of_week]}: ${s.start_time}-${s.end_time}`);

  if (enabledDays.length === 0) {
    return 'Horários não configurados';
  }

  return enabledDays.join(' | ');
}

/**
 * Valida configuração de horários antes de salvar
 */
export function validateWorkSchedule(schedules: WorkScheduleDay[]): { valid: boolean; error?: string } {
  // Validação 1: Pelo menos um dia habilitado
  const hasWorkDay = schedules.some(day => day.enabled);
  if (!hasWorkDay) {
    return { valid: false, error: 'Configure pelo menos um dia de atendimento' };
  }

  // Validação 2: Dias habilitados devem ter horários válidos
  for (const day of schedules) {
    if (day.enabled) {
      if (!day.startTime || !day.endTime) {
        return { valid: false, error: `Configure os horários para ${day.day}` };
      }

      const startMinutes = timeToMinutes(day.startTime);
      const endMinutes = timeToMinutes(day.endTime);

      if (startMinutes >= endMinutes) {
        return { valid: false, error: `Horário inicial deve ser menor que horário final em ${day.day}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Converte schedules do banco para formato WorkScheduleDay
 */
export function convertSchedulesToWorkSchedule(schedules: CollaboratorSchedule[]): WorkScheduleDay[] {
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  return days.map(day => {
    const schedule = schedules.find(s => s.day_of_week === day);
    return {
      day,
      enabled: schedule?.enabled || false,
      startTime: schedule?.start_time || '',
      endTime: schedule?.end_time || ''
    };
  });
}

/**
 * Converte WorkScheduleDay para formato do banco
 */
export function convertWorkScheduleToSchedules(
  workSchedule: WorkScheduleDay[],
  collaboratorId: string
): Omit<CollaboratorSchedule, 'id' | 'created_at' | 'updated_at'>[] {
  return workSchedule
    .filter(day => day.enabled && day.startTime && day.endTime) // Apenas dias habilitados com horários válidos
    .map(day => ({
      collaborator_id: collaboratorId,
      day_of_week: day.day,
      enabled: true,
      start_time: day.startTime.trim() || null,
      end_time: day.endTime.trim() || null
    }))
    .filter(schedule => schedule.start_time && schedule.end_time); // Garantir que não há valores vazios
}


