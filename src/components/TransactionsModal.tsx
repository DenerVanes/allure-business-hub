import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Filter, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Edit,
  Trash2,
  Scissors,
  Search
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from 'date-fns';
import { formatTransactionDate, getBrazilianDate } from '@/utils/timezone';
import type { Database } from '@/integrations/supabase/types';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];

interface TransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'income' | 'expense' | 'all';
  onEdit?: (transaction: TransactionRow) => void;
  onDelete?: (transaction: TransactionRow) => void;
}

const TransactionsModal = ({ 
  open, 
  onOpenChange, 
  type,
  onEdit,
  onDelete
}: TransactionsModalProps) => {
  const { user } = useAuth();
  const [periodFilter, setPeriodFilter] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const getDateRange = (filter: string) => {
    const now = getBrazilianDate();
    switch (filter) {
      case 'thisWeek':
        return { start: format(startOfWeek(now), 'yyyy-MM-dd'), end: format(endOfWeek(now), 'yyyy-MM-dd') };
      case 'last7Days':
        const last7 = subDays(now, 6);
        return { start: format(last7, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'last15Days':
        const last15 = subDays(now, 14);
        return { start: format(last15, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last6Months':
        const sixMonthsAgo = subMonths(now, 5);
        return { start: format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'thisYear':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'lastYear':
        const lastYear = subYears(now, 1);
        return { start: format(startOfYear(lastYear), 'yyyy-MM-dd'), end: format(endOfYear(lastYear), 'yyyy-MM-dd') };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: customEndDate };
        }
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      default:
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
  };

  const { data: transactions = [], isLoading } = useQuery<TransactionRow[]>({
    queryKey: ['all-transactions-modal', user?.id, periodFilter, customStartDate, customEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { start, end } = getDateRange(periodFilter);
      
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
    enabled: !!user?.id && open
  });

  // Filtrar por tipo e categoria
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtro por tipo (receita/despesa)
    if (type !== 'all') {
      filtered = filtered.filter(t => t.type === type);
    }

    // Filtro por categoria
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => {
        const appointment = (t as any).appointments;
        const serviceCategory = appointment?.services?.service_categories?.name;
        const category = serviceCategory || t.category;
        return category === categoryFilter;
      });
    }

    // Busca por texto
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t as any).appointments?.services?.name?.toLowerCase().includes(query) ||
        t.amount.toString().includes(query)
      );
    }

    return filtered;
  }, [transactions, type, categoryFilter, searchQuery]);

  // Obter categorias únicas para o filtro
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(t => {
      if (type === 'all' || t.type === type) {
        const appointment = (t as any).appointments;
        const serviceCategory = appointment?.services?.service_categories?.name;
        const category = serviceCategory || t.category;
        categories.add(category);
      }
    });
    return Array.from(categories).sort();
  }, [transactions, type]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalAmount = filteredTransactions.reduce((sum, t) => {
    return sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
            <Filter className="h-5 w-5" style={{ color: type === 'income' ? '#8E44EC' : type === 'expense' ? '#EB67A3' : '#8E44EC' }} />
            {type === 'income' ? 'Todas as Receitas' : type === 'expense' ? 'Todas as Despesas' : 'Todas as Transações'}
          </DialogTitle>
          <DialogDescription className="text-[#5A4A5E]">
            Visualize e filtre todas as transações do período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Filtros */}
          <div className="space-y-4 p-4 border rounded-xl" style={{ borderColor: '#F7D5E8', backgroundColor: '#FCFCFD' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro de Período */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#5A4A5E] flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Período
                </label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full" style={{ borderRadius: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisWeek">Semana atual</SelectItem>
                    <SelectItem value="last7Days">Últimos 7 dias</SelectItem>
                    <SelectItem value="last15Days">Últimos 15 dias</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="last6Months">Últimos 6 meses</SelectItem>
                    <SelectItem value="thisYear">Este ano</SelectItem>
                    <SelectItem value="lastYear">Ano passado</SelectItem>
                    <SelectItem value="custom">Período Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Categoria */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#5A4A5E] flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Categoria
                </label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full" style={{ borderRadius: '12px' }}>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#5A4A5E] flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
                  <Input
                    placeholder="Buscar transações..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{ borderRadius: '12px' }}
                  />
                </div>
              </div>
            </div>

            {/* Período Personalizado */}
            {periodFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#5A4A5E]">Data Inicial</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{ borderRadius: '12px' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#5A4A5E]">Data Final</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{ borderRadius: '12px' }}
                  />
                </div>
              </div>
            )}

            {/* Resumo */}
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#F7D5E8' }}>
              <div>
                <span className="text-sm text-[#5A4A5E]">
                  {filteredTransactions.length} transação(ões) encontrada(s)
                </span>
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: '#5A2E98' }}>
                  Total: {formatCurrency(Math.abs(totalAmount))}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Transações */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A7FD] mx-auto mb-4"></div>
                <p className="text-[#5A4A5E]">Carregando transações...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4" style={{ width: '100px', height: '100px' }}>
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="#F7D5E8" strokeWidth="2"/>
                    <path d="M 60 100 L 90 130 L 140 70" fill="none" stroke="#C9A7FD" strokeWidth="4" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-lg font-medium mb-2" style={{ color: '#5A2E98' }}>
                  Nenhuma transação encontrada
                </p>
                <p className="text-sm text-[#5A4A5E]">
                  Tente ajustar os filtros para encontrar transações.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
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
                  
                  if (product) {
                    // Transação de produto: nome do produto como principal
                    displayPrimary = product.name;
                    // Categoria como secundário: "Produtos - [categoria do produto]"
                    const productCategory = product.category || 'Geral';
                    displaySecondary = `Produtos - ${productCategory}`;
                  } else if (isCardFee && appointment && clientName) {
                    // Despesa de taxa de maquininha: extrair método de pagamento da descrição
                    // Formato da descrição: "Taxa da maquininha\nDébito – Agendamento [Cliente]"
                    // ou "Taxa da maquininha\nCrédito – Agendamento [Cliente]"
                    let paymentMethod = '';
                    if (transaction.description) {
                      // Tentar extrair de múltiplas formas
                      const desc = transaction.description;
                      
                      // Formato novo: "Taxa da maquininha\nDébito – Agendamento [Cliente]"
                      const lines = desc.split('\n');
                      if (lines.length > 1) {
                        const secondLine = lines[1] || '';
                        if (secondLine.includes('Débito')) {
                          paymentMethod = 'Débito';
                        } else if (secondLine.includes('Crédito')) {
                          paymentMethod = 'Crédito';
                        } else if (secondLine.includes('Cartão')) {
                          paymentMethod = 'Cartão';
                        }
                      }
                      
                      // Se não encontrou, tentar buscar diretamente na descrição completa
                      if (!paymentMethod) {
                        if (desc.includes('Débito')) {
                          paymentMethod = 'Débito';
                        } else if (desc.includes('Crédito')) {
                          paymentMethod = 'Crédito';
                        } else if (desc.includes('Cartão')) {
                          paymentMethod = 'Cartão';
                        }
                      }
                    }
                    
                    // Montar texto principal com método de pagamento
                    if (paymentMethod) {
                      displayPrimary = `${clientName} - Taxa de maquininha (${paymentMethod})`;
                    } else {
                      displayPrimary = `${clientName} - Taxa de maquininha`;
                    }
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
                      <div className="flex items-center gap-4 flex-1">
                        <div 
                          className="p-2 rounded-xl"
                          style={{ 
                            backgroundColor: '#F7D5E8',
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
                                backgroundColor: '#F7D5E8',
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
                        {(onEdit || onDelete) && (
                          <div className="flex items-center gap-2">
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(transaction)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" style={{ color: '#5A4A5E' }} />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(transaction)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" style={{ color: '#EB67A3' }} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionsModal;

