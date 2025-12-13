import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface PaymentMethodFeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaymentMethod {
  id: string;
  name: string;
  has_fee: boolean;
  fee_percentage: number;
}

export const PaymentMethodFeesModal = ({ open, onOpenChange }: PaymentMethodFeesModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [fees, setFees] = useState<{ [key: string]: string }>({});

  // Buscar métodos de pagamento
  const { data: paymentMethods = [], isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('display_order');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open
  });

  // Inicializar valores quando modal abrir
  useEffect(() => {
    if (open && paymentMethods.length > 0) {
      const initialFees: { [key: string]: string } = {};
      paymentMethods.forEach(method => {
        if (method.has_fee) {
          initialFees[method.id] = method.fee_percentage.toString();
        } else {
          initialFees[method.id] = '';
        }
      });
      setFees(initialFees);
    }
  }, [open, paymentMethods]);

  // Filtrar apenas métodos que têm taxa (Débito e Crédito)
  const cardMethods = paymentMethods.filter(m => 
    m.has_fee && (m.name.toLowerCase().includes('débito') || m.name.toLowerCase().includes('crédito') || m.name.toLowerCase().includes('debito') || m.name.toLowerCase().includes('credito'))
  );

  const updateFeeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Atualizar cada método de pagamento
      const updates = cardMethods.map(method => {
        const feeString = fees[method.id] || '';
        const feeValue = parseFloat(feeString.replace(',', '.')) || 0;
        return supabase
          .from('payment_methods')
          .update({
            fee_percentage: feeValue,
            has_fee: feeValue > 0
          })
          .eq('id', method.id)
          .eq('user_id', user.id);
      });

      const results = await Promise.all(updates);
      
      // Verificar se houve algum erro
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      // Invalidar queries para atualizar em toda a aplicação
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast({
        title: 'Taxas atualizadas',
        description: 'As taxas de cartão foram salvas com sucesso. As novas taxas serão aplicadas na próxima finalização.',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar as taxas.',
        variant: 'destructive',
      });
    }
  });

  const handleSave = () => {
    // Validar valores
    for (const method of cardMethods) {
      const feeString = fees[method.id] || '';
      if (feeString.trim() === '') {
        toast({
          title: 'Campo obrigatório',
          description: `Por favor, informe a taxa de ${method.name}.`,
          variant: 'destructive',
        });
        return;
      }
      
      const feeValue = parseFloat(feeString.replace(',', '.'));
      if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
        toast({
          title: 'Valor inválido',
          description: `A taxa de ${method.name} deve estar entre 0% e 100%.`,
          variant: 'destructive',
        });
        return;
      }
    }

    updateFeeMutation.mutate();
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Taxas de Cartão</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            Carregando...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (cardMethods.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Taxas de Cartão</DialogTitle>
            <DialogDescription>
              Não foram encontrados métodos de pagamento com cartão configurados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: '#8E44EC' }} />
            Configurar Taxas de Cartão
          </DialogTitle>
          <DialogDescription>
            Configure as taxas que a maquininha cobra ao processar pagamentos com cartão.
            Essas taxas serão aplicadas automaticamente na finalização de serviços.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {cardMethods.map(method => (
            <Card key={method.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{method.name}</Label>
                  <span className="text-sm text-muted-foreground">Taxa atual: {method.fee_percentage}%</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`fee-${method.id}`}>Taxa (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`fee-${method.id}`}
                      type="text"
                      inputMode="decimal"
                      value={fees[method.id] || ''}
                      onChange={(e) => {
                        let value = e.target.value;
                        // Permitir apenas números, vírgula e ponto
                        value = value.replace(/[^\d,.]/g, '');
                        // Substituir vírgula por ponto para cálculo
                        value = value.replace(',', '.');
                        // Limitar a 2 casas decimais
                        const parts = value.split('.');
                        if (parts.length > 2) {
                          value = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (parts[1] && parts[1].length > 2) {
                          value = parts[0] + '.' + parts[1].substring(0, 2);
                        }
                        setFees({ ...fees, [method.id]: value });
                      }}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Dica:</strong> Essas taxas são aplicadas automaticamente quando você finaliza um serviço 
              e o cliente paga com cartão. Taxas de dinheiro e Pix continuam sendo 0%.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateFeeMutation.isPending}
            style={{ backgroundColor: '#8E44EC', color: 'white' }}
          >
            {updateFeeMutation.isPending ? 'Salvando...' : 'Salvar Taxas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

