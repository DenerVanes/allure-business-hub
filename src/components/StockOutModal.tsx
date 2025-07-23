
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

const stockOutSchema = z.object({
  quantity: z.string().min(1, 'Quantidade é obrigatória'),
});

type StockOutFormData = z.infer<typeof stockOutSchema>;

interface StockOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

export function StockOutModal({ open, onOpenChange, product }: StockOutModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockOutFormData>({
    resolver: zodResolver(stockOutSchema),
  });

  const stockOutMutation = useMutation({
    mutationFn: async (data: StockOutFormData) => {
      const quantityOut = parseInt(data.quantity);
      const newQuantity = Math.max(0, product.quantity - quantityOut);

      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Baixa realizada',
        description: 'Quantidade removida do estoque com sucesso.',
      });
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível dar baixa no produto.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: StockOutFormData) => {
    const quantityOut = parseInt(data.quantity);
    if (quantityOut > product.quantity) {
      toast({
        title: 'Erro',
        description: 'Quantidade não pode ser maior que o estoque atual.',
        variant: 'destructive',
      });
      return;
    }
    stockOutMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Dar Baixa no Estoque</DialogTitle>
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
              <Label htmlFor="quantity">Quantidade a remover</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={product?.quantity || 0}
                {...register('quantity')}
                placeholder="Ex: 5"
              />
              {errors.quantity && (
                <p className="text-sm text-red-500">{errors.quantity.message}</p>
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
                disabled={stockOutMutation.isPending}
                variant="destructive"
              >
                {stockOutMutation.isPending ? 'Processando...' : 'Dar Baixa'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
