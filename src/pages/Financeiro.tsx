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
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceModal } from '@/components/FinanceModal';
import { ManageExpenseCategoriesModal } from '@/components/ManageExpenseCategoriesModal';
import TransactionsModal from '@/components/TransactionsModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isThisMonth, isSameMonth } from 'date-fns';
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
    queryKey: ['financial-transactions', user?.id, dateFilter],
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
            services (
              name,
              service_categories (name)
            )
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

  // Buscar agendamentos finalizados do mês para cálculo correto do ticket médio
  const { data: finalizedAppointments = [] } = useQuery({
    queryKey: ['finalized-appointments-month', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients (id, name)')
        .eq('user_id', user.id)
        .eq('status', 'finalizado')
        .gte('appointment_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(monthEnd, 'yyyy-MM-dd'));
      
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

  // Métricas do mês atual
  const currentMonth = new Date();
  const lastMonth = subMonths(currentMonth, 1);
  
  const currentMonthIncome = allTransactions
    .filter(t => t.type === 'income' && isSameMonth(new Date(t.transaction_date), currentMonth))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const lastMonthIncome = allTransactions
    .filter(t => t.type === 'income' && isSameMonth(new Date(t.transaction_date), lastMonth))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const incomeChange = lastMonthIncome > 0 
    ? ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 
    : 0;

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
            <Select value={dateFilter} onValueChange={setDateFilter}>
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
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowManageCategories(true)}
              variant="outline"
              className="rounded-full"
              style={{ borderColor: '#F7D5E8' }}
            >
              <FolderOpen className="h-4 w-4 mr-2" style={{ color: '#8E44EC' }} />
              Gerenciar Categorias
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

      {/* Métricas Inteligentes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5A4A5E] mb-1">Receita do Mês</p>
                <p className="text-xl font-bold" style={{ color: '#8E44EC' }}>
                  {formatCurrency(currentMonthIncome)}
                </p>
              </div>
              <Sparkles className="h-5 w-5" style={{ color: '#C9A7FD' }} />
            </div>
            {incomeChange !== 0 && (
              <div className="flex items-center gap-1 mt-2">
                {incomeChange > 0 ? (
                  <ArrowUpRight className="h-3 w-3" style={{ color: '#8E44EC' }} />
                ) : (
                  <ArrowDownRight className="h-3 w-3" style={{ color: '#EB67A3' }} />
                )}
                <span 
                  className="text-xs font-medium"
                  style={{ color: incomeChange > 0 ? '#8E44EC' : '#EB67A3' }}
                >
                  {incomeChange > 0 ? '+' : ''}{incomeChange.toFixed(1)}%
                </span>
                <span className="text-xs text-[#5A4A5E]">vs mês anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5A4A5E] mb-1">Ticket Médio</p>
                <p className="text-xl font-bold" style={{ color: '#8E44EC' }}>
                  {formatCurrency(averageTicket)}
                </p>
              </div>
              <Users className="h-5 w-5" style={{ color: '#C9A7FD' }} />
            </div>
            <p className="text-xs text-[#5A4A5E] mt-2">No período selecionado</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5A4A5E] mb-1">Clientes Atendidos</p>
                <p className="text-xl font-bold" style={{ color: '#8E44EC' }}>
                  {uniqueClientsInPeriod}
                </p>
              </div>
              <Users className="h-5 w-5" style={{ color: '#C9A7FD' }} />
            </div>
            <p className="text-xs text-[#5A4A5E] mt-2">No período selecionado</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5A4A5E] mb-1">Transações</p>
                <p className="text-xl font-bold" style={{ color: '#8E44EC' }}>
                  {transactions.length}
                </p>
              </div>
              <FileText className="h-5 w-5" style={{ color: '#C9A7FD' }} />
            </div>
            <p className="text-xs text-[#5A4A5E] mt-2">No período selecionado</p>
          </CardContent>
        </Card>
      </div>

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
                const serviceCategory = appointment?.services?.service_categories?.name;
                const serviceName = appointment?.services?.name;
                // Montar display: categoria - nome do serviço (se houver serviço)
                let displayCategory = serviceCategory || transaction.category;
                if (serviceName && serviceCategory) {
                  displayCategory = `${serviceCategory} - ${serviceName}`;
                } else if (serviceName && !serviceCategory) {
                  displayCategory = `${transaction.category} - ${serviceName}`;
                }

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:shadow-md transition-all border border-transparent hover:border-[#F7D5E8]"
                    style={{ backgroundColor: '#FCFCFD' }}
                  >
                    <div className="flex items-center gap-4 flex-1">
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
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-[#5A2E98]">{transaction.description}</p>
                          <Badge 
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: isIncome ? '#F7D5E8' : '#F7D5E8',
                              color: isIncome ? '#8E44EC' : '#EB67A3'
                            }}
                          >
                            {isIncome ? 'Receita' : 'Despesa'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#5A4A5E]">
                          <span>{formatTransactionDate(transaction.transaction_date)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Scissors className="h-3 w-3" />
                            {displayCategory}
                          </span>
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
                      <div className="flex items-center gap-2">
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
    </div>
  );
};

export default Financeiro;
