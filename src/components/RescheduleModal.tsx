
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const rescheduleSchema = z.object({
  appointment_date: z.string().min(1, 'Data é obrigatória'),
  appointment_time: z.string().min(1, 'Horário é obrigatório'),
});

type RescheduleFormData = z.infer<typeof rescheduleSchema>;

interface RescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
}

export function RescheduleModal({ open, onOpenChange, appointment }: RescheduleModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      appointment_date: appointment?.appointment_date || '',
      appointment_time: appointment?.appointment_time || '',
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (data: RescheduleFormData) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
        })
        .eq('id', appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Agendamento reagendado',
        description: 'Horário alterado com sucesso.',
      });
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível reagendar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: RescheduleFormData) => {
    rescheduleMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reagendar Atendimento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{appointment?.client_name}</p>
            <p className="text-sm text-muted-foreground">
              {appointment?.services?.name}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="appointment_date">Nova Data</Label>
              <Input
                id="appointment_date"
                type="date"
                {...register('appointment_date')}
              />
              {errors.appointment_date && (
                <p className="text-sm text-red-500">{errors.appointment_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="appointment_time">Novo Horário</Label>
              <Input
                id="appointment_time"
                type="time"
                {...register('appointment_time')}
              />
              {errors.appointment_time && (
                <p className="text-sm text-red-500">{errors.appointment_time.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={rescheduleMutation.isPending}
              >
                {rescheduleMutation.isPending ? 'Reagendando...' : 'Reagendar'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
