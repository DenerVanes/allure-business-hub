
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const stockInSchema = z.object({
  quantity: z.string().min(1, 'Quantidade é obrigatória'),
  unit_price: z.string().min(1, 'Preço unitário é obrigatório'),
  purchase_date: z.string().optional(),
  observation: z.string().optional(),
});

type StockInFormData = z.infer<typeof stockInSchema>;

interface StockInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

export function StockInModal({ open, onOpenChange, product }: StockInModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [totalPrice, setTotalPrice] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StockInFormData>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      purchase_date: new Date().toISOString().split('T')[0],
    },
  });

  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  useEffect(() => {
    if (quantity && unitPrice) {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(unitPrice.replace(',', '.')) || 0;
      setTotalPrice(qty * price);
    } else {
      setTotalPrice(0);
    }
  }, [quantity, unitPrice]);

  useEffect(() => {
    if (!open) {
      reset();
      setTotalPrice(0);
    }
  }, [open, reset]);

  const stockInMutation = useMutation({
    mutationFn: async (data: StockInFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      // REGRA: Usuário sempre digita em UNIDADES (frascos/caixas/unidades)
      const quantidadeComprada = parseFloat(data.quantity);
      const precoUnitario = parseFloat(data.unit_price.replace(',', '.'));
      const precoTotal = quantidadeComprada * precoUnitario;

      // Obter valores atuais do produto
      const estoqueUnidadesAtual = product.estoque_unidades || 0;
      const estoqueTotalAtual = product.estoque_total || product.quantity || 0;
      const precoMedioAtual = product.preco_medio_atual || product.cost_price || 0;

      // Calcular novo estoque em unidades
      const novoEstoqueUnidades = estoqueUnidadesAtual + quantidadeComprada;

      // Calcular novo estoque_total (ml/g/unidade)
      let novoEstoqueTotal = estoqueTotalAtual;
      if (product.unit === 'unidade' || !product.quantity_per_unit || product.quantity_per_unit === 0) {
        // Para unidades, somar diretamente
        novoEstoqueTotal = estoqueTotalAtual + quantidadeComprada;
      } else {
        // Para ml/g: somar (quantidade comprada × quantidade por unidade)
        novoEstoqueTotal = estoqueTotalAtual + (quantidadeComprada * product.quantity_per_unit);
      }

      // FÓRMULA CORRETA DE PREÇO MÉDIO:
      // preço_médio_novo = ((estoque_atual × preço_médio_atual) + (quantidade_nova × preço_novo)) ÷ (estoque_atual + quantidade_nova)
      let novoPrecoMedio = precoUnitario; // Default: preço da nova compra
      if (novoEstoqueUnidades > 0) {
        const valorTotalAtual = estoqueUnidadesAtual * precoMedioAtual;
        const valorTotalNovo = quantidadeComprada * precoUnitario;
        novoPrecoMedio = (valorTotalAtual + valorTotalNovo) / novoEstoqueUnidades;
      }

      // Atualizar produto
      const { error: productError } = await supabase
        .from('products')
        .update({
          estoque_unidades: novoEstoqueUnidades,
          estoque_total: novoEstoqueTotal,
          quantity: novoEstoqueTotal, // Manter compatibilidade com código antigo
          preco_medio_atual: novoPrecoMedio,
          cost_price: novoPrecoMedio, // Manter compatibilidade
        })
        .eq('id', product.id);

      if (productError) throw productError;

      // Criar registro no histórico de entradas
      const { error: entryError } = await supabase
        .from('stock_entries')
        .insert({
          product_id: product.id,
          user_id: user.id,
          quantidade_comprada: quantidadeComprada,
          preco_unitario: precoUnitario,
          preco_total: precoTotal,
          data_compra: data.purchase_date || new Date().toISOString().split('T')[0],
          observacao: data.observation || null,
          estoque_unidades_antes: estoqueUnidadesAtual,
          estoque_total_antes: estoqueTotalAtual,
          preco_medio_antes: precoMedioAtual,
          estoque_unidades_depois: novoEstoqueUnidades,
          estoque_total_depois: novoEstoqueTotal,
          preco_medio_depois: novoPrecoMedio,
          created_by: user.id,
        });

      if (entryError) {
        console.error('Erro ao criar histórico de entrada:', entryError);
        // Não bloquear a operação se falhar o histórico
      }

      // Criar transação financeira
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: precoTotal,
          description: `Compra de produto - ${product.name} (${quantidadeComprada} ${product?.unit === 'ml' ? 'frascos' : product?.unit === 'g' ? 'pacotes' : 'un'})`,
          category: 'Produtos',
          transaction_date: data.purchase_date || new Date().toISOString().split('T')[0],
          product_id: product.id,
          is_variable_cost: true,
        });

      if (transactionError) {
        console.error('Erro ao criar transação financeira:', transactionError);
        // Não bloquear a operação se falhar a transação
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Entrada registrada',
        description: 'Estoque atualizado com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao registrar entrada',
        description: error.message || 'Ocorreu um erro ao registrar a entrada de estoque.',
        variant: 'destructive',
      });
    },
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dar Entrada - {product.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => stockInMutation.mutate(data))} className="space-y-4">
          {/* Informações do produto (somente leitura) */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium text-gray-500">Marca:</span>
                <p className="text-gray-900">{product.brand || '-'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Unidade:</span>
                <p className="text-gray-900">
                  {product.unit === 'ml' ? 'Mililitros (ml)' : product.unit === 'g' ? 'Gramas (g)' : 'Unidade'}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Quantidade por unidade:</span>
                <p className="text-gray-900">
                  {product.quantity_per_unit ? `${product.quantity_per_unit} ${product.unit || ''}` : '1 un'}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Preço médio atual:</span>
                <p className="text-gray-900 font-semibold">
                  {product.preco_medio_atual || product.cost_price
                    ? `R$ ${(product.preco_medio_atual || product.cost_price).toFixed(2).replace('.', ',')}`
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Campos editáveis */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="quantity">
                Quantidade comprada (unidades) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="Ex: 2"
                {...register('quantity')}
              />
              {errors.quantity && (
                <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Quantidade de {product.unit === 'ml' ? 'frascos' : product.unit === 'g' ? 'pacotes' : 'unidades'} comprados
              </p>
            </div>

            <div>
              <Label htmlFor="unit_price">
                Preço unitário pago <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit_price"
                type="text"
                placeholder="Ex: 5,00"
                {...register('unit_price')}
              />
              {errors.unit_price && (
                <p className="text-sm text-red-500 mt-1">{errors.unit_price.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Preço pago por {product.unit === 'ml' ? 'frasco' : product.unit === 'g' ? 'pacote' : 'unidade'}</p>
            </div>

            {totalPrice > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Total: R$ {totalPrice.toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="purchase_date">Data da compra</Label>
              <Input
                id="purchase_date"
                type="date"
                {...register('purchase_date')}
              />
            </div>

            <div>
              <Label htmlFor="observation">Observação (opcional)</Label>
              <Input
                id="observation"
                placeholder="Ex: Compra no mercado X"
                {...register('observation')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={stockInMutation.isPending}>
              {stockInMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
