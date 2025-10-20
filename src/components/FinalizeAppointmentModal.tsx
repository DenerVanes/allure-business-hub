import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FinalizeAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
}

export const FinalizeAppointmentModal = ({ open, onOpenChange, appointment }: FinalizeAppointmentModalProps) => {
  const queryClient = useQueryClient();
  const [finalAmount, setFinalAmount] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'value' | 'percent'>('value');

  const originalAmount = appointment?.total_amount || 0;

  useEffect(() => {
    if (open && appointment) {
      setFinalAmount(originalAmount.toString());
      setDiscountPercent('');
    }
  }, [open, appointment, originalAmount]);

  // Calcular desconto em % quando o valor é alterado
  useEffect(() => {
    if (activeTab === 'value' && finalAmount) {
      const final = parseFloat(finalAmount) || 0;
      if (originalAmount > 0) {
        const discount = ((originalAmount - final) / originalAmount) * 100;
        setDiscountPercent(discount.toFixed(2));
      }
    }
  }, [finalAmount, originalAmount, activeTab]);

  // Calcular valor final quando o % é alterado
  useEffect(() => {
    if (activeTab === 'percent' && discountPercent) {
      const percent = parseFloat(discountPercent) || 0;
      const final = originalAmount - (originalAmount * percent / 100);
      setFinalAmount(final.toFixed(2));
    }
  }, [discountPercent, originalAmount, activeTab]);

  const finalizeAppointmentMutation = useMutation({
    mutationFn: async () => {
      const finalValue = parseFloat(finalAmount) || originalAmount;
      
      // Atualizar agendamento para finalizado com o valor final
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'finalizado',
          total_amount: finalValue
        })
        .eq('id', appointment.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      
      toast({
        title: 'Serviço finalizado',
        description: 'O agendamento foi finalizado e a receita foi registrada.',
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível finalizar o agendamento.',
        variant: 'destructive',
      });
    }
  });

  const handleFinalize = () => {
    const finalValue = parseFloat(finalAmount);
    
    if (isNaN(finalValue) || finalValue < 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, insira um valor válido.',
        variant: 'destructive',
      });
      return;
    }

    finalizeAppointmentMutation.mutate();
  };

  const discountAmount = originalAmount - (parseFloat(finalAmount) || originalAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Agendamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <p className="text-sm font-medium">{appointment?.client_name}</p>
          </div>

          <div className="space-y-2">
            <Label>Serviço</Label>
            <p className="text-sm">{appointment?.services?.name}</p>
          </div>

          <div className="space-y-2">
            <Label>Valor Original</Label>
            <p className="text-lg font-semibold">R$ {originalAmount.toFixed(2)}</p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'value' | 'percent')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="value">Valor Final</TabsTrigger>
              <TabsTrigger value="percent">Desconto %</TabsTrigger>
            </TabsList>
            
            <TabsContent value="value" className="space-y-2">
              <Label htmlFor="finalAmount">Valor Final</Label>
              <Input
                id="finalAmount"
                type="number"
                step="0.01"
                min="0"
                value={finalAmount}
                onChange={(e) => setFinalAmount(e.target.value)}
                placeholder="0.00"
              />
            </TabsContent>
            
            <TabsContent value="percent" className="space-y-2">
              <Label htmlFor="discountPercent">Desconto (%)</Label>
              <Input
                id="discountPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="0"
              />
            </TabsContent>
          </Tabs>

          {discountAmount > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">
                Desconto: R$ {discountAmount.toFixed(2)} ({parseFloat(discountPercent || '0').toFixed(2)}%)
              </p>
              <p className="text-lg font-bold text-green-900 mt-1">
                Valor Final: R$ {parseFloat(finalAmount || '0').toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={finalizeAppointmentMutation.isPending}
          >
            {finalizeAppointmentMutation.isPending ? 'Finalizando...' : 'Finalizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
