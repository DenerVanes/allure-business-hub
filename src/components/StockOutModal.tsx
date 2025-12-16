
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
      // REGRA: Usuário sempre digita em UNIDADES (frascos/caixas/unidades)
      const quantityOutUnits = parseFloat(data.quantity);
      
      // Obter valores atuais usando os novos campos ou campos antigos (compatibilidade)
      const estoqueUnidadesAtual = product.estoque_unidades !== null && product.estoque_unidades !== undefined
        ? product.estoque_unidades
        : (product.quantity_per_unit && product.quantity_per_unit > 0 && product.unit !== 'unidade'
          ? (product.quantity || 0) / product.quantity_per_unit
          : product.quantity || 0);
      
      const estoqueTotalAtual = product.estoque_total !== null && product.estoque_total !== undefined
        ? product.estoque_total
        : product.quantity || 0;
      
      // Calcular novos valores
      const novoEstoqueUnidades = Math.max(0, estoqueUnidadesAtual - quantityOutUnits);
      
      // Calcular novo estoque_total (ml/g/unidade)
      let novoEstoqueTotal = 0;
      if (product.unit === 'unidade' || !product.quantity_per_unit || product.quantity_per_unit === 0) {
        // Para unidades, subtrair diretamente
        novoEstoqueTotal = novoEstoqueUnidades;
      } else {
        // Para ml/g: subtrair (quantidade em unidades × quantidade por unidade)
        novoEstoqueTotal = Math.max(0, estoqueTotalAtual - (quantityOutUnits * product.quantity_per_unit));
      }

      // Atualizar produto com os novos campos
      const { error } = await supabase
        .from('products')
        .update({ 
          estoque_unidades: novoEstoqueUnidades,
          estoque_total: novoEstoqueTotal,
          quantity: novoEstoqueTotal, // Manter compatibilidade
        })
        .eq('id', product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.refetchQueries({ queryKey: ['products'] });
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
    const quantityOutUnits = parseFloat(data.quantity);
    
    // Calcular estoque atual em unidades para validação usando os novos campos
    const estoqueUnidadesAtual = product.estoque_unidades !== null && product.estoque_unidades !== undefined
      ? product.estoque_unidades
      : (product.quantity_per_unit && product.quantity_per_unit > 0 && product.unit !== 'unidade'
        ? (product.quantity || 0) / product.quantity_per_unit
        : product.quantity || 0);
    
    if (quantityOutUnits > estoqueUnidadesAtual) {
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
              Estoque atual: {(() => {
                // Usar estoque_unidades se disponível, senão calcular
                const estoqueUnidades = product?.estoque_unidades !== null && product?.estoque_unidades !== undefined
                  ? product.estoque_unidades
                  : (product?.quantity_per_unit && product?.quantity_per_unit > 0 && product?.unit !== 'unidade'
                    ? Math.floor((product?.quantity || 0) / product.quantity_per_unit)
                    : product?.quantity || 0);
                
                const estoqueTotal = product?.estoque_total !== null && product?.estoque_total !== undefined
                  ? product.estoque_total
                  : product?.quantity || 0;
                
                if (product?.unit === 'unidade' || !product?.quantity_per_unit || product?.quantity_per_unit === 0) {
                  return `${estoqueUnidades} ${product?.unit === 'unidade' ? 'un' : product?.unit || ''}`;
                } else {
                  return `${Math.floor(estoqueUnidades)} ${product?.unit === 'ml' ? 'frascos' : 'pacotes'} (${estoqueTotal} ${product?.unit})`;
                }
              })()}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="quantity">
                Quantidade a remover ({product?.unit === 'unidade' ? 'unidades' : product?.unit === 'ml' ? 'frascos' : 'pacotes'})
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                {...register('quantity')}
                placeholder={product?.unit === 'ml' ? 'Ex: 1 frasco' : product?.unit === 'g' ? 'Ex: 1 pacote' : 'Ex: 5'}
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
