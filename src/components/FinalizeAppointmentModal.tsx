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

  // Calcular valor original baseado no preço do serviço ou total_amount
  // Se o serviço tiver preço cadastrado, usa ele; senão usa o total_amount
  const getOriginalAmount = () => {
    const servicePrice = appointment?.services?.price || appointment?.service_price || 0;
    return servicePrice > 0 ? servicePrice : (appointment?.total_amount || 0);
  };

  const originalAmount = getOriginalAmount();

  useEffect(() => {
    if (open && appointment) {
      // Recalcular originalAmount quando o modal abrir, pois o appointment pode ter sido atualizado
      const currentOriginalAmount = getOriginalAmount();
      setFinalAmount(currentOriginalAmount.toString());
      setDiscountPercent('');
      setActiveTab('value');
    }
  }, [open, appointment]);

  // Limpar campo de desconto quando mudar para a aba de desconto
  useEffect(() => {
    if (activeTab === 'percent') {
      setDiscountPercent('');
    }
  }, [activeTab]);

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
    if (activeTab === 'percent') {
      if (discountPercent && discountPercent.trim() !== '') {
        const percent = parseFloat(discountPercent.replace(',', '.')) || 0;
        if (percent > 0 && percent <= 100) {
          const final = originalAmount - (originalAmount * percent / 100);
          setFinalAmount(final.toFixed(2));
        } else if (percent > 100) {
          // Se passar de 100%, limpar e mostrar erro
          setDiscountPercent('');
          setFinalAmount(originalAmount.toString());
        }
      } else {
        // Resetar valor final para o original quando o campo de desconto está vazio
        setFinalAmount(originalAmount.toString());
      }
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
                type="text"
                inputMode="numeric"
                value={discountPercent}
                onChange={(e) => {
                  // Remove tudo que não é número ou vírgula/ponto
                  let value = e.target.value.replace(/[^\d,.]/g, '');
                  
                  // Substitui vírgula por ponto para cálculo
                  value = value.replace(',', '.');
                  
                  // Limita a 2 casas decimais
                  const parts = value.split('.');
                  if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                  }
                  if (parts[1] && parts[1].length > 2) {
                    value = parts[0] + '.' + parts[1].substring(0, 2);
                  }
                  
                  // Limita a 100%
                  const numValue = parseFloat(value) || 0;
                  if (numValue > 100) {
                    value = '100';
                  }
                  
                  setDiscountPercent(value);
                }}
                placeholder="Digite a porcentagem"
                autoFocus
              />
              {discountPercent && (
                <p className="text-xs text-muted-foreground">
                  {parseFloat(discountPercent.replace(',', '.')) || 0}% de desconto
                </p>
              )}
            </TabsContent>
          </Tabs>

          {discountAmount > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">
                Desconto: R$ {discountAmount.toFixed(2)} ({parseFloat((discountPercent || '0').replace(',', '.')).toFixed(2)}%)
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
