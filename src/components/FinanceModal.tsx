import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Calendar, FileText, Tag, Sparkles, Plus, Trash2 } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

const financeSchema = z.object({
  amount: z.string().min(1, 'Valor é obrigatório'),
  description: z.string().optional(),
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

// Categorias padrão de receita
const defaultIncomeCategories = [
  'Serviços',
  'Produtos',
  'Consultoria',
  'Vendas',
  'Comissões',
  'Outros'
];

// Categorias padrão de despesa
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

  // Estados para formas de pagamento (apenas para receitas)
  const [paymentType, setPaymentType] = useState<'simple' | 'split'>('simple');
  const [simplePaymentMethodId, setSimplePaymentMethodId] = useState<string>('');
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: '1', paymentMethodId: '', amount: '' }
  ]);

  // Interface para categorias com tipo de custo
  interface CategoryInfo {
    name: string;
    costType: 'fixo' | 'variável' | null;
  }

  // Buscar categorias customizadas e excluídas do localStorage
  const [customExpenseCategories, setCustomExpenseCategories] = useState<(string | CategoryInfo)[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<(string | CategoryInfo)[]>([]);
  const [excludedExpenseCategories, setExcludedExpenseCategories] = useState<string[]>([]);
  const [excludedIncomeCategories, setExcludedIncomeCategories] = useState<string[]>([]);

  // Função auxiliar para migrar categorias de string[] para CategoryInfo[]
  const migrateCategoriesToInfo = (categories: (string | CategoryInfo)[]): CategoryInfo[] => {
    return categories.map(cat => typeof cat === 'string' ? { name: cat, costType: null } : cat);
  };

  // Função para obter o nome da categoria (para compatibilidade)
  const getCategoryName = (category: string | CategoryInfo): string => {
    return typeof category === 'string' ? category : category.name;
  };

  // Função para buscar o tipo de custo de uma categoria
  const getCategoryCostType = (categoryName: string): 'fixo' | 'variável' | null => {
    const customCategories = type === 'expense' ? customExpenseCategories : customIncomeCategories;
    const migrated = migrateCategoriesToInfo(customCategories);
    const found = migrated.find(cat => cat.name === categoryName);
    return found?.costType || null;
  };

  useEffect(() => {
    if (user?.id && open) {
      // Carregar categorias de despesa
      const storedExpense = localStorage.getItem(`expense-categories-${user.id}`);
      if (storedExpense) {
        try {
          const parsed = JSON.parse(storedExpense);
          setCustomExpenseCategories(parsed);
        } catch {
          setCustomExpenseCategories([]);
        }
      } else {
        setCustomExpenseCategories([]);
      }
      
      const storedExcludedExpense = localStorage.getItem(`excluded-expense-categories-${user.id}`);
      setExcludedExpenseCategories(storedExcludedExpense ? JSON.parse(storedExcludedExpense) : []);

      // Carregar categorias de receita
      const storedIncome = localStorage.getItem(`income-categories-${user.id}`);
      if (storedIncome) {
        try {
          const parsed = JSON.parse(storedIncome);
          setCustomIncomeCategories(parsed);
        } catch {
          setCustomIncomeCategories([]);
        }
      } else {
        setCustomIncomeCategories([]);
      }
      
      const storedExcludedIncome = localStorage.getItem(`excluded-income-categories-${user.id}`);
      setExcludedIncomeCategories(storedExcludedIncome ? JSON.parse(storedExcludedIncome) : []);
    }
  }, [user?.id, open, type]);

  // Buscar métodos de pagamento do usuário (apenas para receitas)
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
    enabled: !!user?.id && open && type === 'income'
  });

  // Filtrar categorias padrão removendo as excluídas e combinar com customizadas
  // Usar a mesma lógica do ManageExpenseCategoriesModal
  const visibleExpenseCategories = useMemo(() => {
    // Filtrar categorias padrão que não foram excluídas
    const visibleDefault = defaultExpenseCategories.filter(cat => !excludedExpenseCategories.includes(cat));
    // Categorias customizadas devem aparecer sempre (mesmo que o nome esteja na lista de excluídas como padrão)
    // porque se foram editadas, são customizadas agora
    const migrated = migrateCategoriesToInfo(customExpenseCategories);
    const visibleCustom = migrated.map(cat => cat.name);
    // Remover duplicatas caso uma categoria padrão e customizada tenham o mesmo nome
    const allVisible = [...visibleDefault, ...visibleCustom];
    const uniqueCategories = [...new Set(allVisible)];
    // Ordenar alfabeticamente
    return uniqueCategories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [excludedExpenseCategories, customExpenseCategories]);

  const visibleIncomeCategories = useMemo(() => {
    // Filtrar categorias padrão que não foram excluídas
    const visibleDefault = defaultIncomeCategories.filter(cat => !excludedIncomeCategories.includes(cat));
    // Categorias customizadas devem aparecer sempre
    const migrated = migrateCategoriesToInfo(customIncomeCategories);
    const visibleCustom = migrated.map(cat => cat.name);
    // Remover duplicatas
    const allVisible = [...visibleDefault, ...visibleCustom];
    const uniqueCategories = [...new Set(allVisible)];
    // Ordenar alfabeticamente
    return uniqueCategories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [excludedIncomeCategories, customIncomeCategories]);

  const form = useForm<FinanceFormData>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      amount: '',
      description: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  // Inicializar quando modal abrir
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && transaction) {
      form.reset({
        amount: Number(transaction.amount ?? 0).toFixed(2).replace('.', ','),
        description: transaction.description ?? '',
        category: transaction.category ?? '',
        date: transaction.transaction_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      });
      // Resetar formas de pagamento no modo edição (não implementado ainda)
      setPaymentType('simple');
      setSimplePaymentMethodId('');
      setPaymentRows([{ id: '1', paymentMethodId: '', amount: '' }]);
    } else {
      form.reset({
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
      });
      // Resetar formas de pagamento
      setPaymentType('simple');
      setSimplePaymentMethodId('');
      setPaymentRows([{ id: '1', paymentMethodId: '', amount: '' }]);
      
      // Selecionar primeiro método de pagamento por padrão (apenas para receitas)
      if (type === 'income' && paymentMethods.length > 0) {
        setSimplePaymentMethodId(paymentMethods[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, transaction?.id, type, paymentMethods.length]);

  // Calcular valores para pagamento simples
  const simplePayment = useMemo(() => {
    if (type !== 'income') return { fee: 0, net: 0, method: null };
    
    const method = paymentMethods.find(m => m.id === simplePaymentMethodId);
    const amountStr = form.watch('amount');
    const totalAmount = parseFloat(amountStr?.replace(',', '.') || '0') || 0;
    
    if (!method) {
      return { fee: 0, net: totalAmount, method: null };
    }

    const fee = method.has_fee ? totalAmount * (method.fee_percentage / 100) : 0;
    const net = totalAmount - fee;

    return { fee, net, method };
  }, [simplePaymentMethodId, form.watch('amount'), paymentMethods, type]);

  // Calcular totais para pagamento combinado
  const splitTotals = useMemo(() => {
    if (type !== 'income') return { totalPaid: 0, totalFees: 0, totalNet: 0 };

    const totalPaid = paymentRows.reduce((sum, row) => {
      const amount = parseFloat(row.amount.replace(',', '.') || '0') || 0;
      return sum + amount;
    }, 0);

    const totalFees = paymentRows.reduce((sum, row) => {
      const method = paymentMethods.find(m => m.id === row.paymentMethodId);
      if (!method || !method.has_fee) return sum;
      const amount = parseFloat(row.amount.replace(',', '.') || '0') || 0;
      const fee = amount * (method.fee_percentage / 100);
      return sum + fee;
    }, 0);

    const totalNet = totalPaid - totalFees;

    return { totalPaid, totalFees, totalNet };
  }, [paymentRows, paymentMethods, type]);

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
  const validateSplitPayment = (amount: number): boolean => {
    const difference = Math.abs(splitTotals.totalPaid - amount);
    // Permitir diferença de até R$ 0.01 por questões de arredondamento
    return difference < 0.01;
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data: FinanceFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      let amountToSave = parseFloat(data.amount.replace(',', '.'));
      
      // Para receitas, calcular valor líquido considerando taxas
      if (type === 'income') {
        if (paymentType === 'split') {
          // Validar pagamento combinado
          if (!validateSplitPayment(amountToSave)) {
            throw new Error(`A soma dos valores pagos (R$ ${splitTotals.totalPaid.toFixed(2)}) deve ser igual ao valor total (R$ ${amountToSave.toFixed(2)}).`);
          }
          // Salvar valor líquido (total - taxas)
          amountToSave = splitTotals.totalNet;
        } else {
          // Pagamento simples - salvar valor líquido
          if (!simplePaymentMethodId) {
            throw new Error('Por favor, selecione uma forma de pagamento.');
          }
          amountToSave = simplePayment.net;
        }
      }

      // Buscar tipo de custo da categoria (apenas para despesas)
      const costType = type === 'expense' ? getCategoryCostType(data.category) : null;
      const isVariableCost = costType === 'variável';
      const isFixedCost = costType === 'fixo';

      // Inserir transação financeira
      const { data: insertedTransaction, error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          type,
          amount: amountToSave,
          description: data.description || '',
          category: data.category,
          transaction_date: data.date,
          is_variable_cost: isVariableCost,
          is_fixed_cost: isFixedCost,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Salvar pagamentos se for receita
      if (type === 'income' && insertedTransaction) {
        if (paymentType === 'simple') {
          // Pagamento simples
          const method = paymentMethods.find(m => m.id === simplePaymentMethodId);
          if (method) {
            const amount = parseFloat(data.amount.replace(',', '.'));
            const fee = method.has_fee ? amount * (method.fee_percentage / 100) : 0;
            const net = amount - fee;

            const { error: paymentError } = await supabase
              .from('transaction_payments')
              .insert({
                transaction_id: insertedTransaction.id,
                payment_method_id: simplePaymentMethodId,
                amount: amount,
                fee_amount: fee,
                net_amount: net
              });

            if (paymentError) throw paymentError;
          }
        } else {
          // Pagamento combinado
          const paymentsToInsert = paymentRows
            .filter(row => row.paymentMethodId && row.amount)
            .map(row => {
              const method = paymentMethods.find(m => m.id === row.paymentMethodId);
              if (!method) return null;
              
              const amount = parseFloat(row.amount.replace(',', '.') || '0') || 0;
              const fee = method.has_fee ? amount * (method.fee_percentage / 100) : 0;
              const net = amount - fee;

              return {
                transaction_id: insertedTransaction.id,
                payment_method_id: row.paymentMethodId,
                amount,
                fee_amount: fee,
                net_amount: net
              };
            })
            .filter(p => p !== null);

          if (paymentsToInsert.length > 0) {
            const { error: paymentError } = await supabase
              .from('transaction_payments')
              .insert(paymentsToInsert);

            if (paymentError) throw paymentError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions-all'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-summary-comparison'] });
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
      // Resetar formas de pagamento
      setPaymentType('simple');
      setSimplePaymentMethodId('');
      setPaymentRows([{ id: '1', paymentMethodId: '', amount: '' }]);
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
          description: data.description || '',
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
      queryClient.invalidateQueries({ queryKey: ['payment-summary-comparison'] });
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

  const categories = type === 'income' ? visibleIncomeCategories : visibleExpenseCategories;
  const isEditMode = mode === 'edit';
  const title = isEditMode
    ? type === 'income' ? 'Editar Outras Receitas' : 'Editar Despesa'
    : type === 'income' ? 'Outras Receitas' : 'Registrar Despesa';
  const buttonText = isEditMode
    ? 'Salvar alterações'
    : type === 'income' ? 'Registrar Receita' : 'Registrar Despesa';

  const isSubmitting = isEditMode ? updateTransactionMutation.isPending : createTransactionMutation.isPending;

  const onSubmit = (data: FinanceFormData) => {
    // Validar formas de pagamento para receitas
    if (type === 'income' && !isEditMode) {
      const amount = parseFloat(data.amount.replace(',', '.'));
      
      if (paymentType === 'split') {
        if (!validateSplitPayment(amount)) {
          toast({
            title: 'Valores inválidos',
            description: `A soma dos valores pagos (R$ ${splitTotals.totalPaid.toFixed(2)}) deve ser igual ao valor total (R$ ${amount.toFixed(2)}).`,
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
    }
    
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
                          className="pl-9 text-base"
                          style={{ borderRadius: '12px' }}
                          onChange={(e) => {
                            let value = e.target.value.replace(/[^\d,]/g, '');
                            field.onChange(value);
                          }}
                          value={field.value || ''}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Categoria
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                    }} 
                    value={field.value || undefined}
                  >
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
                      {...field}
                      className="text-base"
                      style={{ borderRadius: '12px' }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Forma de Pagamento - Apenas para Receitas */}
            {type === 'income' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Forma de Pagamento</label>
                    <Select value={paymentType} onValueChange={(value) => setPaymentType(value as 'simple' | 'split')}>
                      <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
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
                        <label className="text-sm font-medium">Método de Pagamento</label>
                        <Select value={simplePaymentMethodId} onValueChange={setSimplePaymentMethodId}>
                          <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
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

                      {simplePaymentMethodId && form.watch('amount') && (
                        <Card className="p-4 space-y-2" style={{ borderRadius: '12px' }}>
                          <div className="flex justify-between text-sm">
                            <span>Valor Total:</span>
                            <span className="font-medium">
                              R$ {parseFloat(form.watch('amount')?.replace(',', '.') || '0').toFixed(2).replace('.', ',')}
                            </span>
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
                          <Card key={row.id} className="p-4" style={{ borderRadius: '12px' }}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1 space-y-3">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Forma de Pagamento</label>
                                  <Select 
                                    value={row.paymentMethodId} 
                                    onValueChange={(value) => updatePaymentRow(row.id, 'paymentMethodId', value)}
                                  >
                                    <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
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
                                  <label className="text-sm font-medium">Valor Pago</label>
                                  <Input
                                    type="text"
                                    value={row.amount}
                                    onChange={(e) => {
                                      let value = e.target.value.replace(/[^\d,]/g, '');
                                      updatePaymentRow(row.id, 'amount', value);
                                    }}
                                    placeholder="0,00"
                                    className="text-base"
                                    style={{ borderRadius: '12px' }}
                                  />
                                </div>

                                {row.paymentMethodId && row.amount && (() => {
                                  const method = paymentMethods.find(m => m.id === row.paymentMethodId);
                                  const amount = parseFloat(row.amount.replace(',', '.') || '0') || 0;
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
                                  className="h-8 w-8 p-0"
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
                        onClick={addPaymentRow}
                        className="w-full rounded-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Forma de Pagamento
                      </Button>

                      {form.watch('amount') && (
                        <Card className="p-4 space-y-2" style={{ borderRadius: '12px' }}>
                          <div className="flex justify-between text-sm">
                            <span>Valor Total:</span>
                            <span className="font-medium">
                              R$ {parseFloat(form.watch('amount')?.replace(',', '.') || '0').toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Total Pago:</span>
                            <span className="font-medium">R$ {splitTotals.totalPaid.toFixed(2).replace('.', ',')}</span>
                          </div>
                          {splitTotals.totalFees > 0 && (
                            <div className="flex justify-between text-sm text-orange-600">
                              <span>Total Taxas:</span>
                              <span className="font-medium">- R$ {splitTotals.totalFees.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between text-lg font-bold">
                            <span>Valor Líquido Recebido:</span>
                            <span className="text-green-600">R$ {splitTotals.totalNet.toFixed(2).replace('.', ',')}</span>
                          </div>
                          {!validateSplitPayment(parseFloat(form.watch('amount')?.replace(',', '.') || '0')) && (
                            <p className="text-xs text-red-600 mt-2">
                              A soma dos valores pagos deve ser igual ao valor total.
                            </p>
                          )}
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

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
