import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Edit, 
  Trash2,
  Calendar,
  Sparkles,
  Target,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Download,
  Scissors,
  Sparkle,
  FolderOpen,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FinanceModal } from '@/components/FinanceModal';
import { ManageExpenseCategoriesModal } from '@/components/ManageExpenseCategoriesModal';
import TransactionsModal from '@/components/TransactionsModal';
import { PaymentMethodFeesModal } from '@/components/PaymentMethodFeesModal';
import { AppointmentDetailsViewModal } from '@/components/AppointmentDetailsViewModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, isThisMonth, isSameMonth, startOfDay, endOfDay } from 'date-fns';
import { formatTransactionDate, getBrazilianDate } from '@/utils/timezone';
import type { Database } from '@/integrations/supabase/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];

const Financeiro = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeModalType, setFinanceModalType] = useState<'income' | 'expense'>('income');
  const [dateFilter, setDateFilter] = useState('month');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [transactionsModalType, setTransactionsModalType] = useState<'income' | 'expense' | 'all'>('all');
  const [showPaymentFeesModal, setShowPaymentFeesModal] = useState(false);
  const [showAppointmentDetailsModal, setShowAppointmentDetailsModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const getDateRange = (filter: string) => {
    const now = getBrazilianDate();
    switch (filter) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: format(yesterday, 'yyyy-MM-dd'), end: format(yesterday, 'yyyy-MM-dd') };
      case 'week':
        return { start: format(startOfWeek(now), 'yyyy-MM-dd'), end: format(endOfWeek(now), 'yyyy-MM-dd') };
      case 'lastWeek':
        const lastWeek = subWeeks(now, 1);
        return { start: format(startOfWeek(lastWeek), 'yyyy-MM-dd'), end: format(endOfWeek(lastWeek), 'yyyy-MM-dd') };
      case 'month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), end: format(endOfMonth(lastMonth), 'yyyy-MM-dd') };
      case 'lastYear':
        const lastYear = subYears(now, 1);
        return { start: format(startOfYear(lastYear), 'yyyy-MM-dd'), end: format(endOfYear(lastYear), 'yyyy-MM-dd') };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: customEndDate };
        }
        // Fallback para hoje se não tiver datas customizadas
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      default:
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
  };

  // Buscar todas as transações para cálculos de métricas
  const { data: allTransactions = [] } = useQuery<TransactionRow[]>({
    queryKey: ['financial-transactions-all', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Buscar transações filtradas
  const { data: transactions = [], isLoading } = useQuery<TransactionRow[]>({
    queryKey: ['financial-transactions', user?.id, dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { start, end } = getDateRange(dateFilter);
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          appointments!left (
            client_name,
            client_id,
            collaborator_id,
            services (
              name,
              service_categories (name)
            ),
            collaborators (
              name
            )
          ),
          products!left (
            name,
            category
          )
        `)
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Buscar clientes para cálculo de ticket médio
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Função auxiliar para agrupar pagamentos por método
  const groupPaymentsByMethod = (payments: any[]) => {
    return payments.reduce((acc: any, payment: any) => {
      const methodName = payment.payment_methods?.name || 'Não informado';
      const methodId = payment.payment_methods?.id || 'unknown';
      
      if (!acc[methodId]) {
        acc[methodId] = {
          method_id: methodId,
          method_name: methodName,
          has_fee: payment.payment_methods?.has_fee || false,
          total_amount: 0,
          total_fees: 0,
          total_net: 0,
          count: 0
        };
      }
      
      acc[methodId].total_amount += Number(payment.amount) || 0;
      acc[methodId].total_fees += Number(payment.fee_amount) || 0;
      acc[methodId].total_net += Number(payment.net_amount) || 0;
      acc[methodId].count += 1;
      
      return acc;
    }, {});
  };

  // Buscar pagamentos agrupados por método de pagamento no período atual e anterior
  const { data: paymentSummary = [] } = useQuery({
    queryKey: ['payment-summary-comparison', user?.id, dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let { start, end } = getDateRange(dateFilter);
      
      // Se o filtro for "month", ajustar o período atual para ir apenas até hoje (não até o fim do mês)
      if (dateFilter === 'month') {
        const now = getBrazilianDate();
        const today = format(now, 'yyyy-MM-dd');
        // Se hoje for antes do fim do mês, usar hoje como fim do período
        if (today < end) {
          end = today;
        }
      }
      
      // Buscar agendamentos do período atual
      const { data: appointmentsInPeriod, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id')
        .eq('user_id', user.id)
        .gte('appointment_date', start)
        .lte('appointment_date', end)
        .eq('status', 'finalizado');
      
      if (appointmentsError) throw appointmentsError;
      
      const appointmentIds = (appointmentsInPeriod || []).map(a => a.id);
      
      // Buscar pagamentos do período atual (de agendamentos)
      let currentAppointmentPayments: any[] = [];
      if (appointmentIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('appointment_payments')
          .select(`
            *,
            payment_methods (
              id,
              name,
              has_fee
            )
          `)
          .in('appointment_id', appointmentIds);
        
        if (paymentsError) throw paymentsError;
        currentAppointmentPayments = payments || [];
      }

      // Buscar pagamentos do período atual (de receitas manuais)
      const { data: transactionsInPeriod, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('transaction_date', start)
        .lte('transaction_date', end);
      
      if (transactionsError) throw transactionsError;
      
      let currentTransactionPayments: any[] = [];
      const transactionIds = (transactionsInPeriod || []).map(t => t.id);
      if (transactionIds.length > 0) {
        const { data: transactionPayments, error: transactionPaymentsError } = await supabase
          .from('transaction_payments')
          .select(`
            *,
            payment_methods (
              id,
              name,
              has_fee
            )
          `)
          .in('transaction_id', transactionIds);
        
        if (transactionPaymentsError) throw transactionPaymentsError;
        currentTransactionPayments = transactionPayments || [];
      }

      // Combinar pagamentos de agendamentos e receitas manuais
      const currentPayments = [...currentAppointmentPayments, ...currentTransactionPayments];
      
      // Calcular período equivalente do mês anterior
      // Se o filtro for "month", comparar primeiros N dias do mês atual com primeiros N dias do mês anterior
      let previousStart: string;
      let previousEnd: string;
      
      if (dateFilter === 'month') {
        const now = getBrazilianDate();
        const endDateObj = new Date(end + 'T00:00:00');
        const currentDay = endDateObj.getDate(); // Dia atual do período (ex: 13)
        
        // Período atual: do dia 1 até o dia atual do mês atual
        // Período anterior: do dia 1 até o mesmo dia do mês anterior (ou último dia se o mês anterior tiver menos dias)
        const previousMonthDate = subMonths(endDateObj, 1);
        const previousMonthStart = startOfMonth(previousMonthDate);
        const previousMonthEnd = endOfMonth(previousMonthDate);
        
        // Se o dia atual for maior que os dias do mês anterior, usar o último dia do mês anterior
        const daysInPreviousMonth = previousMonthEnd.getDate();
        const comparisonDay = Math.min(currentDay, daysInPreviousMonth);
        
        previousStart = format(previousMonthStart, 'yyyy-MM-dd');
        // Criar data do dia de comparação do mês anterior
        const previousEndDate = new Date(previousMonthDate);
        previousEndDate.setDate(comparisonDay);
        previousEnd = format(previousEndDate, 'yyyy-MM-dd');
      } else {
        // Para outros filtros, usar lógica de subtração de dias
        const endDate = new Date(end + 'T23:59:59');
        const startDate = new Date(start + 'T00:00:00');
        const daysInCurrentPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        const previousStartDate = subDays(startDate, daysInCurrentPeriod);
        const previousEndDate = subDays(endDate, daysInCurrentPeriod);
        
        previousStart = format(previousStartDate, 'yyyy-MM-dd');
        previousEnd = format(previousEndDate, 'yyyy-MM-dd');
      }
      
      // Buscar agendamentos do período anterior
      const { data: appointmentsPrevious, error: appointmentsPreviousError } = await supabase
        .from('appointments')
        .select('id')
        .eq('user_id', user.id)
        .gte('appointment_date', previousStart)
        .lte('appointment_date', previousEnd)
        .eq('status', 'finalizado');
      
      if (appointmentsPreviousError) throw appointmentsPreviousError;
      
      const previousAppointmentIds = (appointmentsPrevious || []).map(a => a.id);
      
      // Buscar pagamentos do período anterior (de agendamentos)
      let previousAppointmentPayments: any[] = [];
      if (previousAppointmentIds.length > 0) {
        const { data: previousPaymentsData, error: previousPaymentsError } = await supabase
          .from('appointment_payments')
          .select(`
            *,
            payment_methods (
              id,
              name,
              has_fee
            )
          `)
          .in('appointment_id', previousAppointmentIds);
        
        if (previousPaymentsError) throw previousPaymentsError;
        previousAppointmentPayments = previousPaymentsData || [];
      }

      // Buscar pagamentos do período anterior (de receitas manuais)
      const { data: transactionsPreviousPeriod, error: transactionsPreviousError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('transaction_date', previousStart)
        .lte('transaction_date', previousEnd);
      
      if (transactionsPreviousError) throw transactionsPreviousError;
      
      let previousTransactionPayments: any[] = [];
      const previousTransactionIds = (transactionsPreviousPeriod || []).map(t => t.id);
      if (previousTransactionIds.length > 0) {
        const { data: previousTransactionPaymentsData, error: previousTransactionPaymentsError } = await supabase
          .from('transaction_payments')
          .select(`
            *,
            payment_methods (
              id,
              name,
              has_fee
            )
          `)
          .in('transaction_id', previousTransactionIds);
        
        if (previousTransactionPaymentsError) throw previousTransactionPaymentsError;
        previousTransactionPayments = previousTransactionPaymentsData || [];
      }

      // Combinar pagamentos anteriores de agendamentos e receitas manuais
      const previousPayments = [...previousAppointmentPayments, ...previousTransactionPayments];
      
      // Agrupar pagamentos atuais
      const currentGrouped = groupPaymentsByMethod(currentPayments);
      
      // Agrupar pagamentos anteriores
      const previousGrouped = groupPaymentsByMethod(previousPayments);
      
      // Combinar dados com comparação
      const allMethodIds = new Set([
        ...Object.keys(currentGrouped),
        ...Object.keys(previousGrouped)
      ]);
      
      const result = Array.from(allMethodIds).map(methodId => {
        const current = currentGrouped[methodId] || {
          total_amount: 0,
          total_fees: 0,
          total_net: 0,
          count: 0
        };
        const previous = previousGrouped[methodId] || {
          total_amount: 0,
          total_fees: 0,
          total_net: 0,
          count: 0
        };
        
        const currentAmount = current.total_amount || 0;
        const previousAmount = previous.total_amount || 0;
        
        // Calcular variação percentual
        let percentageChange = 0;
        if (currentAmount === previousAmount) {
          // Valores iguais = 0% de variação
          percentageChange = 0;
        } else if (previousAmount > 0) {
          percentageChange = ((currentAmount - previousAmount) / previousAmount) * 100;
        } else if (currentAmount > 0) {
          percentageChange = 100; // 100% de aumento quando não havia valor anterior
        }
        
        return {
          method_id: methodId,
          method_name: current.method_name || previous.method_name || 'Não informado',
          has_fee: current.has_fee || previous.has_fee || false,
          total_amount: currentAmount,
          total_fees: current.total_fees || 0,
          total_net: current.total_net || 0,
          count: current.count || 0,
          previous_amount: previousAmount,
          percentage_change: percentageChange
        };
      });
      
      return result;
    },
    enabled: !!user?.id
  });

  // Buscar agendamentos finalizados do período selecionado para cálculo correto do ticket médio
  const { data: finalizedAppointments = [] } = useQuery({
    queryKey: ['finalized-appointments', user?.id, dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      const { start, end } = getDateRange(dateFilter);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients (id, name)')
        .eq('user_id', user.id)
        .eq('status', 'finalizado')
        .gte('appointment_date', start)
        .lte('appointment_date', end);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Cálculos
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;

  // Nota: Removido cálculos de comparação com mês anterior, pois agora tudo reflete o período filtrado

  // Clientes atendidos no período selecionado (apenas receitas)
  const uniqueClientsInPeriod = useMemo(() => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const clientSet = new Set<string>();
    
    incomeTransactions.forEach(t => {
      const appointment = (t as any).appointments;
      
      // Prioridade 1: Tentar pegar client_id do appointment (mais confiável)
      if (appointment && appointment.client_id) {
        clientSet.add(`client_${appointment.client_id}`);
      }
      // Prioridade 2: Se não tiver appointment_id mas tiver client_name na descrição
      else if (t.description) {
        // Extrair nome do cliente da descrição (formato: "Agendamento finalizado - Cliente: Nome")
        const clientNameMatch = t.description.match(/Cliente:\s*([^-\n]+?)(?:\s*-|$)/i);
        if (clientNameMatch && clientNameMatch[1]) {
          // Normalizar o nome (remover espaços extras, converter para minúsculas)
          const normalizedName = clientNameMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
          if (normalizedName.length > 0) {
            clientSet.add(`name_${normalizedName}`);
          }
        }
      }
    });
    
    return clientSet.size;
  }, [transactions]);

  // Ticket médio - calcular baseado nas transações de receita do período selecionado
  const incomeTransactionsInPeriod = useMemo(() => {
    return transactions.filter(t => t.type === 'income');
  }, [transactions]);
  
  const totalIncomeInPeriod = useMemo(() => {
    return incomeTransactionsInPeriod.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [incomeTransactionsInPeriod]);
  
  const averageTicket = useMemo(() => {
    return uniqueClientsInPeriod > 0 
      ? totalIncomeInPeriod / uniqueClientsInPeriod 
      : 0;
  }, [uniqueClientsInPeriod, totalIncomeInPeriod]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    const incomeByCategory = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => {
        // Usar categoria real do serviço se disponível, senão usar a categoria da transação
        const appointment = (t as any).appointments;
        const serviceCategory = appointment?.services?.service_categories?.name;
        const category = serviceCategory || t.category;
        
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const expenseByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    // Calcular porcentagens para o gráfico de pizza
    const total = totalIncome + totalExpense;
    const incomePercentage = total > 0 ? (totalIncome / total) * 100 : 0;
    const expensePercentage = total > 0 ? (totalExpense / total) * 100 : 0;

    // Calcular porcentagens para receitas por categoria
    const incomeByCategoryWithPercentage = Object.entries(incomeByCategory).map(([name, value]) => {
      const percentage = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
      return { name, value, percentage };
    });

    return {
      pie: [
        { 
          name: 'Receitas', 
          value: totalIncome, 
          percentage: incomePercentage,
          fill: '#C9A7FD' 
        },
        { 
          name: 'Despesas', 
          value: totalExpense, 
          percentage: expensePercentage,
          fill: '#EB67A3' 
        },
      ],
      incomeByCategory: incomeByCategoryWithPercentage,
      expenseByCategory: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })),
    };
  }, [transactions, totalIncome, totalExpense]);

  const handleOpenModal = (type: 'income' | 'expense') => {
    setModalMode('create');
    setSelectedTransaction(null);
    setFinanceModalType(type);
    setShowFinanceModal(true);
  };

  const handleEditTransaction = (transaction: TransactionRow) => {
    setModalMode('edit');
    setSelectedTransaction(transaction);
    setFinanceModalType(transaction.type as 'income' | 'expense');
    setShowFinanceModal(true);
  };

  const handleModalChange = (open: boolean) => {
    setShowFinanceModal(open);
    if (!open) {
      setSelectedTransaction(null);
      setModalMode('create');
    }
  };

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions-all'] });
      toast({
        title: 'Transação removida',
        description: 'A transação foi excluída com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a transação.',
        variant: 'destructive',
      });
    }
  });

  const handleDeleteTransaction = (transaction: TransactionRow) => {
    if (window.confirm('Deseja realmente excluir esta transação?')) {
      deleteTransactionMutation.mutate(transaction.id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A7FD] mx-auto mb-4"></div>
          <p className="text-[#5A4A5E]">Carregando transações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" style={{ backgroundColor: '#FCFCFD' }}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-[#5A2E98]">Financeiro</h1>
        <p className="text-[#5A4A5E] text-lg">Gerencie suas receitas e despesas com facilidade</p>
      </div>

      {/* Action Bar - Botões Fixos */}
      <div className="flex items-center gap-3 sticky top-4 z-10 bg-[#FCFCFD]/95 backdrop-blur-sm py-2">
        <Button 
          onClick={() => handleOpenModal('income')}
          className="rounded-full px-6 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
          style={{ 
            backgroundColor: '#EB67A3',
            color: 'white'
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nova Receita
        </Button>
        <Button 
          onClick={() => handleOpenModal('expense')}
          className="rounded-full px-6 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
          style={{ 
            backgroundColor: '#8E44EC',
            color: 'white'
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nova Despesa
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[#5A4A5E]">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Período:</span>
            </div>
            <Select value={dateFilter} onValueChange={(value) => {
              setDateFilter(value);
              // Resetar datas customizadas se mudar para outro filtro
              if (value !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}>
              <SelectTrigger className="w-[200px] border-[#F7D5E8] focus:border-[#C9A7FD]" style={{ borderRadius: '12px' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="lastWeek">Semana passada</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="lastMonth">Mês passado</SelectItem>
                <SelectItem value="lastYear">Ano passado</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                  style={{ borderRadius: '12px' }}
                />
                <span className="text-sm text-[#5A4A5E]">até</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                  style={{ borderRadius: '12px' }}
                />
              </div>
            )}
            {user?.email === 'dennervanes@hotmail.com' && (
              <Button
                onClick={() => setShowManageCategories(true)}
                variant="outline"
                className="rounded-full"
                style={{ borderColor: '#F7D5E8' }}
              >
                <FolderOpen className="h-4 w-4 mr-2" style={{ color: '#8E44EC' }} />
                Gerenciar Categorias
              </Button>
            )}
            <Button
              onClick={() => setShowPaymentFeesModal(true)}
              variant="outline"
              className="rounded-full"
              style={{ borderColor: '#F7D5E8' }}
            >
              <CreditCard className="h-4 w-4 mr-2" style={{ color: '#8E44EC' }} />
              Taxas de Cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Receitas */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <TrendingUp className="h-6 w-6" style={{ color: '#C9A7FD' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
              >
                Receitas
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Total de Receitas</p>
              <p className="text-3xl font-bold" style={{ color: '#8E44EC' }}>
                {formatCurrency(totalIncome)}
              </p>
            </div>
            {/* Mini gráfico sparkline placeholder */}
            <div className="mt-4 h-12 flex items-end gap-1">
              {[65, 45, 80, 60, 90, 70, 85].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${height}%`,
                    backgroundColor: '#C9A7FD',
                    opacity: 0.6
                  }}
                />
              ))}
            </div>
            <Button
              onClick={() => {
                setTransactionsModalType('income');
                setShowTransactionsModal(true);
              }}
              variant="outline"
              className="w-full mt-4 rounded-full"
              style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
            >
              Ver tudo
            </Button>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <TrendingDown className="h-6 w-6" style={{ color: '#EB67A3' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#EB67A3' }}
              >
                Despesas
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Total de Despesas</p>
              <p className="text-3xl font-bold" style={{ color: '#EB67A3' }}>
                {formatCurrency(totalExpense)}
              </p>
            </div>
            {/* Mini gráfico sparkline placeholder */}
            <div className="mt-4 h-12 flex items-end gap-1">
              {[50, 60, 45, 70, 55, 65, 50].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${height}%`,
                    backgroundColor: '#EB67A3',
                    opacity: 0.6
                  }}
                />
              ))}
            </div>
            <Button
              onClick={() => {
                setTransactionsModalType('expense');
                setShowTransactionsModal(true);
              }}
              variant="outline"
              className="w-full mt-4 rounded-full"
              style={{ borderColor: '#F7D5E8', color: '#EB67A3' }}
            >
              Ver tudo
            </Button>
          </CardContent>
        </Card>

        {/* Saldo */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <DollarSign className="h-6 w-6" style={{ color: '#8E44EC' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: balance >= 0 ? '#F7D5E8' : '#F7D5E8', color: balance >= 0 ? '#8E44EC' : '#EB67A3' }}
              >
                Saldo
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Saldo Atual</p>
              <p 
                className="text-3xl font-bold"
                style={{ color: balance >= 0 ? '#8E44EC' : '#EB67A3' }}
              >
                {formatCurrency(balance)}
              </p>
            </div>
            {/* Mini gráfico sparkline placeholder */}
            <div className="mt-4 h-12 flex items-end gap-1">
              {[40, 50, 45, 60, 55, 70, 65].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${height}%`,
                    backgroundColor: balance >= 0 ? '#C9A7FD' : '#EB67A3',
                    opacity: 0.6
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Formas de Pagamento */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>Formas de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto pb-2">
            {/* Dinheiro */}
            {(() => {
              const dinheiroData = paymentSummary.find((p: any) => p.method_name?.toLowerCase() === 'dinheiro');
              const total = dinheiroData?.total_amount || 0;
              return (
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: '15px', backgroundColor: '#F0FDF4' }}
                  onClick={() => {
                    setTransactionsModalType('all');
                    setShowTransactionsModal(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#86EFAC' }}>
                        <Banknote className="h-5 w-5" style={{ color: '#16A34A' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Dinheiro</p>
                    <p className="text-xl font-bold" style={{ color: '#16A34A' }}>
                      {formatCurrency(total)}
                    </p>
                    {(() => {
                      const percentageChange = dinheiroData?.percentage_change || 0;
                      const previousAmount = dinheiroData?.previous_amount || 0;
                      // Mostrar se houver comparação (valores anteriores ou atuais > 0) ou se for 0% (valores iguais)
                      if (previousAmount > 0 || dinheiroData?.total_amount > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-2">
                            {percentageChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3" style={{ color: '#16A34A' }} />
                            ) : percentageChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3" style={{ color: '#DC2626' }} />
                            ) : (
                              <span className="h-3 w-3" /> // Espaçador quando for 0%
                            )}
                            <span 
                              className="text-xs font-medium"
                              style={{ 
                                color: percentageChange > 0 ? '#16A34A' : percentageChange < 0 ? '#DC2626' : '#6B7280'
                              }}
                            >
                              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Pix */}
            {(() => {
              const pixData = paymentSummary.find((p: any) => p.method_name?.toLowerCase() === 'pix');
              const total = pixData?.total_amount || 0;
              return (
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: '15px', backgroundColor: '#EFF6FF' }}
                  onClick={() => {
                    setTransactionsModalType('all');
                    setShowTransactionsModal(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#93C5FD' }}>
                        <Smartphone className="h-5 w-5" style={{ color: '#2563EB' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Pix</p>
                    <p className="text-xl font-bold" style={{ color: '#2563EB' }}>
                      {formatCurrency(total)}
                    </p>
                    {(() => {
                      const percentageChange = pixData?.percentage_change || 0;
                      const previousAmount = pixData?.previous_amount || 0;
                      // Mostrar se houver comparação (valores anteriores ou atuais > 0) ou se for 0% (valores iguais)
                      if (previousAmount > 0 || pixData?.total_amount > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-2">
                            {percentageChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3" style={{ color: '#2563EB' }} />
                            ) : percentageChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3" style={{ color: '#DC2626' }} />
                            ) : (
                              <span className="h-3 w-3" /> // Espaçador quando for 0%
                            )}
                            <span 
                              className="text-xs font-medium"
                              style={{ 
                                color: percentageChange > 0 ? '#2563EB' : percentageChange < 0 ? '#DC2626' : '#6B7280'
                              }}
                            >
                              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Débito */}
            {(() => {
              const debitoData = paymentSummary.find((p: any) => 
                p.method_name?.toLowerCase().includes('débito') || 
                p.method_name?.toLowerCase().includes('debito')
              );
              const total = debitoData?.total_amount || 0;
              const fees = debitoData?.total_fees || 0;
              return (
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: '15px', backgroundColor: '#FAF5FF' }}
                  onClick={() => {
                    setTransactionsModalType('all');
                    setShowTransactionsModal(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#E9D5FF' }}>
                        <CreditCard className="h-5 w-5" style={{ color: '#9333EA' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Cartão de Débito</p>
                    <p className="text-xl font-bold" style={{ color: '#9333EA' }}>
                      {formatCurrency(total)}
                    </p>
                    {fees > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Taxas: {formatCurrency(fees)}
                      </p>
                    )}
                    {(() => {
                      const percentageChange = debitoData?.percentage_change || 0;
                      const previousAmount = debitoData?.previous_amount || 0;
                      // Mostrar se houver comparação (valores anteriores ou atuais > 0) ou se for 0% (valores iguais)
                      if (previousAmount > 0 || debitoData?.total_amount > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-2">
                            {percentageChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3" style={{ color: '#9333EA' }} />
                            ) : percentageChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3" style={{ color: '#DC2626' }} />
                            ) : (
                              <span className="h-3 w-3" /> // Espaçador quando for 0%
                            )}
                            <span 
                              className="text-xs font-medium"
                              style={{ 
                                color: percentageChange > 0 ? '#9333EA' : percentageChange < 0 ? '#DC2626' : '#6B7280'
                              }}
                            >
                              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Crédito */}
            {(() => {
              const creditoData = paymentSummary.find((p: any) => 
                p.method_name?.toLowerCase().includes('crédito') || 
                p.method_name?.toLowerCase().includes('credito')
              );
              const total = creditoData?.total_amount || 0;
              const fees = creditoData?.total_fees || 0;
              return (
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: '15px', backgroundColor: '#F3E8FF' }}
                  onClick={() => {
                    setTransactionsModalType('all');
                    setShowTransactionsModal(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#DDD6FE' }}>
                        <CreditCard className="h-5 w-5" style={{ color: '#7C3AED' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Cartão de Crédito</p>
                    <p className="text-xl font-bold" style={{ color: '#7C3AED' }}>
                      {formatCurrency(total)}
                    </p>
                    {fees > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Taxas: {formatCurrency(fees)}
                      </p>
                    )}
                    {(() => {
                      const percentageChange = creditoData?.percentage_change || 0;
                      const previousAmount = creditoData?.previous_amount || 0;
                      // Mostrar se houver comparação (valores anteriores ou atuais > 0) ou se for 0% (valores iguais)
                      if (previousAmount > 0 || creditoData?.total_amount > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-2">
                            {percentageChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3" style={{ color: '#7C3AED' }} />
                            ) : percentageChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3" style={{ color: '#DC2626' }} />
                            ) : (
                              <span className="h-3 w-3" /> // Espaçador quando for 0%
                            )}
                            <span 
                              className="text-xs font-medium"
                              style={{ 
                                color: percentageChange > 0 ? '#7C3AED' : percentageChange < 0 ? '#DC2626' : '#6B7280'
                              }}
                            >
                              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Taxas de Maquininha */}
            {(() => {
              const totalFees = paymentSummary.reduce((sum: number, p: any) => sum + (p.total_fees || 0), 0);
              return (
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: '15px', backgroundColor: '#FEF2F2' }}
                  onClick={() => {
                    setTransactionsModalType('expense');
                    setShowTransactionsModal(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#FECACA' }}>
                        <Receipt className="h-5 w-5" style={{ color: '#DC2626' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Taxas de Maquininha</p>
                    <p className="text-xl font-bold" style={{ color: '#DC2626' }}>
                      - {formatCurrency(totalFees)}
                    </p>
                    {(() => {
                      // Calcular variação percentual das taxas
                      const currentFees = totalFees;
                      const previousFees = paymentSummary.reduce((sum: number, p: any) => sum + (p.previous_fees || 0), 0);
                      let percentageChange = 0;
                      if (currentFees === previousFees && previousFees > 0) {
                        // Valores iguais = 0% de variação
                        percentageChange = 0;
                      } else if (previousFees > 0) {
                        percentageChange = ((currentFees - previousFees) / previousFees) * 100;
                      } else if (currentFees > 0) {
                        percentageChange = 100;
                      }
                      
                      // Mostrar se houver comparação (valores anteriores ou atuais > 0) ou se for 0% (valores iguais)
                      if (previousFees > 0 || currentFees > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-2">
                            {percentageChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3" style={{ color: '#16A34A' }} />
                            ) : percentageChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3" style={{ color: '#DC2626' }} />
                            ) : (
                              <span className="h-3 w-3" /> // Espaçador quando for 0%
                            )}
                            <span 
                              className="text-xs font-medium"
                              style={{ 
                                color: percentageChange < 0 ? '#16A34A' : percentageChange > 0 ? '#DC2626' : '#6B7280'
                              }}
                            >
                              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico Pizza - Receitas vs Despesas */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
            <CardHeader>
              <CardTitle className="text-lg" style={{ color: '#5A2E98' }}>Receitas vs Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={chartData.pie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="percentage"
                    label={({ percentage }) => `${percentage.toFixed(1)}%`}
                    labelLine={false}
                  >
                    {chartData.pie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as any;
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="font-medium mb-1">{data.name}</div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: data.fill }}
                            />
                            <div className="flex flex-col">
                              <span className="font-mono font-medium">
                                {data.percentage.toFixed(1)}%
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {formatCurrency(data.value)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ChartContainer>
              {/* Legenda com valores */}
              <div className="flex justify-center gap-6 mt-4">
                {chartData.pie.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: entry.fill }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium" style={{ color: '#5A2E98' }}>
                        {entry.name}
                      </span>
                      <span className="text-xs text-[#5A4A5E]">
                        {formatCurrency(entry.value)} ({entry.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Barras - Receitas por Categoria */}
          {chartData.incomeByCategory.length > 0 && (
            <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
              <CardHeader>
                <CardTitle className="text-lg" style={{ color: '#5A2E98' }}>Receitas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[200px]">
                  <BarChart data={chartData.incomeByCategory}>
                    <XAxis dataKey="name" tick={{ fill: '#5A4A5E', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#5A4A5E', fontSize: 12 }} />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload as any;
                        return (
                          <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                            <div className="font-medium mb-1">{data.name}</div>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: '#C9A7FD' }}
                              />
                              <div className="flex flex-col">
                                <span className="font-mono font-medium">
                                  {formatCurrency(data.value)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {data.percentage.toFixed(1)}% do total
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" fill="#C9A7FD" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Listagem de Transações */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4" style={{ width: '120px', height: '120px' }}>
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#F7D5E8" strokeWidth="2"/>
                  <path d="M 60 100 L 90 130 L 140 70" fill="none" stroke="#C9A7FD" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-lg font-medium mb-2" style={{ color: '#5A2E98' }}>
                Nenhuma transação por enquanto
              </p>
              <p className="text-sm text-[#5A4A5E] mb-6">
                Comece adicionando uma Receita ou Despesa.
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={() => handleOpenModal('income')}
                  className="rounded-full px-6"
                  style={{ backgroundColor: '#EB67A3', color: 'white' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
                <Button 
                  onClick={() => handleOpenModal('expense')}
                  className="rounded-full px-6"
                  style={{ backgroundColor: '#8E44EC', color: 'white' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Despesa
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((transaction) => {
                const isIncome = transaction.type === 'income';
                const appointment = (transaction as any).appointments;
                const product = (transaction as any).products;
                const serviceCategory = appointment?.services?.service_categories?.name;
                const serviceName = appointment?.services?.name;
                
                // Lógica de exibição baseada no tipo de transação
                let displayPrimary = '';
                let displaySecondary = '';
                const clientName = appointment?.client_name;
                
                const isCardFee = !isIncome && transaction.category === 'Taxas' && transaction.description?.includes('Taxa da maquininha');
                const isCommission = !isIncome && transaction.category === 'Comissões';
                const isSalary = !isIncome && transaction.category === 'Salários' && transaction.description?.includes('Salário -');
                
                if (isSalary && transaction.description) {
                  // Transação de salário: "Salário - [Nome do colaborador]"
                  displayPrimary = transaction.description; // "Salário - [Nome do colaborador]"
                  displaySecondary = formatCurrency(Number(transaction.amount)); // Valor do salário
                } else if (isCommission && transaction.description) {
                  // Transação de comissão: dividir descrição no separador " | "
                  const parts = transaction.description.split(' | ');
                  
                  // Se tem o separador, usar o formato novo
                  if (parts.length > 1) {
                    displayPrimary = parts[0] || transaction.description; // "Comissão - [Nome do colaborador]"
                    displaySecondary = parts[1] || ''; // "[Nome do serviço] - [Nome do cliente]"
                  } else {
                    // Formato antigo: tentar extrair informações da descrição
                    // Exemplo: "Comissão colaborador - Cliente: Rosa de Jesus Vanes"
                    const desc = transaction.description;
                    
                    // Tentar extrair nome do colaborador e cliente do formato antigo
                    if (desc.includes(' - Cliente: ')) {
                      const oldParts = desc.split(' - Cliente: ');
                      const collaboratorPart = oldParts[0].replace('Comissão colaborador', '').replace('Comissão', '').trim();
                      const clientName = oldParts[1] || '';
                      
                      // Se tem appointment, buscar nome do colaborador e serviço
                      if (appointment) {
                        // Buscar nome do colaborador do appointment se disponível
                        const collaboratorName = (appointment as any).collaborators?.name || collaboratorPart || 'Colaborador';
                        displayPrimary = `Comissão - ${collaboratorName}`;
                        
                        // Montar texto secundário com serviço e cliente
                        if (serviceName && clientName) {
                          displaySecondary = `${serviceName} - ${clientName}`;
                        } else if (serviceName) {
                          displaySecondary = serviceName;
                        } else if (clientName) {
                          displaySecondary = clientName;
                        } else {
                          displaySecondary = '';
                        }
                      } else {
                        displayPrimary = collaboratorPart ? `Comissão - ${collaboratorPart}` : 'Comissão';
                        displaySecondary = clientName || '';
                      }
                    } else {
                      // Formato desconhecido, usar como está
                      displayPrimary = desc;
                      displaySecondary = '';
                    }
                  }
                } else if (product) {
                  // Transação de produto: nome do produto como principal
                  displayPrimary = product.name;
                  // Categoria como secundário: "Produtos - [categoria do produto]"
                  const productCategory = product.category || 'Geral';
                  displaySecondary = `Produtos - ${productCategory}`;
                } else if (isCardFee && appointment && clientName) {
                  // Despesa de taxa de maquininha: cliente - Taxa de maquininha como principal
                  displayPrimary = `${clientName} - Taxa de maquininha`;
                  // Sem secundário necessário
                } else if (isIncome && appointment && clientName) {
                  // Receita de agendamento finalizado: cliente - serviço como principal
                  if (serviceName) {
                    displayPrimary = `${clientName} - ${serviceName}`;
                  } else {
                    displayPrimary = clientName;
                  }
                  // Secundário: "Atendimento finalizado - [categoria do serviço]"
                  const finalCategory = serviceCategory || transaction.category;
                  displaySecondary = `Atendimento finalizado - ${finalCategory}`;
                } else {
                  // Transação normal ou receita manual: categoria como principal
                  let displayCategory = serviceCategory || transaction.category;
                  if (serviceName && serviceCategory) {
                    displayCategory = `${serviceCategory} - ${serviceName}`;
                  } else if (serviceName && !serviceCategory) {
                    displayCategory = `${transaction.category} - ${serviceName}`;
                  }
                  displayPrimary = displayCategory;
                  // Descrição como secundário (se existir)
                  if (transaction.description) {
                    displaySecondary = transaction.description;
                  }
                }

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:shadow-md transition-all border border-transparent hover:border-[#F7D5E8]"
                    style={{ backgroundColor: '#FCFCFD' }}
                  >
                    <div 
                      className="flex items-center gap-4 flex-1"
                      onClick={() => {
                        // Abrir modal de detalhes para qualquer transação de receita
                        if (transaction.type === 'income') {
                          if (transaction.appointment_id) {
                            setSelectedAppointmentId(transaction.appointment_id);
                            setShowAppointmentDetailsModal(true);
                          } else {
                            // Para receitas manuais, usar o modal de detalhes com transaction_id
                            setSelectedAppointmentId(null);
                            setSelectedTransactionId(transaction.id);
                            setShowAppointmentDetailsModal(true);
                          }
                        }
                      }}
                      style={{ cursor: transaction.type === 'income' ? 'pointer' : 'default' }}
                    >
                      <div 
                        className="p-2 rounded-xl"
                        style={{ 
                          backgroundColor: isIncome ? '#F7D5E8' : '#F7D5E8',
                        }}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="h-5 w-5" style={{ color: '#8E44EC' }} />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" style={{ color: '#EB67A3' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-[#5A2E98]">
                            {(isIncome && appointment && clientName) || (isCardFee && appointment && clientName) ? displayPrimary : displayPrimary.toUpperCase()}
                          </p>
                          <Badge 
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: isIncome ? '#F7D5E8' : '#F7D5E8',
                              color: isIncome ? '#8E44EC' : '#EB67A3'
                            }}
                          >
                            {isIncome ? 'Receita' : 'Despesa'}
                          </Badge>
                          {(transaction as any).is_variable_cost && (
                            <Badge 
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: '#FEF3C7',
                                color: '#D97706'
                              }}
                            >
                              Custo Variável
                            </Badge>
                          )}
                          {(transaction as any).is_fixed_cost && (
                            <Badge 
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: '#E0E7FF',
                                color: '#6366F1'
                              }}
                            >
                              Custo Fixo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#5A4A5E]">
                          <span>{formatTransactionDate(transaction.transaction_date)}</span>
                          {displaySecondary && (
                            <>
                              <span>•</span>
                              <span>{displaySecondary}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p 
                          className="text-lg font-bold"
                          style={{ color: isIncome ? '#8E44EC' : '#EB67A3' }}
                        >
                          {isIncome ? '+' : '-'} {formatCurrency(Number(transaction.amount))}
                        </p>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" style={{ color: '#5A4A5E' }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: '#EB67A3' }} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {transactions.length > 10 && (
                <div className="text-center pt-4">
                  <Button
                    onClick={() => {
                      setTransactionsModalType('all');
                      setShowTransactionsModal(true);
                    }}
                    variant="outline"
                    className="rounded-full"
                    style={{ borderColor: '#F7D5E8', color: '#8E44EC' }}
                  >
                    Ver todas as transações ({transactions.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <FinanceModal
        open={showFinanceModal}
        onOpenChange={handleModalChange}
        type={financeModalType}
        mode={modalMode}
        transaction={selectedTransaction}
      />

      <ManageExpenseCategoriesModal
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
        onCategoryAdded={() => {
          // Invalidar queries para atualizar categorias
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
        }}
      />

      <TransactionsModal
        open={showTransactionsModal}
        onOpenChange={setShowTransactionsModal}
        type={transactionsModalType}
        onEdit={(transaction) => {
          setSelectedTransaction(transaction);
          setFinanceModalType(transaction.type as 'income' | 'expense');
          setModalMode('edit');
          setShowFinanceModal(true);
          setShowTransactionsModal(false);
        }}
        onDelete={(transaction) => {
          handleDeleteTransaction(transaction);
        }}
      />

      <PaymentMethodFeesModal
        open={showPaymentFeesModal}
        onOpenChange={setShowPaymentFeesModal}
      />

      <AppointmentDetailsViewModal
        open={showAppointmentDetailsModal}
        onOpenChange={setShowAppointmentDetailsModal}
        appointmentId={selectedAppointmentId}
        transactionId={selectedTransactionId}
      />
    </div>
  );
};

export default Financeiro;
