
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  brand: z.string().optional(),
  cost_price: z.string().optional(),
  quantity: z.string().min(1, 'Quantidade é obrigatória'),
  min_quantity: z.string().min(1, 'Quantidade mínima é obrigatória'),
  description: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface NewProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProductModal({ open, onOpenChange }: NewProductModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      const { error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: data.name,
          brand: data.brand || null,
          cost_price: data.cost_price ? parseFloat(data.cost_price) : null,
          quantity: parseInt(data.quantity),
          min_quantity: parseInt(data.min_quantity),
          description: data.description || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Produto cadastrado',
        description: 'Produto foi cadastrado com sucesso.',
      });
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível cadastrar o produto.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Produto</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Produto</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Shampoo Hidratante"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="brand">Marca</Label>
            <Input
              id="brand"
              {...register('brand')}
              placeholder="Ex: L'Oréal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                {...register('quantity')}
                placeholder="0"
              />
              {errors.quantity && (
                <p className="text-sm text-red-500">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="min_quantity">Qtd. Mínima</Label>
              <Input
                id="min_quantity"
                type="number"
                {...register('min_quantity')}
                placeholder="5"
              />
              {errors.min_quantity && (
                <p className="text-sm text-red-500">{errors.min_quantity.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cost_price">Preço de Custo</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              {...register('cost_price')}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrição do produto (opcional)"
              rows={3}
            />
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
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
