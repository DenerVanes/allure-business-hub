
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const financeSchema = z.object({
  amount: z.string().min(1, 'Valor é obrigatório'),
  description: z.string().min(2, 'Descrição deve ter pelo menos 2 caracteres'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  date: z.string().min(1, 'Data é obrigatória'),
});

type FinanceFormData = z.infer<typeof financeSchema>;

interface FinanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'income' | 'expense';
}

const incomeCategories = [
  'Serviços',
  'Produtos',
  'Outros'
];

const expenseCategories = [
  'Produtos',
  'Aluguel',
  'Energia',
  'Água',
  'Internet',
  'Marketing',
  'Transporte',
  'Outros'
];

export const FinanceModal = ({ open, onOpenChange, type }: FinanceModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FinanceFormData>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      amount: '',
      description: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: FinanceFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      const { error } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          type,
          amount: parseFloat(data.amount.replace(',', '.')),
          description: data.description,
          category: data.category,
          transaction_date: data.date,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      toast({
        title: `${type === 'income' ? 'Receita' : 'Despesa'} registrada!`,
        description: `A ${type === 'income' ? 'receita' : 'despesa'} foi registrada com sucesso.`,
      });
      form.reset({
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: `Não foi possível registrar a ${type === 'income' ? 'receita' : 'despesa'}. Tente novamente.`,
        variant: 'destructive',
      });
    }
  });

  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const title = type === 'income' ? 'Registrar Receita' : 'Registrar Despesa';
  const buttonText = type === 'income' ? 'Registrar Receita' : 'Registrar Despesa';

  const onSubmit = (data: FinanceFormData) => {
    createTransactionMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Registre uma nova {type === 'income' ? 'receita' : 'despesa'} para controle financeiro.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0,00" 
                        {...field}
                        onChange={(e) => {
                          // Formatação básica do valor
                          let value = e.target.value.replace(/[^\d,]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={`Descreva a ${type === 'income' ? 'receita' : 'despesa'}`} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createTransactionMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createTransactionMutation.isPending}
                className="gap-2"
              >
                {createTransactionMutation.isPending ? (
                  "Salvando..."
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    {buttonText}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
