
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
      // Buscar informações do agendamento incluindo cliente e cupom usado
      const { data: appointmentData, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          clients (id, birth_date),
          services (price)
        `)
        .eq('id', appointment.id)
        .single();

      if (fetchError) throw fetchError;
      if (!appointmentData) throw new Error('Agendamento não encontrado');

      // Buscar cupom usado neste agendamento
      const { data: couponUse, error: couponError } = await supabase
        .from('coupon_uses')
        .select('*')
        .eq('appointment_id', appointment.id)
        .maybeSingle();

      if (couponError && couponError.code !== 'PGRST116') throw couponError;

      // Verificar se precisa remover o cupom
      let newTotalAmount = appointmentData.total_amount;
      let shouldRemoveCoupon = false;

      // Verificar estrutura de clients (pode ser array ou objeto único)
      const client = Array.isArray(appointmentData.clients) 
        ? appointmentData.clients[0] 
        : appointmentData.clients;

      // Verificar estrutura de services (pode ser array ou objeto único)
      const service = Array.isArray(appointmentData.services) 
        ? appointmentData.services[0] 
        : appointmentData.services;

      if (couponUse && client?.birth_date) {
        // Verificar se o novo mês ainda é o mês de aniversário
        const birthDate = new Date(client.birth_date);
        const birthMonth = birthDate.getMonth() + 1; // getMonth() retorna 0-11, então +1 para 1-12
        
        const newAppointmentDate = new Date(data.appointment_date + 'T00:00:00');
        const newAppointmentMonth = newAppointmentDate.getMonth() + 1;

        // Se o novo mês não for o mês de aniversário, remover o desconto
        if (newAppointmentMonth !== birthMonth) {
          shouldRemoveCoupon = true;
          // Recalcular total_amount sem o desconto - usar o preço do serviço diretamente
          // Se não tiver o preço do serviço, calcular: total atual + desconto aplicado
          const servicePrice = (service as any)?.price;
          if (servicePrice && servicePrice > 0) {
            newTotalAmount = servicePrice;
          } else {
            // Fallback: calcular baseado no desconto aplicado
            newTotalAmount = appointmentData.total_amount + (couponUse.valor_desconto || 0);
          }
        }
      }

      // Atualizar agendamento
      const updateData: any = {
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
      };

      // Se precisa remover cupom, atualizar total_amount
      if (shouldRemoveCoupon) {
        updateData.total_amount = newTotalAmount;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id);

      if (error) throw error;

      // Se precisa remover cupom, deletar ou atualizar o registro em coupon_uses
      if (shouldRemoveCoupon && couponUse) {
        // Deletar o registro de uso do cupom
        const { error: deleteCouponError } = await supabase
          .from('coupon_uses')
          .delete()
          .eq('id', couponUse.id);

        if (deleteCouponError) {
          console.error('Erro ao remover cupom:', deleteCouponError);
          // Não falhar o reagendamento se houver erro ao remover cupom
        }
      }

      // Retornar se removeu cupom para usar na mensagem
      return { removedCoupon: shouldRemoveCoupon };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments-full'] });
      
      toast({
        title: 'Agendamento reagendado',
        description: result?.removedCoupon 
          ? 'Horário alterado com sucesso. O cupom de aniversário foi removido pois o novo mês não é mais o mês de aniversário do cliente.'
          : 'Horário alterado com sucesso.',
      });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Erro ao reagendar agendamento:', error);
      const errorMessage = error?.message || error?.error?.message || 'Não foi possível reagendar o agendamento.';
      toast({
        title: 'Erro',
        description: errorMessage,
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
