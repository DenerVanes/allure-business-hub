import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Calendar, FileText, Tag, Sparkles } from 'lucide-react';
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
import type { Database } from '@/integrations/supabase/types';

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
  mode?: 'create' | 'edit';
  transaction?: Database['public']['Tables']['financial_transactions']['Row'] | null;
}

// Categorias automáticas de salão de beleza
const incomeCategories = [
  'Corte',
  'Escova',
  'Hidratação',
  'Botox',
  'Manicure',
  'Pedicure',
  'Depilação',
  'Sobrancelha',
  'Produtos',
  'Coloração',
  'Luzes',
  'Alisamento',
  'Tratamento Capilar',
  'Outros'
];

const defaultExpenseCategories = [
  'Produtos',
  'Aluguel',
  'Funcionária',
  'Reposição de Estoque',
  'Energia',
  'Água',
  'Internet',
  'Marketing',
  'Transporte',
  'Manutenção',
  'Equipamentos',
  'Outros'
];

export const FinanceModal = ({ open, onOpenChange, type, mode = 'create', transaction }: FinanceModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar categorias customizadas do localStorage
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id && open) {
      const stored = localStorage.getItem(`expense-categories-${user.id}`);
      setCustomExpenseCategories(stored ? JSON.parse(stored) : []);
    }
  }, [user?.id, open]);

  const expenseCategories = [...defaultExpenseCategories, ...customExpenseCategories];

  const form = useForm<FinanceFormData>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      amount: '',
      description: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && transaction) {
      form.reset({
        amount: Number(transaction.amount ?? 0).toFixed(2).replace('.', ','),
        description: transaction.description ?? '',
        category: transaction.category ?? '',
        date: transaction.transaction_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      });
    } else {
      form.reset({
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
  }, [open, mode, transaction, form]);

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
      queryClient.invalidateQueries({ queryKey: ['financial-transactions-all'] });
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

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: FinanceFormData) => {
      if (!user?.id || !transaction?.id) throw new Error('Transação não encontrada');

      const { error } = await supabase
        .from('financial_transactions')
        .update({
          amount: parseFloat(data.amount.replace(',', '.')),
          description: data.description,
          category: data.category,
          transaction_date: data.date,
          type,
        })
        .eq('id', transaction.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions-all'] });
      toast({
        title: 'Transação atualizada',
        description: 'Os dados da transação foram atualizados com sucesso.',
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a transação. Tente novamente.',
        variant: 'destructive',
      });
    }
  });

  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const isEditMode = mode === 'edit';
  const title = isEditMode
    ? type === 'income' ? 'Editar Receita' : 'Editar Despesa'
    : type === 'income' ? 'Registrar Receita' : 'Registrar Despesa';
  const buttonText = isEditMode
    ? 'Salvar alterações'
    : type === 'income' ? 'Registrar Receita' : 'Registrar Despesa';

  const isSubmitting = isEditMode ? updateTransactionMutation.isPending : createTransactionMutation.isPending;

  const onSubmit = (data: FinanceFormData) => {
    if (isEditMode) {
      updateTransactionMutation.mutate(data);
    } else {
      createTransactionMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
            <Sparkles className="h-5 w-5" style={{ color: type === 'income' ? '#EB67A3' : '#8E44EC' }} />
            {title}
          </DialogTitle>
          <DialogDescription className="text-[#5A4A5E]">
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
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor (R$)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
                        <Input 
                          placeholder="129,90" 
                          {...field}
                          className="pl-9 text-base"
                          style={{ borderRadius: '12px' }}
                          onChange={(e) => {
                            let value = e.target.value.replace(/[^\d,]/g, '');
                            field.onChange(value);
                          }}
                          value={field.value}
                        />
                      </div>
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
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        className="text-base"
                        style={{ borderRadius: '12px' }}
                      />
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
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descrição
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={`Ex: ${type === 'income' ? 'Corte + Escova para Maria' : 'Compra de produtos para estoque'}`}
                      {...field} 
                      className="text-base"
                      style={{ borderRadius: '12px' }}
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
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Categoria
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
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

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2 rounded-full px-6"
                style={{ 
                  backgroundColor: type === 'income' ? '#EB67A3' : '#8E44EC',
                  color: 'white'
                }}
              >
                {isSubmitting ? (
                  "Salvando..."
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
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
