
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

      const quantityIn = parseInt(data.quantity);
      const unitPriceValue = parseFloat(data.unit_price.replace(',', '.'));
      const totalAmount = quantityIn * unitPriceValue;
      const newQuantity = product.quantity + quantityIn;

      // Atualizar quantidade do produto
      const { error: productError } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', product.id);

      if (productError) throw productError;

      // Criar transação financeira de despesa
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: totalAmount,
          description: `Compra de produto - ${product.name} (${quantityIn} un)`,
          category: 'Produtos',
          transaction_date: new Date().toISOString().split('T')[0],
        });

      if (transactionError) throw transactionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      toast({
        title: 'Entrada realizada',
        description: 'Produto adicionado ao estoque e despesa registrada com sucesso.',
      });
      reset();
      setTotalPrice(0);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível dar entrada no produto.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: StockInFormData) => {
    stockInMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Dar Entrada no Estoque</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{product?.name}</p>
            <p className="text-sm text-muted-foreground">
              Estoque atual: {product?.quantity}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="quantity">Quantidade a adicionar</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...register('quantity')}
                placeholder="Ex: 10"
              />
              {errors.quantity && (
                <p className="text-sm text-red-500">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="unit_price">Preço Unitário (R$)</Label>
              <Input
                id="unit_price"
                type="text"
                {...register('unit_price')}
                placeholder="0,00"
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d,]/g, '');
                  const parts = value.split(',');
                  if (parts.length > 2) {
                    value = parts[0] + ',' + parts.slice(1).join('');
                  }
                  e.target.value = value;
                  register('unit_price').onChange(e);
                }}
              />
              {errors.unit_price && (
                <p className="text-sm text-red-500">{errors.unit_price.message}</p>
              )}
            </div>

            {totalPrice > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Total:
                  </span>
                  <span className="text-lg font-bold text-green-800 dark:text-green-200">
                    R$ {totalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Esta despesa será registrada automaticamente
                </p>
              </div>
            )}

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
                disabled={stockInMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {stockInMutation.isPending ? 'Processando...' : 'Dar Entrada'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

