import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FinalizeAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
}

interface PaymentMethod {
  id: string;
  name: string;
  has_fee: boolean;
  fee_percentage: number;
}

interface PaymentRow {
  id: string;
  paymentMethodId: string;
  amount: string;
}

export const FinalizeAppointmentModal = ({ open, onOpenChange, appointment }: FinalizeAppointmentModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [finalAmount, setFinalAmount] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'value' | 'percent'>('value');
  const [paymentType, setPaymentType] = useState<'simple' | 'split'>('simple');
  const [simplePaymentMethodId, setSimplePaymentMethodId] = useState<string>('');
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: '1', paymentMethodId: '', amount: '' }
  ]);

  // Buscar métodos de pagamento do usuário
  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
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
      
      // Se não tiver métodos, criar padrões
      if (!data || data.length === 0) {
        const defaultMethods = [
          { user_id: user.id, name: 'Dinheiro', has_fee: false, fee_percentage: 0, display_order: 1, active: true },
          { user_id: user.id, name: 'Pix', has_fee: false, fee_percentage: 0, display_order: 2, active: true },
          { user_id: user.id, name: 'Débito', has_fee: true, fee_percentage: 1.5, display_order: 3, active: true },
          { user_id: user.id, name: 'Crédito', has_fee: true, fee_percentage: 2.5, display_order: 4, active: true },
        ];
        
        const { data: inserted, error: insertError } = await supabase
          .from('payment_methods')
          .insert(defaultMethods)
          .select();
        
        if (insertError) throw insertError;
        return inserted || [];
      }
      
      return data || [];
    },
    enabled: !!user?.id && open
  });

  // Buscar dados do colaborador para calcular comissão
  const { data: collaborator } = useQuery({
    queryKey: ['collaborator-commission', appointment?.collaborator_id],
    queryFn: async () => {
      if (!appointment?.collaborator_id) return null;
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('id, name, commission_model, commission_value, contract_type')
        .eq('id', appointment.collaborator_id)
        .single();
      
      if (error) {
        // Se não encontrar, retornar null (não é erro crítico)
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      return data;
    },
    enabled: !!appointment?.collaborator_id && open
  });

  // Calcular valor original
  const getOriginalAmount = () => {
    const servicePrice = appointment?.services?.price || appointment?.service_price || 0;
    return servicePrice > 0 ? servicePrice : (appointment?.total_amount || 0);
  };

  const originalAmount = getOriginalAmount();

  // Inicializar quando modal abrir
  useEffect(() => {
    if (open && appointment) {
      const amountToUse = appointment?.total_amount || originalAmount;
      setFinalAmount(amountToUse.toString());
      setDiscountPercent('');
      setActiveTab('value');
      setPaymentType('simple');
      setSimplePaymentMethodId('');
      setPaymentRows([{ id: '1', paymentMethodId: '', amount: '' }]);
      
      // Selecionar primeiro método de pagamento por padrão
      if (paymentMethods.length > 0) {
        setSimplePaymentMethodId(paymentMethods[0].id);
      }
    }
  }, [open, appointment, originalAmount, paymentMethods]);

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
        }
      } else {
        setFinalAmount(originalAmount.toString());
      }
    }
  }, [discountPercent, originalAmount, activeTab]);

  // Atualizar primeiro row quando mudar tipo de pagamento
  useEffect(() => {
    if (paymentType === 'split' && paymentRows.length === 1 && paymentRows[0].amount === '') {
      const newRows = [...paymentRows];
      if (paymentMethods.length > 0) {
        newRows[0].paymentMethodId = paymentMethods[0].id;
      }
      setPaymentRows(newRows);
    }
  }, [paymentType, paymentMethods]);

  // Calcular totais para pagamento combinado
  const splitTotals = useMemo(() => {
    const totalPaid = paymentRows.reduce((sum, row) => {
      const amount = parseFloat(row.amount) || 0;
      return sum + amount;
    }, 0);

    const totalFees = paymentRows.reduce((sum, row) => {
      const method = paymentMethods.find(m => m.id === row.paymentMethodId);
      if (!method || !method.has_fee) return sum;
      const amount = parseFloat(row.amount) || 0;
      const fee = amount * (method.fee_percentage / 100);
      return sum + fee;
    }, 0);

    const totalNet = totalPaid - totalFees;

    return { totalPaid, totalFees, totalNet };
  }, [paymentRows, paymentMethods]);

  // Calcular valores para pagamento simples
  const simplePayment = useMemo(() => {
    const method = paymentMethods.find(m => m.id === simplePaymentMethodId);
    const totalAmount = parseFloat(finalAmount) || 0;
    
    if (!method) {
      return { fee: 0, net: totalAmount };
    }

    const fee = method.has_fee ? totalAmount * (method.fee_percentage / 100) : 0;
    const net = totalAmount - fee;

    return { fee, net, method };
  }, [simplePaymentMethodId, finalAmount, paymentMethods]);

  // Calcular comissão do colaborador (baseado no valor bruto original, não no valor final)
  const collaboratorCommission = useMemo(() => {
    if (!collaborator || !collaborator.commission_model || !collaborator.commission_value) {
      return null;
    }

    // Comissão é calculada sobre o valor bruto original do serviço
    const grossValue = originalAmount;
    let commissionAmount = 0;

    if (collaborator.commission_model === 'percentage') {
      // Comissão percentual
      commissionAmount = grossValue * (Number(collaborator.commission_value) / 100);
    } else if (collaborator.commission_model === 'fixed') {
      // Comissão fixa
      commissionAmount = Number(collaborator.commission_value);
    }

    return {
      amount: commissionAmount,
      model: collaborator.commission_model,
      value: collaborator.commission_value,
      collaboratorName: collaborator.name
    };
  }, [collaborator, originalAmount]);

  // Adicionar nova linha de pagamento
  const addPaymentRow = () => {
    const newId = Date.now().toString();
    const defaultMethodId = paymentMethods.length > 0 ? paymentMethods[0].id : '';
    setPaymentRows([...paymentRows, { id: newId, paymentMethodId: defaultMethodId, amount: '' }]);
  };

  // Remover linha de pagamento
  const removePaymentRow = (id: string) => {
    if (paymentRows.length > 1) {
      setPaymentRows(paymentRows.filter(row => row.id !== id));
    }
  };

  // Atualizar linha de pagamento
  const updatePaymentRow = (id: string, field: 'paymentMethodId' | 'amount', value: string) => {
    setPaymentRows(paymentRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  // Validar pagamento combinado
  const validateSplitPayment = (): boolean => {
    const finalValue = parseFloat(finalAmount) || 0;
    const difference = Math.abs(splitTotals.totalPaid - finalValue);
    
    // Permitir diferença de até R$ 0.01 por questões de arredondamento
    return difference < 0.01;
  };

  const finalizeAppointmentMutation = useMutation({
    mutationFn: async () => {
      const finalValue = parseFloat(finalAmount) || originalAmount;
      
      // Validar pagamento combinado se necessário
      if (paymentType === 'split' && !validateSplitPayment()) {
        throw new Error('A soma dos valores pagos deve ser igual ao valor total do serviço.');
      }
      
      // Atualizar agendamento
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'finalizado',
          total_amount: finalValue
        })
        .eq('id', appointment.id);
      
      if (updateError) throw updateError;

      // A receita e a despesa de comissão são criadas automaticamente pelo trigger do banco
      // quando o status muda para 'finalizado'

      // Salvar pagamentos
      if (paymentType === 'simple') {
        // Pagamento simples
        const method = paymentMethods.find(m => m.id === simplePaymentMethodId);
        if (!method) {
          throw new Error('Método de pagamento não encontrado.');
        }

        const fee = method.has_fee ? finalValue * (method.fee_percentage / 100) : 0;
        const net = finalValue - fee;

        const { error: paymentError } = await supabase
          .from('appointment_payments')
          .insert({
            appointment_id: appointment.id,
            payment_method_id: simplePaymentMethodId,
            amount: finalValue,
            fee_amount: fee,
            net_amount: net
          });

        if (paymentError) throw paymentError;
      } else {
        // Pagamento combinado
        const paymentsToInsert = paymentRows
          .filter(row => row.paymentMethodId && row.amount)
          .map(row => {
            const method = paymentMethods.find(m => m.id === row.paymentMethodId);
            if (!method) return null;
            
            const amount = parseFloat(row.amount) || 0;
            const fee = method.has_fee ? amount * (method.fee_percentage / 100) : 0;
            const net = amount - fee;

            return {
              appointment_id: appointment.id,
              payment_method_id: row.paymentMethodId,
              amount,
              fee_amount: fee,
              net_amount: net
            };
          })
          .filter(p => p !== null);

        if (paymentsToInsert.length === 0) {
          throw new Error('Adicione pelo menos uma forma de pagamento.');
        }

        const { error: paymentError } = await supabase
          .from('appointment_payments')
          .insert(paymentsToInsert);

        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['coupon-details'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      
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

    if (paymentType === 'split') {
      if (!validateSplitPayment()) {
        toast({
          title: 'Valores inválidos',
          description: `A soma dos valores pagos (R$ ${splitTotals.totalPaid.toFixed(2)}) deve ser igual ao valor total (R$ ${finalValue.toFixed(2)}).`,
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (!simplePaymentMethodId) {
        toast({
          title: 'Forma de pagamento obrigatória',
          description: 'Por favor, selecione uma forma de pagamento.',
          variant: 'destructive',
        });
        return;
      }
    }

    finalizeAppointmentMutation.mutate();
  };

  const discountAmount = originalAmount - (parseFloat(finalAmount) || originalAmount);
  const finalValue = parseFloat(finalAmount) || originalAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Agendamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Informações do Cliente e Serviço */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <p className="text-sm font-medium">{appointment?.client_name}</p>
            </div>

            <div className="space-y-2">
              <Label>Serviço</Label>
              <p className="text-sm">{appointment?.services?.name}</p>
            </div>
          </div>

          <Separator />

          {/* Valor Original e Ajuste */}
          <div className="space-y-2">
            <Label>Valor Original</Label>
            <p className="text-lg font-semibold">R$ {originalAmount.toFixed(2).replace('.', ',')}</p>
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
                onWheel={(e) => e.currentTarget.blur()} // Prevenir mudança de valor ao fazer scroll
                placeholder="0,00"
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
                  let value = e.target.value.replace(/[^\d,.]/g, '');
                  value = value.replace(',', '.');
                  const parts = value.split('.');
                  if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                  }
                  if (parts[1] && parts[1].length > 2) {
                    value = parts[0] + '.' + parts[1].substring(0, 2);
                  }
                  const numValue = parseFloat(value) || 0;
                  if (numValue > 100) value = '100';
                  setDiscountPercent(value);
                }}
                placeholder="Digite a porcentagem"
              />
            </TabsContent>
          </Tabs>

          {discountAmount > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">
                Desconto: R$ {discountAmount.toFixed(2).replace('.', ',')}
              </p>
            </div>
          )}

          {/* Comissão do Colaborador */}
          {collaboratorCommission && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">
                Comissão {collaboratorCommission.collaboratorName}: R$ {collaboratorCommission.amount.toFixed(2).replace('.', ',')}
                {collaboratorCommission.model === 'percentage' && (
                  <span className="text-xs text-blue-600 ml-2">
                    ({collaboratorCommission.value}% sobre R$ {originalAmount.toFixed(2).replace('.', ',')})
                  </span>
                )}
              </p>
            </div>
          )}

          <Separator />

          {/* Forma de Pagamento */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentType} onValueChange={(value) => setPaymentType(value as 'simple' | 'split')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Pagamento Único</SelectItem>
                  <SelectItem value="split">Pagamento Combinado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === 'simple' ? (
              /* Pagamento Simples */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Método de Pagamento</Label>
                  <Select value={simplePaymentMethodId} onValueChange={setSimplePaymentMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                          {method.has_fee && ` (${method.fee_percentage}% taxa)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {simplePaymentMethodId && (
                  <Card className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Valor Total:</span>
                      <span className="font-medium">R$ {finalValue.toFixed(2).replace('.', ',')}</span>
                    </div>
                    {simplePayment.fee > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Taxa ({simplePayment.method?.fee_percentage}%):</span>
                        <span className="font-medium">- R$ {simplePayment.fee.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Valor Líquido Recebido:</span>
                      <span className="text-green-600">R$ {simplePayment.net.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              /* Pagamento Combinado */
              <div className="space-y-4">
                <div className="space-y-3">
                  {paymentRows.map((row, index) => (
                    <Card key={row.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="space-y-2">
                            <Label>Forma de Pagamento</Label>
                            <Select 
                              value={row.paymentMethodId} 
                              onValueChange={(value) => updatePaymentRow(row.id, 'paymentMethodId', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentMethods.map(method => (
                                  <SelectItem key={method.id} value={method.id}>
                                    {method.name}
                                    {method.has_fee && ` (${method.fee_percentage}% taxa)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Valor Pago</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.amount}
                              onChange={(e) => updatePaymentRow(row.id, 'amount', e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()} // Prevenir mudança de valor ao fazer scroll
                              placeholder="0,00"
                            />
                            {(() => {
                              const finalValue = parseFloat(finalAmount) || 0;
                              const remaining = finalValue - splitTotals.totalPaid;
                              // Mostrar apenas se houver valor faltando (diferença maior que 0.01)
                              if (remaining > 0.01) {
                                return (
                                  <p className="text-sm text-muted-foreground">
                                    Falta: R$ {remaining.toFixed(2).replace('.', ',')}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {row.paymentMethodId && row.amount && (() => {
                            const method = paymentMethods.find(m => m.id === row.paymentMethodId);
                            const amount = parseFloat(row.amount) || 0;
                            const fee = method?.has_fee ? amount * (method.fee_percentage / 100) : 0;
                            const net = amount - fee;

                            return (
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                  <span>Taxa:</span>
                                  <span className={cn(fee > 0 && "text-orange-600")}>
                                    R$ {fee.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Líquido:</span>
                                  <span className="text-green-600">
                                    R$ {net.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {paymentRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePaymentRow(row.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPaymentRow}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Outra Forma de Pagamento
                </Button>

                {/* Resumo do Pagamento Combinado */}
                <Card className="p-4 space-y-2 bg-muted/50">
                  <div className="flex justify-between text-sm">
                    <span>Total Pago:</span>
                    <span className="font-medium">R$ {splitTotals.totalPaid.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {splitTotals.totalFees > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Total de Taxas:</span>
                      <span className="font-medium">- R$ {splitTotals.totalFees.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Valor Líquido Recebido:</span>
                    <span className="text-green-600">R$ {splitTotals.totalNet.toFixed(2).replace('.', ',')}</span>
                  </div>

                  {/* Validação */}
                  {Math.abs(splitTotals.totalPaid - finalValue) >= 0.01 && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        A soma dos valores pagos (R$ {splitTotals.totalPaid.toFixed(2).replace('.', ',')}) 
                        deve ser igual ao valor total (R$ {finalValue.toFixed(2).replace('.', ',')}).
                      </AlertDescription>
                    </Alert>
                  )}
                </Card>
              </div>
            )}
          </div>
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
