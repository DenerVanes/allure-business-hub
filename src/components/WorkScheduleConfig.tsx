import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  WorkScheduleDay, 
  validateWorkSchedule,
  type DayOfWeek 
} from '@/utils/collaboratorSchedule';

interface WorkScheduleConfigProps {
  workSchedule: WorkScheduleDay[];
  onChange: (schedule: WorkScheduleDay[]) => void;
  errors?: Record<string, string>;
}

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

export function WorkScheduleConfig({ workSchedule, onChange, errors }: WorkScheduleConfigProps) {
  const [schedule, setSchedule] = useState<WorkScheduleDay[]>(workSchedule);

  useEffect(() => {
    setSchedule(workSchedule);
  }, [workSchedule]);

  const handleDayToggle = (day: DayOfWeek, enabled: boolean) => {
    const updated = schedule.map(d => {
      if (d.day === day) {
        return {
          ...d,
          enabled,
          startTime: enabled ? d.startTime || '09:00' : '',
          endTime: enabled ? d.endTime || '18:00' : ''
        };
      }
      return d;
    });
    setSchedule(updated);
    onChange(updated);
  };

  const handleTimeChange = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    const updated = schedule.map(d => {
      if (d.day === day) {
        return { ...d, [field]: value };
      }
      return d;
    });
    setSchedule(updated);
    onChange(updated);
  };

  return (
    <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#5A2E98' }}>
          <Clock className="h-5 w-5" style={{ color: '#8E44EC' }} />
          Horários de Atendimento
        </CardTitle>
        <p className="text-sm text-[#5A4A5E] mt-1">
          Configure os dias e horários em que o colaborador está disponível para atendimento
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedule.map((day) => (
          <div
            key={day.day}
            className="flex items-center gap-4 p-4 rounded-xl border transition-colors"
            style={{
              borderColor: day.enabled ? '#F7D5E8' : '#E5E7EB',
              backgroundColor: day.enabled ? '#FCFCFD' : 'white'
            }}
          >
            {/* Checkbox para habilitar/desabilitar dia */}
            <div className="flex items-center gap-3 flex-1">
              <Checkbox
                id={`day-${day.day}`}
                checked={day.enabled}
                onCheckedChange={(checked) => handleDayToggle(day.day, checked as boolean)}
                className="h-5 w-5"
                style={{
                  borderColor: day.enabled ? '#8E44EC' : '#D1D5DB',
                  backgroundColor: day.enabled ? '#8E44EC' : 'white'
                }}
              />
              <Label
                htmlFor={`day-${day.day}`}
                className="font-medium cursor-pointer flex-1"
                style={{ color: day.enabled ? '#5A2E98' : '#9CA3AF' }}
              >
                {dayLabels[day.day]}
              </Label>
            </div>

            {/* Campos de horário (só aparecem se o dia estiver habilitado) */}
            {day.enabled && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`start-${day.day}`} className="text-sm text-[#5A4A5E]">
                    De:
                  </Label>
                  <Input
                    id={`start-${day.day}`}
                    type="time"
                    value={day.startTime}
                    onChange={(e) => handleTimeChange(day.day, 'startTime', e.target.value)}
                    className="w-32"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  />
                </div>
                <span className="text-[#5A4A5E]">até</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`end-${day.day}`} className="text-sm text-[#5A4A5E]">
                    Até:
                  </Label>
                  <Input
                    id={`end-${day.day}`}
                    type="time"
                    value={day.endTime}
                    onChange={(e) => handleTimeChange(day.day, 'endTime', e.target.value)}
                    className="w-32"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  />
                </div>
                {errors?.[day.day] && (
                  <span className="text-xs text-red-500">{errors[day.day]}</span>
                )}
              </div>
            )}

            {/* Ícone de status */}
            {day.enabled && day.startTime && day.endTime && (
              <CheckCircle2 className="h-5 w-5" style={{ color: '#8E44EC' }} />
            )}
            {!day.enabled && (
              <XCircle className="h-5 w-5 text-gray-300" />
            )}
          </div>
        ))}

        {/* Mensagem de validação geral */}
        {errors?.general && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{errors.general}</p>
          </div>
        )}

        {/* Aviso sobre validação */}
        <div className="p-3 rounded-lg bg-[#F7D5E8] border border-[#C9A7FD]">
          <p className="text-xs text-[#5A4A5E]">
            <strong>Importante:</strong> Configure pelo menos um dia de atendimento. 
            O horário final é inclusivo (ex: se termina às 19:00, pode agendar às 19:00).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}



