import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, Package, CreditCard, Receipt, AlertTriangle, CheckCircle, XCircle, Info, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isPast, isSameMonth, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTransactionDate, getBrazilianDate } from '@/utils/timezone';
import type { Database } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '@/hooks/use-toast';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
    autoTable?: (options: any) => void;
  }
}

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];

// A identificação de custos fixos e variáveis é feita através das flags is_fixed_cost e is_variable_cost
// nas transações financeiras, que são definidas quando a categoria é configurada pelo usuário

const RelatorioFiscal = () => {
  const { user } = useAuth();
  const [periodFilter, setPeriodFilter] = useState('currentMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [taxRegime, setTaxRegime] = useState<'MEI' | 'Simples Nacional'>('MEI');
  const [showReceitaDetalhamento, setShowReceitaDetalhamento] = useState(false);
  const [projectionYear, setProjectionYear] = useState<'current' | 'next'>('current');
  const [showVariableCostsModal, setShowVariableCostsModal] = useState(false);
  const [modalPeriodFilter, setModalPeriodFilter] = useState<string>('currentMonth');
  const [modalCustomStartDate, setModalCustomStartDate] = useState<string>('');
  const [modalCustomEndDate, setModalCustomEndDate] = useState<string>('');
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [modalIncomePeriodFilter, setModalIncomePeriodFilter] = useState<string>('currentMonth');
  const [modalIncomeCustomStartDate, setModalIncomeCustomStartDate] = useState<string>('');
  const [modalIncomeCustomEndDate, setModalIncomeCustomEndDate] = useState<string>('');
  const [showPDFConfigModal, setShowPDFConfigModal] = useState(false);
  const [pdfPeriodType, setPdfPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [pdfSelectedMonth, setPdfSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [pdfSelectedYear, setPdfSelectedYear] = useState<string>(format(new Date(), 'yyyy'));
  const [pdfIncludeAllTransactions, setPdfIncludeAllTransactions] = useState(false);
  
  // Ref para armazenar a posição de scroll antes de mudanças
  const scrollPositionRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);

  // Limite anual do MEI (em reais)
  const MEI_LIMIT = 81000;

  // Obter data atual e ano atual
  const now = getBrazilianDate();
  const currentYearStart = format(startOfYear(now), 'yyyy-MM-dd');
  const currentYearEnd = format(endOfYear(now), 'yyyy-MM-dd');

  const getDateRange = (filter: string) => {
    const now = getBrazilianDate();
    switch (filter) {
      case 'currentMonth':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last3Months':
        const threeMonthsAgo = subMonths(now, 2); // 3 meses = current + 2 anteriores
        return { start: format(startOfMonth(threeMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last6Months':
        const sixMonthsAgo = subMonths(now, 5); // 6 meses = current + 5 anteriores
        return { start: format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last9Months':
        const nineMonthsAgo = subMonths(now, 8); // 9 meses = current + 8 anteriores
        return { start: format(startOfMonth(nineMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'annual':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: customEndDate };
        }
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      default:
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    }
  };

  const { start, end } = getDateRange(periodFilter);

  // Buscar todas as transações do período
  const { data: transactions = [], isLoading, isFetching } = useQuery<TransactionRow[]>({
    queryKey: ['fiscal-report-transactions', user?.id, periodFilter, customStartDate, customEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          appointments!left (
            client_name,
            total_amount,
            services (
              name,
              price
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
        .order('transaction_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    placeholderData: (previousData) => previousData, // Manter dados anteriores enquanto carrega novos
    staleTime: 1000, // Considerar dados válidos por 1 segundo
  });

  // Restaurar posição de scroll após atualização dos dados
  useEffect(() => {
    if (shouldRestoreScrollRef.current && !isFetching) {
      // Aguardar múltiplos frames para garantir que o DOM foi completamente atualizado
      const timeoutId = setTimeout(() => {
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'auto' // Sem animação
        });
        shouldRestoreScrollRef.current = false;
      }, 50); // Delay reduzido já que não precisamos esperar o loading
      
      return () => clearTimeout(timeoutId);
    }
  }, [transactions, isFetching]);

  // Separar receitas tributáveis
  const taxableIncome = useMemo(() => {
    return transactions.filter(t => t.type === 'income');
  }, [transactions]);

  // Receita bruta total (já considera descontos aplicados)
  const grossIncome = useMemo(() => {
    return taxableIncome.reduce((sum, t) => {
      const appointment = (t as any).appointments;
      // Usar o valor bruto já descontado (total_amount ou price)
      if (appointment) {
        const grossValue = appointment.total_amount 
          ? Number(appointment.total_amount) 
          : (appointment.services?.price ? Number(appointment.services.price) : Number(t.amount));
        return sum + grossValue;
      }
      return sum + Number(t.amount);
    }, 0);
  }, [taxableIncome]);

  // Para MEI, receita líquida é igual à receita bruta (já descontada)
  const netTaxableIncome = grossIncome;

  // Custos fixos (identificados pela flag is_fixed_cost)
  const fixedCosts = useMemo(() => {
    const fixed = transactions.filter(t => 
      t.type === 'expense' && (t as any).is_fixed_cost === true
    );
    
    const byCategory = fixed.reduce((acc: Record<string, number>, t) => {
      const category = t.category;
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {});

    const total = fixed.reduce((sum, t) => sum + Number(t.amount), 0);

    return { byCategory, total, items: fixed };
  }, [transactions]);

  // Custos variáveis (identificados pela flag is_variable_cost)
  const variableCosts = useMemo(() => {
    const variable = transactions.filter(t => 
      t.type === 'expense' && (t as any).is_variable_cost === true
    );
    
    const byCategory = variable.reduce((acc: Record<string, number>, t) => {
      const category = t.category;
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {});

    const total = variable.reduce((sum, t) => sum + Number(t.amount), 0);

    return { byCategory, total, items: variable };
  }, [transactions]);

  // Resultado operacional
  // Para MEI, usar receita bruta (sem descontar descontos), pois MEI não tributa
  // Receita Bruta - Custos Fixos - Custos Variáveis
  const operatingResult = grossIncome - fixedCosts.total - variableCosts.total;

  // Função para calcular período do modal
  const getModalDateRange = (filter: string) => {
    const now = getBrazilianDate();
    switch (filter) {
      case 'currentMonth':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last3Months':
        const threeMonthsAgo = subMonths(now, 2);
        return { start: format(startOfMonth(threeMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last6Months':
        const sixMonthsAgo = subMonths(now, 5);
        return { start: format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last9Months':
        const nineMonthsAgo = subMonths(now, 8);
        return { start: format(startOfMonth(nineMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'annual':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'custom':
        if (modalCustomStartDate && modalCustomEndDate) {
          return { start: modalCustomStartDate, end: modalCustomEndDate };
        }
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      default:
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    }
  };

  const { start: modalStart, end: modalEnd } = getModalDateRange(modalPeriodFilter);

  // Buscar custos variáveis do período do modal
  const { data: modalVariableCostsTransactions = [], isLoading: isLoadingModal } = useQuery<TransactionRow[]>({
    queryKey: ['fiscal-report-modal-variable-costs', user?.id, modalPeriodFilter, modalCustomStartDate, modalCustomEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('is_variable_cost', true)
        .gte('transaction_date', modalStart)
        .lte('transaction_date', modalEnd)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && showVariableCostsModal,
  });

  // Função para calcular período do modal de receita
  const getModalIncomeDateRange = (filter: string) => {
    const now = getBrazilianDate();
    switch (filter) {
      case 'currentMonth':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last3Months':
        const threeMonthsAgo = subMonths(now, 2);
        return { start: format(startOfMonth(threeMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last6Months':
        const sixMonthsAgo = subMonths(now, 5);
        return { start: format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last9Months':
        const nineMonthsAgo = subMonths(now, 8);
        return { start: format(startOfMonth(nineMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'annual':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'custom':
        if (modalIncomeCustomStartDate && modalIncomeCustomEndDate) {
          return { start: modalIncomeCustomStartDate, end: modalIncomeCustomEndDate };
        }
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      default:
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    }
  };

  const { start: modalIncomeStart, end: modalIncomeEnd } = getModalIncomeDateRange(modalIncomePeriodFilter);

  // Buscar receitas do período do modal
  const { data: modalIncomeTransactions = [], isLoading: isLoadingIncomeModal } = useQuery<TransactionRow[]>({
    queryKey: ['fiscal-report-modal-income', user?.id, modalIncomePeriodFilter, modalIncomeCustomStartDate, modalIncomeCustomEndDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          appointments!left (
            client_name,
            total_amount,
            services (
              name,
              price
            )
          ),
          products!left (
            name,
            category
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('transaction_date', modalIncomeStart)
        .lte('transaction_date', modalIncomeEnd)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && showIncomeModal,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Versão segura para PDF (sem caracteres especiais problemáticos)
  const formatCurrencyPDF = (value: number): string => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return `R$ ${formatted}`;
  };

  // Buscar faturamento anual bruto para cálculo do limite MEI
  const { data: annualTransactions = [] } = useQuery<TransactionRow[]>({
    queryKey: ['fiscal-annual-transactions', user?.id, currentYearStart, currentYearEnd],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          appointments!left (
            client_name,
            total_amount,
            appointment_date,
            services (
              name,
              price
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('transaction_date', currentYearStart)
        .lte('transaction_date', currentYearEnd)
        .order('transaction_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && taxRegime === 'MEI'
  });

  // Calcular faturamento bruto acumulado do ano (para MEI)
  const annualGrossRevenue = useMemo(() => {
    if (taxRegime !== 'MEI') return 0;
    
    return annualTransactions.reduce((sum, t) => {
      const appointment = (t as any).appointments;
      // Usar o valor bruto já descontado (total_amount ou price)
      if (appointment) {
        const grossValue = appointment.total_amount 
          ? Number(appointment.total_amount) 
          : (appointment.services?.price ? Number(appointment.services.price) : Number(t.amount));
        return sum + grossValue;
      }
      // Se não tiver serviço, usar o valor da transação
      return sum + Number(t.amount);
    }, 0);
  }, [annualTransactions, taxRegime]);

  // Calcular percentual utilizado do limite MEI (pode ultrapassar 100%)
  const meiUsagePercentage = useMemo(() => {
    if (taxRegime !== 'MEI') return 0;
    return (annualGrossRevenue / MEI_LIMIT) * 100;
  }, [annualGrossRevenue, taxRegime]);

  // Calcular limite restante
  const remainingLimit = MEI_LIMIT - annualGrossRevenue;

  // Calcular faturamento mensal
  // Função para verificar se um mês está completamente fechado
  const isMonthClosed = (monthStr: string): boolean => {
    const [monthName, year] = monthStr.split(' ');
    const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthIndex = monthNames.indexOf(monthName.toLowerCase());
    
    if (monthIndex === -1) return false;
    
    const monthDate = new Date(parseInt(year), monthIndex, 1);
    const lastDayOfMonth = endOfMonth(monthDate);
    const today = getBrazilianDate();
    
    // Verifica se o último dia do mês já passou completamente
    // Um mês está fechado se hoje é pelo menos o primeiro dia do mês seguinte
    const firstDayNextMonth = new Date(parseInt(year), monthIndex + 1, 1);
    
    return today >= firstDayNextMonth;
  };

  const monthlyRevenue = useMemo(() => {
    if (taxRegime !== 'MEI') return {};
    
    const monthly: Record<string, number> = {};
    
    annualTransactions.forEach(t => {
      const appointment = (t as any).appointments;
      const transactionDate = new Date(t.transaction_date + 'T00:00:00');
      const monthKey = format(transactionDate, 'MMMM yyyy', { locale: ptBR });
      
      // Usar o valor bruto já descontado (total_amount ou price)
      const grossValue = appointment?.total_amount 
        ? Number(appointment.total_amount) 
        : (appointment?.services?.price ? Number(appointment.services.price) : Number(t.amount));
      
      monthly[monthKey] = (monthly[monthKey] || 0) + grossValue;
    });
    
    return monthly;
  }, [annualTransactions, taxRegime]);

  // Separar meses fechados e não fechados
  const { closedMonths, openMonths } = useMemo(() => {
    const closed: Record<string, number> = {};
    const open: Record<string, number> = {};
    
    Object.entries(monthlyRevenue).forEach(([monthKey, value]) => {
      if (isMonthClosed(monthKey)) {
        closed[monthKey] = value;
      } else {
        open[monthKey] = value;
      }
    });
    
    return { closedMonths: closed, openMonths: open };
  }, [monthlyRevenue]);

  // Calcular média mensal apenas dos meses fechados (para projeções)
  const monthlyAverage = useMemo(() => {
    if (taxRegime !== 'MEI' || Object.keys(closedMonths).length === 0) return 0;
    const totalMonths = Object.keys(closedMonths).length;
    const totalRevenue = Object.values(closedMonths).reduce((sum, val) => sum + val, 0);
    return totalRevenue / totalMonths;
  }, [closedMonths, taxRegime]);

  // Calcular média mensal incluindo mês atual (não fechado) - para exibição na tela
  const monthlyAverageWithCurrent = useMemo(() => {
    if (taxRegime !== 'MEI') return 0;
    
    const currentYear = new Date().getFullYear();
    const currentYearRevenue: Record<string, number> = {};
    
    // Pegar todos os meses do ano atual (fechados e não fechados)
    Object.entries(monthlyRevenue).forEach(([monthKey, value]) => {
      const [monthName, year] = monthKey.split(' ');
      if (parseInt(year) === currentYear) {
        currentYearRevenue[monthKey] = value;
      }
    });
    
    if (Object.keys(currentYearRevenue).length === 0) return 0;
    
    const totalMonths = Object.keys(currentYearRevenue).length;
    const totalRevenue = Object.values(currentYearRevenue).reduce((sum, val) => sum + val, 0);
    return totalRevenue / totalMonths;
  }, [monthlyRevenue, taxRegime]);

  // Calcular média dos últimos 12 meses fechados (para projeção do próximo ano)
  const last12MonthsAverage = useMemo(() => {
    if (taxRegime !== 'MEI' || Object.keys(closedMonths).length === 0) return 0;
    
    // Pegar os últimos 12 meses fechados
    const sortedClosedMonths = Object.entries(closedMonths)
      .sort(([monthA], [monthB]) => {
        const parseMonth = (monthStr: string) => {
          const [monthName, year] = monthStr.split(' ');
          const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
          const monthIndex = monthNames.indexOf(monthName.toLowerCase());
          return new Date(parseInt(year), monthIndex);
        };
        return parseMonth(monthB).getTime() - parseMonth(monthA).getTime();
      })
      .slice(0, 12); // Pegar apenas os últimos 12 meses
    
    if (sortedClosedMonths.length === 0) return 0;
    
    const totalRevenue = sortedClosedMonths.reduce((sum, [, value]) => sum + value, 0);
    return totalRevenue / sortedClosedMonths.length;
  }, [closedMonths, taxRegime]);

  // Calcular projeção anual baseada na seleção
  const projectedAnnual = useMemo(() => {
    if (taxRegime !== 'MEI' || monthlyAverage === 0) return 0;
    
    const currentYear = new Date().getFullYear();
    const today = getBrazilianDate();
    const currentMonth = today.getMonth(); // 0-11
    
    if (projectionYear === 'current') {
      // Projeção do ano atual
      // Buscar faturamento já realizado no ano atual
      const currentYearRevenue: Record<string, number> = {};
      Object.entries(monthlyRevenue).forEach(([monthKey, value]) => {
        const [monthName, year] = monthKey.split(' ');
        if (parseInt(year) === currentYear) {
          currentYearRevenue[monthKey] = value;
        }
      });
      
      // Separar meses fechados e abertos do ano atual
      const currentYearClosed: Record<string, number> = {};
      const currentYearOpen: Record<string, number> = {};
      
      Object.entries(currentYearRevenue).forEach(([monthKey, value]) => {
        if (isMonthClosed(monthKey)) {
          currentYearClosed[monthKey] = value;
        } else {
          currentYearOpen[monthKey] = value;
        }
      });
      
      // Total já faturado apenas nos meses fechados
      const totalBilledClosed = Object.values(currentYearClosed).reduce((sum, val) => sum + val, 0);
      
      // Calcular meses restantes do ano atual
      // Contar quantos meses do ano atual já foram completamente fechados
      const closedMonthsCount = Object.keys(currentYearClosed).length;
      const monthsRemaining = 12 - closedMonthsCount;
      
      // Projeção = faturamento já realizado (meses fechados) + (média * meses restantes)
      return totalBilledClosed + (monthlyAverage * monthsRemaining);
    } else {
      // Projeção do próximo ano
      // Usar média dos últimos 12 meses fechados
      const averageToUse = last12MonthsAverage > 0 ? last12MonthsAverage : monthlyAverage;
      
      // Projeção = média * 12 meses
      return averageToUse * 12;
    }
  }, [projectionYear, monthlyAverage, last12MonthsAverage, monthlyRevenue, taxRegime]);

  // Mensagem inteligente baseada no percentual
  const getMEIAlertMessage = () => {
    if (taxRegime !== 'MEI') return null;
    
    const percentage = meiUsagePercentage;
    
    if (percentage <= 50) {
      return {
        type: 'success',
        icon: CheckCircle,
        message: 'Seu faturamento está dentro da faixa segura do MEI.',
        bgColor: '#F0FDF4',
        borderColor: '#86EFAC',
        textColor: '#166534'
      };
    } else if (percentage <= 70) {
      return {
        type: 'warning',
        icon: AlertTriangle,
        message: 'Atenção: você já utilizou mais da metade do limite anual do MEI.',
        bgColor: '#FEF9C3',
        borderColor: '#FDE047',
        textColor: '#854D0E'
      };
    } else if (percentage <= 90) {
      return {
        type: 'warning',
        icon: AlertTriangle,
        message: 'Alerta: seu faturamento está se aproximando do limite do MEI. Avalie seu crescimento e considere planejamento tributário.',
        bgColor: '#FFF7ED',
        borderColor: '#FED7AA',
        textColor: '#9A3412'
      };
    } else if (percentage <= 100) {
      return {
        type: 'error',
        icon: XCircle,
        message: 'Risco alto de desenquadramento do MEI. Recomendamos conversar com seu contador.',
        bgColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        textColor: '#991B1B'
      };
    } else {
      return {
        type: 'error',
        icon: XCircle,
        message: 'Você ultrapassou o limite do MEI. Será necessário migrar para outro regime tributário.',
        bgColor: '#FEF2F2',
        borderColor: '#EF4444',
        textColor: '#991B1B'
      };
    }
  };

  const meiAlert = getMEIAlertMessage();

  // Buscar perfil do salão
  const { data: profile } = useQuery({
    queryKey: ['user-profile-fiscal', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, cnpj')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const handleExportPDF = async () => {
    // Calcular período baseado na seleção do modal
    let pdfStart: string;
    let pdfEnd: string;
    let periodLabel: string;

    if (pdfPeriodType === 'monthly') {
      const [year, month] = pdfSelectedMonth.split('-');
      pdfStart = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      pdfEnd = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: ptBR });
      periodLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    } else {
      const year = parseInt(pdfSelectedYear);
      pdfStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
      pdfEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
      periodLabel = `Ano ${year}`;
    }

    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar transações do período selecionado
    const { data: pdfTransactions = [], error: transactionsError } = await supabase
      .from('financial_transactions')
      .select(`
        *,
        appointments!left (
          client_name,
          total_amount,
          id,
          services (
            name,
            price
          )
        ),
        products!left (
          name,
          category
        )
      `)
      .eq('user_id', user.id)
      .gte('transaction_date', pdfStart)
      .lte('transaction_date', pdfEnd)
      .order('transaction_date', { ascending: true });

    if (transactionsError) {
      throw new Error(`Erro ao buscar transações: ${transactionsError.message}`);
    }

    // Buscar appointment_payments separadamente para as transações que têm appointment_id
    const appointmentIds = pdfTransactions
      .map(t => (t as any).appointments?.id)
      .filter((id): id is string => !!id);

    let appointmentPaymentsMap: Record<string, any[]> = {};
    if (appointmentIds.length > 0) {
      const { data: paymentsData = [], error: paymentsError } = await supabase
        .from('appointment_payments')
        .select(`
          appointment_id,
          payment_methods (
            name
          ),
          amount
        `)
        .in('appointment_id', appointmentIds);

      if (paymentsError) {
        console.warn('Erro ao buscar formas de pagamento:', paymentsError);
      } else {
        // Agrupar por appointment_id
        appointmentPaymentsMap = paymentsData.reduce((acc: Record<string, any[]>, payment) => {
          const appointmentId = payment.appointment_id;
          if (!acc[appointmentId]) {
            acc[appointmentId] = [];
          }
          acc[appointmentId].push(payment);
          return acc;
        }, {});
      }
    }

    // Processar dados para o PDF
    const pdfIncome = pdfTransactions.filter(t => t.type === 'income');
    const pdfFixedCosts = pdfTransactions.filter(t => t.type === 'expense' && (t as any).is_fixed_cost === true);
    const pdfVariableCosts = pdfTransactions.filter(t => t.type === 'expense' && (t as any).is_variable_cost === true);

    // Calcular receita bruta (já considera descontos aplicados)
    let pdfGrossIncome = 0;
    
    pdfIncome.forEach(t => {
      const appointment = (t as any).appointments;
      if (appointment?.services?.price) {
        // O valor já é o valor bruto após desconto (total_amount)
        // Se não houver total_amount, usar o price do serviço
        const grossValue = Number(appointment.total_amount || appointment.services.price);
        pdfGrossIncome += grossValue;
      } else {
        pdfGrossIncome += Number(t.amount);
      }
    });
    const pdfFixedCostsTotal = pdfFixedCosts.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const pdfVariableCostsTotal = pdfVariableCosts.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const pdfOperatingResult = pdfGrossIncome - pdfFixedCostsTotal - pdfVariableCostsTotal;

    // Agrupar receitas por categoria (serviço)
    const incomeByCategory: Record<string, number> = {};
    pdfIncome.forEach(t => {
      const appointment = (t as any).appointments;
      const category = appointment?.services?.name || t.category || 'Outros';
      // Usar o valor bruto já descontado (total_amount ou price)
      const grossValue = appointment?.total_amount 
        ? Number(appointment.total_amount) 
        : (appointment?.services?.price ? Number(appointment.services.price) : Number(t.amount));
      incomeByCategory[category] = (incomeByCategory[category] || 0) + grossValue;
    });

    // Calcular faturamento anual para MEI (se for anual ou mensal de ano atual)
    let pdfAnnualGrossRevenue = 0;
    let pdfMeiUsagePercentage = 0;
    let pdfRemainingLimit = MEI_LIMIT;
    
    if (taxRegime === 'MEI') {
      const currentYear = pdfPeriodType === 'annual' ? parseInt(pdfSelectedYear) : new Date().getFullYear();
      const yearStart = format(startOfYear(new Date(currentYear, 0, 1)), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(new Date(currentYear, 0, 1)), 'yyyy-MM-dd');

      const { data: annualData = [], error: annualError } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          appointments!left (
            services (price)
          )
        `)
        .eq('user_id', user?.id)
        .eq('type', 'income')
        .gte('transaction_date', yearStart)
        .lte('transaction_date', yearEnd);

      if (annualError) {
        throw new Error(`Erro ao buscar dados anuais: ${annualError.message}`);
      }

      pdfAnnualGrossRevenue = annualData.reduce((sum, t) => {
        const appointment = (t as any).appointments;
        if (appointment) {
          // Usar o valor bruto já descontado (total_amount ou price)
          const grossValue = appointment.total_amount 
            ? Number(appointment.total_amount) 
            : (appointment.services?.price ? Number(appointment.services.price) : Number(t.amount));
          return sum + grossValue;
        }
        return sum + Number(t.amount);
      }, 0);

      pdfMeiUsagePercentage = (pdfAnnualGrossRevenue / MEI_LIMIT) * 100;
      pdfRemainingLimit = MEI_LIMIT - pdfAnnualGrossRevenue;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Função auxiliar para garantir encoding correto
    const safeText = (text: string): string => {
      return text || '';
    };
    
    // Função para adicionar linha horizontal
    const addHorizontalLine = (y: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(margin, y, pageWidth - margin, y);
    };
    
    // Função para adicionar card destacado
    const addCard = (title: string, items: Array<{label: string, value: string}>, startY: number): number => {
      let y = startY;
      
      // Fundo do card (cinza muito claro)
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, y - 5, contentWidth, (items.length * 8) + 15, 2, 2, 'F');
      
      // Título do card
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90, 46, 152); // Roxo Agendaris
      doc.text(safeText(title), margin + 5, y);
      y += 8;
      
      // Itens do card
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      items.forEach(item => {
        doc.setFont('helvetica', 'normal');
        doc.text(safeText(item.label), margin + 8, y);
        doc.setFont('helvetica', 'bold');
        const textWidth = doc.getTextWidth(safeText(item.value));
        doc.text(safeText(item.value), pageWidth - margin - 8 - textWidth, y);
        y += 7;
      });
      
      return y + 5;
    };
    
    let yPos = margin;
    
    // ===== CAPA / CABEÇALHO =====
    const salonName = safeText(profile?.business_name || '');
    
    // Título principal
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 46, 152); // Roxo Agendaris
    doc.text('Relatorio Fiscal', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;
    
    // Nome do salão (se existir)
    if (salonName) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(salonName, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
    }
    
    // Informações do relatório
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    doc.text(`Regime Tributario: ${taxRegime}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text(`Periodo: ${periodLabel}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth / 2, yPos, { align: 'center' });
    
    // CNPJ (se existir)
    if ((profile as any)?.cnpj) {
      yPos += 6;
      doc.text(`CNPJ: ${(profile as any).cnpj}`, pageWidth / 2, yPos, { align: 'center' });
    }
    
    yPos += 20;
    addHorizontalLine(yPos);
    yPos += 15;

    // ===== SEÇÃO 1 — RESUMO FISCAL (CARD DESTACADO) =====
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
    
    const summaryItems = [
      { label: 'Receita Bruta Total:', value: formatCurrencyPDF(pdfGrossIncome) },
      { label: 'Custos Fixos:', value: formatCurrencyPDF(pdfFixedCostsTotal) },
      { label: 'Custos Variaveis:', value: formatCurrencyPDF(pdfVariableCostsTotal) }
    ];
    
    yPos = addCard(`Resumo Fiscal do Periodo`, summaryItems, yPos);
    yPos += 10;
    
    // Observação
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Obs: valores organizados conforme o regime selecionado.', margin, yPos);
    yPos += 15;

    // ===== SEÇÃO 2 — DETALHAMENTO DE RECEITAS =====
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin;
    }
    
    // Título da seção
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 46, 152);
    doc.text('Detalhamento de Receitas', margin, yPos);
    yPos += 12;
    
    addHorizontalLine(yPos - 5);
    yPos += 10;
    
    // Subseção: Receitas por Categoria
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Receitas por Categoria', margin + 5, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Agrupar receitas por tipo (Serviços, Produtos, Comissões)
    const services: Array<{name: string, value: number}> = [];
    const products: Array<{name: string, value: number}> = [];
    const commissions: Array<{name: string, value: number}> = [];
    const others: Array<{name: string, value: number}> = [];
    
    Object.entries(incomeByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, value]) => {
        const lowerCategory = category.toLowerCase();
        if (lowerCategory.includes('produto')) {
          products.push({ name: category, value });
        } else if (lowerCategory.includes('comiss')) {
          commissions.push({ name: category, value });
        } else if (lowerCategory.includes('serviço') || !lowerCategory.includes('produto')) {
          services.push({ name: category, value });
        } else {
          others.push({ name: category, value });
        }
      });
    
    // Serviços
    if (services.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Servicos', margin + 10, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      
      services.forEach(item => {
        doc.text(`  ${safeText(item.name)}`, margin + 10, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(item.value));
        doc.text(formatCurrencyPDF(item.value), pageWidth - margin - 10 - textWidth, yPos);
        yPos += 6;
      });
      yPos += 5;
    }
    
    // Produtos
    if (products.length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('Produtos:', margin + 10, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      
      products.forEach(item => {
        doc.text(`  ${safeText(item.name)}`, margin + 10, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(item.value));
        doc.text(formatCurrencyPDF(item.value), pageWidth - margin - 10 - textWidth, yPos);
        yPos += 6;
      });
      yPos += 5;
    }
    
    // Comissões
    if (commissions.length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('Comissoes:', margin + 10, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      
      commissions.forEach(item => {
        doc.text(`  ${safeText(item.name)}`, margin + 10, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(item.value));
        doc.text(formatCurrencyPDF(item.value), pageWidth - margin - 10 - textWidth, yPos);
        yPos += 6;
      });
      yPos += 5;
    }
    
    // Outros
    if (others.length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      others.forEach(item => {
        doc.text(`  ${safeText(item.name)}`, margin + 10, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(item.value));
        doc.text(formatCurrencyPDF(item.value), pageWidth - margin - 10 - textWidth, yPos);
        yPos += 6;
      });
    }
    
    yPos += 10;

    // ===== SEÇÃO 3 — CUSTOS FIXOS =====
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 46, 152);
    doc.text('Custos Fixos', margin, yPos);
    yPos += 12;
    
    addHorizontalLine(yPos - 5);
    yPos += 10;
    
    // Agrupar por categoria
    const fixedCostsByCategory: Record<string, number> = {};
    pdfFixedCosts.forEach(t => {
      const category = t.category || 'Sem categoria';
      fixedCostsByCategory[category] = (fixedCostsByCategory[category] || 0) + Math.abs(Number(t.amount));
    });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Listar custos fixos por categoria
    Object.entries(fixedCostsByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, value]) => {
        doc.text(`${safeText(category)}:`, margin + 5, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(value));
        doc.text(formatCurrencyPDF(value), pageWidth - margin - 5 - textWidth, yPos);
        yPos += 7;
      });
    
    yPos += 10;

    // ===== SEÇÃO 4 — CUSTOS VARIÁVEIS / DESPESAS OPERACIONAIS =====
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 46, 152);
    doc.text('Custos Variaveis / Despesas Operacionais', margin, yPos);
    yPos += 12;
    
    addHorizontalLine(yPos - 5);
    yPos += 10;
    
    // Agrupar por categoria
    const variableCostsByCategory: Record<string, number> = {};
    pdfVariableCosts.forEach(t => {
      const category = t.category || 'Sem categoria';
      variableCostsByCategory[category] = (variableCostsByCategory[category] || 0) + Math.abs(Number(t.amount));
    });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Listar custos variáveis por categoria
    Object.entries(variableCostsByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, value]) => {
        doc.text(`${safeText(category)}:`, margin + 5, yPos);
        const textWidth = doc.getTextWidth(formatCurrencyPDF(value));
        doc.text(formatCurrencyPDF(value), pageWidth - margin - 5 - textWidth, yPos);
        yPos += 7;
      });
    
    yPos += 15;

    // Se checkbox marcado, incluir detalhamento completo (cliente a cliente)
    if (pdfIncludeAllTransactions && pdfIncome.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Detalhamento Completo - Receitas', 14, yPos);
      yPos += 12;

      const tableData = pdfIncome.map(t => {
        const appointment = (t as any).appointments;
        const clientName = appointment?.client_name || 'N/A';
        const serviceName = appointment?.services?.name || t.description || 'N/A';
        // Usar o valor bruto já descontado (total_amount ou price)
        const grossValue = appointment?.total_amount 
          ? Number(appointment.total_amount) 
          : (appointment?.services?.price ? Number(appointment.services.price) : Number(t.amount));
        
        const appointmentId = appointment?.id;
        const payments = appointmentId ? appointmentPaymentsMap[appointmentId] || [] : [];
        const paymentMethods = payments.length > 0 
          ? payments.map((p: any) => p.payment_methods?.name || 'N/A').join(', ')
          : 'N/A';
        
        return [
          format(new Date(t.transaction_date + 'T00:00:00'), 'dd/MM/yyyy'),
          clientName,
          serviceName,
          t.category || 'N/A',
          formatCurrencyPDF(grossValue),
          paymentMethods
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Cliente', 'Servico/Produto', 'Categoria', 'Valor', 'Forma de Pagamento']],
        body: tableData.map(row => row.map(cell => safeText(String(cell)))),
        theme: 'grid',
        headStyles: { 
          fillColor: [90, 46, 152], 
          textColor: 255, 
          fontStyle: 'bold',
          font: 'helvetica'
        },
        styles: { 
          fontSize: 8,
          font: 'helvetica',
          cellPadding: 3
        },
        columnStyles: { 
          4: { halign: 'right' },
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 50 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25 },
          5: { cellWidth: 30 }
        }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Detalhamento completo de custos fixos
      if (pdfFixedCosts.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Detalhamento Completo - Custos Fixos', 14, yPos);
        yPos += 12;

        const fixedCostsData = pdfFixedCosts.map(t => [
          format(new Date(t.transaction_date + 'T00:00:00'), 'dd/MM/yyyy'),
          t.description || '-',
          t.category || 'N/A',
          formatCurrencyPDF(Math.abs(Number(t.amount)))
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Descricao', 'Categoria', 'Valor']],
          body: fixedCostsData.map(row => row.map(cell => safeText(String(cell)))),
          theme: 'grid',
          headStyles: { 
            fillColor: [90, 46, 152], 
            textColor: 255, 
            fontStyle: 'bold',
            font: 'helvetica'
          },
          styles: { 
            fontSize: 9,
            font: 'helvetica',
            cellPadding: 3
          },
          columnStyles: { 
            3: { halign: 'right' }
          }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Detalhamento completo de custos variáveis
      if (pdfVariableCosts.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Detalhamento Completo - Custos Variáveis', 14, yPos);
        yPos += 12;

        const variableCostsData = pdfVariableCosts.map(t => [
          format(new Date(t.transaction_date + 'T00:00:00'), 'dd/MM/yyyy'),
          t.description || '-',
          t.category || 'N/A',
          formatCurrencyPDF(Math.abs(Number(t.amount)))
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Descricao', 'Categoria', 'Valor']],
          body: variableCostsData.map(row => row.map(cell => safeText(String(cell)))),
          theme: 'grid',
          headStyles: { 
            fillColor: [90, 46, 152], 
            textColor: 255, 
            fontStyle: 'bold',
            font: 'helvetica'
          },
          styles: { 
            fontSize: 9,
            font: 'helvetica',
            cellPadding: 3
          },
          columnStyles: { 
            3: { halign: 'right' }
          }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }
    }

    // ===== SEÇÃO 5 — OBSERVAÇÕES FISCAIS =====
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 46, 152);
    doc.text('Observacoes Fiscais', margin, yPos);
    yPos += 12;
    
    addHorizontalLine(yPos - 5);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const obsText1 = 'Este relatorio possui finalidade organizacional e visa facilitar o envio das informacoes ao contador.';
    const obsText2 = 'Os valores apresentados devem ser analisados e validados por um profissional contabil antes de qualquer declaracao oficial.';
    
    doc.text(obsText1, margin, yPos, { maxWidth: contentWidth });
    yPos += 8;
    doc.text(obsText2, margin, yPos, { maxWidth: contentWidth });
    yPos += 15;
    
    // Rodapé em todas as páginas
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('Gerado pelo sistema Agendaris', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Nome do arquivo
    const fileName = pdfPeriodType === 'monthly' 
      ? `relatorio-fiscal-agendaris-${pdfSelectedMonth}.pdf`
      : `relatorio-fiscal-agendaris-ano-${pdfSelectedYear}.pdf`;
    
    doc.save(fileName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A7FD] mx-auto mb-4"></div>
          <p className="text-[#5A4A5E]">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" style={{ backgroundColor: '#FCFCFD' }}>
      {/* Cabeçalho */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[#5A2E98]">Relatório Fiscal</h1>
            <p className="text-[#5A4A5E] text-lg mt-1">
              Resumo financeiro organizado para facilitar a declaração de impostos
            </p>
          </div>
          <Button
            onClick={() => setShowPDFConfigModal(true)}
            className="gap-2 rounded-full"
            style={{ backgroundColor: '#8E44EC', color: 'white' }}
          >
            <Download className="h-4 w-4" />
            Exportar Relatório em PDF
          </Button>
        </div>
        
        {/* Botão Detalhamento Receita */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setShowReceitaDetalhamento(!showReceitaDetalhamento)}
            variant={showReceitaDetalhamento ? "default" : "outline"}
            className="gap-2"
            style={showReceitaDetalhamento ? { backgroundColor: '#8E44EC', color: 'white' } : {}}
          >
            <FileText className="h-4 w-4" />
            Detalhamento Receita
          </Button>
        </div>
      </div>

      {/* Seletor de Regime Tributário */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[#5A4A5E]">Regime Tributário:</span>
            <RadioGroup value={taxRegime} onValueChange={(value: 'MEI' | 'Simples Nacional') => setTaxRegime(value)} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MEI" id="regime-mei" />
                <Label htmlFor="regime-mei" className="cursor-pointer font-normal text-[#5A4A5E]">
                  MEI
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Simples Nacional" id="regime-simples" disabled />
                <Label htmlFor="regime-simples" className="cursor-pointer font-normal text-[#5A4A5E] opacity-50">
                  Simples Nacional (em breve)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Cards do MEI - Mostrar apenas quando Detalhamento Receita estiver fechado */}
      {taxRegime === 'MEI' && !showReceitaDetalhamento && (
        <>
          {/* Card Principal - Limite do MEI */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
            <CardHeader>
              <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
                Limite de Faturamento MEI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Valor fixo do limite */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Limite anual</p>
                <p className="text-3xl font-bold" style={{ color: '#8E44EC' }}>
                  {formatCurrency(MEI_LIMIT)}
                </p>
              </div>

              {/* Barra de progresso */}
              <div className="space-y-2">
                <Progress 
                  value={Math.min(meiUsagePercentage, 100)} 
                  className="h-6"
                  style={{ 
                    backgroundColor: '#E9D5FF',
                  }}
                />
                <div className="flex justify-between text-sm">
                  <span className="font-medium" style={{ color: '#5A2E98' }}>
                    {meiUsagePercentage.toFixed(1)}% utilizado
                  </span>
                  <span className="text-muted-foreground">
                    Restante: {formatCurrency(Math.max(0, remainingLimit))}
                  </span>
                </div>
              </div>

              {/* Informações abaixo da barra */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: '#F7D5E8' }}>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Faturamento acumulado</p>
                  <p className="text-lg font-bold" style={{ color: '#5A2E98' }}>
                    {formatCurrency(annualGrossRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Limite restante</p>
                  <p className="text-lg font-bold" style={{ color: remainingLimit > 0 ? '#16A34A' : '#DC2626' }}>
                    {formatCurrency(Math.max(0, remainingLimit))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Percentual utilizado</p>
                  <p className="text-lg font-bold" style={{ color: meiUsagePercentage > 90 ? '#DC2626' : meiUsagePercentage > 70 ? '#EA580C' : '#5A2E98' }}>
                    {meiUsagePercentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Mensagem inteligente */}
              {meiAlert && (
                <div 
                  className="p-4 rounded-lg flex items-start gap-3"
                  style={{ 
                    backgroundColor: meiAlert.bgColor,
                    border: `1px solid ${meiAlert.borderColor}`
                  }}
                >
                  <meiAlert.icon className="h-5 w-5 mt-0.5" style={{ color: meiAlert.textColor }} />
                  <p className="text-sm font-medium flex-1" style={{ color: meiAlert.textColor }}>
                    {meiAlert.message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card - Faturamento Mensal */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
            <CardHeader>
              <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
                📆 Faturamento Mensal – Ano Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(monthlyRevenue).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum faturamento registrado no ano atual
                </p>
              ) : (
                <div className="border rounded-lg" style={{ borderRadius: '12px' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Faturamento Bruto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(monthlyRevenue)
                        .sort(([monthA], [monthB]) => {
                          const parseMonth = (monthStr: string) => {
                            const [monthName, year] = monthStr.split(' ');
                            const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                            const monthIndex = monthNames.indexOf(monthName.toLowerCase());
                            return new Date(parseInt(year), monthIndex);
                          };
                          return parseMonth(monthA).getTime() - parseMonth(monthB).getTime();
                        })
                        .map(([month, revenue]) => (
                          <TableRow key={month}>
                            <TableCell className="capitalize">{month}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {/* Informações complementares sobre média mensal */}
              {Object.keys(monthlyRevenue).length > 0 && taxRegime === 'MEI' && (
                <div className="mt-6 pt-6 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Média Mensal */}
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                      <p className="text-sm text-muted-foreground mb-1">Média Mensal de Faturamento</p>
                      <p className="text-xl font-bold" style={{ color: '#5A2E98' }}>
                        {formatCurrency(monthlyAverageWithCurrent)}
                      </p>
                    </div>
                    
                    {/* Faturamento Máximo Mensal MEI */}
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC' }}>
                      <p className="text-sm text-muted-foreground mb-1">Faturamento Máximo Mensal MEI</p>
                      <p className="text-xl font-bold" style={{ color: '#16A34A' }}>
                        {formatCurrency(MEI_LIMIT / 12)}
                      </p>
                    </div>
                    
                    {/* Porcentagem */}
                    <div className={`p-4 rounded-lg ${(monthlyAverageWithCurrent / (MEI_LIMIT / 12)) * 100 > 90 ? 'bg-red-50 border border-red-200' : (monthlyAverageWithCurrent / (MEI_LIMIT / 12)) * 100 > 70 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                      <p className="text-sm text-muted-foreground mb-1">% da Média em relação ao Máximo MEI</p>
                      <p className={`text-xl font-bold ${(monthlyAverageWithCurrent / (MEI_LIMIT / 12)) * 100 > 90 ? 'text-red-600' : (monthlyAverageWithCurrent / (MEI_LIMIT / 12)) * 100 > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {((monthlyAverageWithCurrent / (MEI_LIMIT / 12)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card - O que entra no cálculo do MEI (Educativo) */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: '#F0FDF4', border: '1px solid #86EFAC' }}>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2" style={{ color: '#5A2E98' }}>
                <Info className="h-5 w-5" />
                O que conta para o limite do MEI?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium mb-2" style={{ color: '#166534' }}>✔️ O que conta:</p>
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: '#166534' }}>
                  <li>Serviços realizados</li>
                  <li>Serviços pagos com desconto</li>
                  <li>Serviços pagos com cartão (valor cheio)</li>
                  <li>Valores pagos a parceiros (comissão não desconta do limite)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2" style={{ color: '#991B1B' }}>❌ O que NÃO reduz o limite:</p>
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: '#991B1B' }}>
                  <li>Taxa da maquininha</li>
                  <li>Comissão paga a parceiros</li>
                  <li>Despesas do salão</li>
                  <li>DAS MEI</li>
                  <li>Pró-labore</li>
                </ul>
              </div>
              <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}>
                <p className="text-sm font-medium" style={{ color: '#166534' }}>
                  O limite do MEI é calculado sobre o faturamento bruto, independentemente das despesas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card - Projeção */}
          {monthlyAverage > 0 && (
            <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2" style={{ color: '#5A2E98' }}>
                  🔮 Projeção de Faturamento Anual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Radio buttons para seleção de ano */}
                <div className="pb-4 border-b">
                  <RadioGroup 
                    value={projectionYear} 
                    onValueChange={(value: 'current' | 'next') => setProjectionYear(value)} 
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="projection-current" />
                      <Label htmlFor="projection-current" className="cursor-pointer font-normal">
                        Ano Atual ({new Date().getFullYear()})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="next" id="projection-next" />
                      <Label htmlFor="projection-next" className="cursor-pointer font-normal">
                        Próximo Ano ({new Date().getFullYear() + 1})
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#FAF5FF' }}>
                  <p className="text-sm text-muted-foreground mb-2">
                    {projectionYear === 'current' 
                      ? `Mantendo o ritmo atual, seu faturamento estimado para ${new Date().getFullYear()} é:`
                      : `Com base na média dos últimos meses, seu faturamento estimado para ${new Date().getFullYear() + 1} é:`
                    }
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#8E44EC' }}>
                    {formatCurrency(projectedAnnual)}
                  </p>
                </div>
                {projectedAnnual > MEI_LIMIT && (
                  <div 
                    className="p-4 rounded-lg flex items-start gap-3"
                    style={{ 
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5'
                    }}
                  >
                    <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: '#991B1B' }} />
                    <p className="text-sm font-medium flex-1" style={{ color: '#991B1B' }}>
                      ⚠️ Se mantiver esse ritmo, você pode ultrapassar o limite do MEI.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Aba Detalhamento de Receita */}
      {showReceitaDetalhamento && (
        <>
          {/* Filtros */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#5A4A5E]">Período:</span>
                  <Select 
                    value={periodFilter} 
                    onValueChange={(value) => {
                      // Salvar posição atual de scroll antes de mudar o filtro
                      scrollPositionRef.current = window.scrollY;
                      shouldRestoreScrollRef.current = true;
                      
                      setPeriodFilter(value);
                      if (value !== 'custom') {
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px] border-[#F7D5E8] focus:border-[#C9A7FD]" style={{ borderRadius: '12px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="currentMonth">Mês atual</SelectItem>
                      <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                      <SelectItem value="last6Months">Últimos 6 meses</SelectItem>
                      <SelectItem value="last9Months">Últimos 9 meses</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  {periodFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          scrollPositionRef.current = window.scrollY;
                          shouldRestoreScrollRef.current = true;
                          setCustomStartDate(e.target.value);
                        }}
                        className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                        style={{ borderRadius: '12px' }}
                      />
                      <span className="text-sm text-[#5A4A5E]">até</span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          scrollPositionRef.current = window.scrollY;
                          shouldRestoreScrollRef.current = true;
                          setCustomEndDate(e.target.value);
                        }}
                        className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                        style={{ borderRadius: '12px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1. Detalhamento de Receita */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
            1. Detalhamento de Receita
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Card Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#F0FDF4' }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Receita Bruta</p>
                    <p className="text-xl font-bold" style={{ color: '#16A34A' }}>
                      {formatCurrency(grossIncome)}
                    </p>
                  </div>
                  <DollarSign className="h-5 w-5" style={{ color: '#16A34A' }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Botão para ver todos lançamentos */}
          {taxableIncome.length > 0 ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setModalIncomePeriodFilter(periodFilter);
                  setModalIncomeCustomStartDate(customStartDate);
                  setModalIncomeCustomEndDate(customEndDate);
                  setShowIncomeModal(true);
                }}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Ver todos lançamentos ({taxableIncome.length})
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma receita encontrada no período selecionado
            </div>
          )}
        </CardContent>
      </Card>

          {/* 2. Custos Fixos */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
            2. Custos Fixos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(fixedCosts.byCategory).length === 0 ? (
              <p className="text-muted-foreground col-span-full">Nenhum custo fixo encontrado no período selecionado</p>
            ) : (
              Object.entries(fixedCosts.byCategory).map(([category, amount]) => (
                <Card key={category} className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#FCFCFD' }}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">{category}</p>
                    <p className="text-lg font-bold text-[#5A2E98]">{formatCurrency(amount)}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Card className="border-2" style={{ borderRadius: '15px', borderColor: '#8E44EC', backgroundColor: '#FAF5FF' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-[#5A2E98]">Total de Custos Fixos</p>
                <p className="text-2xl font-bold text-[#8E44EC]">{formatCurrency(fixedCosts.total)}</p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* 3. Custos Variáveis / Despesas Operacionais */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
            3. Custos Variáveis / Despesas Operacionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(variableCosts.byCategory).length === 0 ? (
              <p className="text-muted-foreground col-span-full">Nenhum custo variável encontrado no período selecionado</p>
            ) : (
              Object.entries(variableCosts.byCategory).map(([category, amount]) => (
                <Card key={category} className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#FCFCFD' }}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">{category}</p>
                    <p className="text-lg font-bold text-[#5A2E98]">{formatCurrency(amount)}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Card className="border-2" style={{ borderRadius: '15px', borderColor: '#EB67A3', backgroundColor: '#FDF2F8' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-[#5A2E98]">Total de Custos Variáveis</p>
                <p className="text-2xl font-bold" style={{ color: '#EB67A3' }}>{formatCurrency(variableCosts.total)}</p>
              </div>
            </CardContent>
          </Card>
          
          {variableCosts.items.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setModalPeriodFilter(periodFilter);
                  setModalCustomStartDate(customStartDate);
                  setModalCustomEndDate(customEndDate);
                  setShowVariableCostsModal(true);
                }}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Ver todos lançamentos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Resumo Fiscal Final */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
            4. Resumo Fiscal Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#F0FDF4' }}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Receita Bruta Total</p>
                <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>
                  {formatCurrency(grossIncome)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#FEF2F2' }}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">(-) Custos Fixos</p>
                <p className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                  {formatCurrency(fixedCosts.total)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" style={{ borderRadius: '15px', backgroundColor: '#FEF2F2' }}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">(-) Custos Variáveis</p>
                <p className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                  {formatCurrency(variableCosts.total)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-2" style={{ borderRadius: '15px', borderColor: operatingResult >= 0 ? '#16A34A' : '#DC2626', backgroundColor: operatingResult >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Resultado Operacional</p>
                <p className="text-2xl font-bold" style={{ color: operatingResult >= 0 ? '#16A34A' : '#DC2626' }}>
                  {formatCurrency(operatingResult)}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
            <p className="text-sm text-[#92400E]">
              <strong>Observação:</strong> Valores organizados para conferência contábil. Consulte seu contador para apuração final de impostos.
            </p>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Modal de Custos Variáveis */}
      <Dialog open={showVariableCostsModal} onOpenChange={setShowVariableCostsModal}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl" style={{ color: '#5A2E98' }}>
              Custos Variáveis / Despesas Operacionais
            </DialogTitle>
          </DialogHeader>
          
          {/* Filtros do Modal */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#5A4A5E]">Período:</span>
                <Select 
                  value={modalPeriodFilter} 
                  onValueChange={(value) => {
                    setModalPeriodFilter(value);
                    if (value !== 'custom') {
                      setModalCustomStartDate('');
                      setModalCustomEndDate('');
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] border-[#F7D5E8] focus:border-[#C9A7FD]" style={{ borderRadius: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currentMonth">Mês atual</SelectItem>
                    <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                    <SelectItem value="last6Months">Últimos 6 meses</SelectItem>
                    <SelectItem value="last9Months">Últimos 9 meses</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {modalPeriodFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={modalCustomStartDate}
                      onChange={(e) => setModalCustomStartDate(e.target.value)}
                      className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                      style={{ borderRadius: '12px' }}
                    />
                    <span className="text-sm text-[#5A4A5E]">até</span>
                    <Input
                      type="date"
                      value={modalCustomEndDate}
                      onChange={(e) => setModalCustomEndDate(e.target.value)}
                      className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                      style={{ borderRadius: '12px' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Lançamentos */}
            <ScrollArea className="h-[50vh] pr-4">
              {isLoadingModal ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Carregando...</div>
                </div>
              ) : modalVariableCostsTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nenhum lançamento encontrado no período selecionado</p>
                </div>
              ) : (
                <div className="border rounded-lg" style={{ borderRadius: '12px' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modalVariableCostsTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatTransactionDate(transaction.transaction_date)}</TableCell>
                          <TableCell className="font-medium">{transaction.category || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{transaction.description || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Math.abs(Number(transaction.amount)))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ScrollArea>

            {/* Total */}
            {modalVariableCostsTransactions.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-[#5A2E98]">Total:</span>
                  <span className="text-2xl font-bold" style={{ color: '#EB67A3' }}>
                    {formatCurrency(
                      modalVariableCostsTransactions.reduce(
                        (sum, t) => sum + Math.abs(Number(t.amount)),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Receita */}
      <Dialog open={showIncomeModal} onOpenChange={setShowIncomeModal}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl" style={{ color: '#5A2E98' }}>
              Detalhamento de Receita
            </DialogTitle>
          </DialogHeader>
          
          {/* Filtros do Modal */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#5A4A5E]">Período:</span>
                <Select 
                  value={modalIncomePeriodFilter} 
                  onValueChange={(value) => {
                    setModalIncomePeriodFilter(value);
                    if (value !== 'custom') {
                      setModalIncomeCustomStartDate('');
                      setModalIncomeCustomEndDate('');
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] border-[#F7D5E8] focus:border-[#C9A7FD]" style={{ borderRadius: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currentMonth">Mês atual</SelectItem>
                    <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                    <SelectItem value="last6Months">Últimos 6 meses</SelectItem>
                    <SelectItem value="last9Months">Últimos 9 meses</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {modalIncomePeriodFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={modalIncomeCustomStartDate}
                      onChange={(e) => setModalIncomeCustomStartDate(e.target.value)}
                      className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                      style={{ borderRadius: '12px' }}
                    />
                    <span className="text-sm text-[#5A4A5E]">até</span>
                    <Input
                      type="date"
                      value={modalIncomeCustomEndDate}
                      onChange={(e) => setModalIncomeCustomEndDate(e.target.value)}
                      className="w-[150px] border-[#F7D5E8] focus:border-[#C9A7FD]"
                      style={{ borderRadius: '12px' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Lançamentos */}
            <ScrollArea className="h-[50vh] pr-4">
              {isLoadingIncomeModal ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Carregando...</div>
                </div>
              ) : modalIncomeTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nenhum lançamento encontrado no período selecionado</p>
                </div>
              ) : (
                <div className="border rounded-lg" style={{ borderRadius: '12px' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço/Produto</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modalIncomeTransactions.map((transaction) => {
                        const appointment = (transaction as any).appointments;
                        const clientName = appointment?.client_name || 'N/A';
                        const serviceName = appointment?.services?.name || transaction.description || 'N/A';
                        // Usar o valor bruto já descontado (total_amount ou price)
                        const grossValue = appointment?.total_amount 
                          ? Number(appointment.total_amount) 
                          : (appointment?.services?.price ? Number(appointment.services.price) : Number(transaction.amount));

                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatTransactionDate(transaction.transaction_date)}</TableCell>
                            <TableCell>{clientName}</TableCell>
                            <TableCell>{serviceName}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(grossValue)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ScrollArea>

            {/* Total */}
            {modalIncomeTransactions.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-[#5A2E98]">Receita Bruta Total:</span>
                  <span className="text-2xl font-bold" style={{ color: '#16A34A' }}>
                    {formatCurrency(
                      modalIncomeTransactions.reduce((sum, t) => {
                        const appointment = (t as any).appointments;
                        // Usar o valor bruto já descontado (total_amount ou price)
                        const grossValue = appointment?.total_amount 
                          ? Number(appointment.total_amount) 
                          : (appointment?.services?.price ? Number(appointment.services.price) : Number(t.amount));
                        return sum + grossValue;
                      }, 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração do PDF */}
      <Dialog open={showPDFConfigModal} onOpenChange={setShowPDFConfigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl" style={{ color: '#5A2E98' }}>
              Exportar Relatório Fiscal
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tipo de Período</Label>
              <RadioGroup 
                value={pdfPeriodType} 
                onValueChange={(value: 'monthly' | 'annual') => setPdfPeriodType(value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="period-monthly" />
                  <Label htmlFor="period-monthly" className="cursor-pointer font-normal">
                    Mensal
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="period-annual" />
                  <Label htmlFor="period-annual" className="cursor-pointer font-normal">
                    Anual
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {pdfPeriodType === 'monthly' && (
              <div className="space-y-2">
                <Label htmlFor="pdf-month">Mês e Ano</Label>
                <Input
                  id="pdf-month"
                  type="month"
                  value={pdfSelectedMonth}
                  onChange={(e) => setPdfSelectedMonth(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            {pdfPeriodType === 'annual' && (
              <div className="space-y-2">
                <Label htmlFor="pdf-year">Ano</Label>
                <Select value={pdfSelectedYear} onValueChange={setPdfSelectedYear}>
                  <SelectTrigger id="pdf-year" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-all-transactions"
                  checked={pdfIncludeAllTransactions}
                  onCheckedChange={(checked) => setPdfIncludeAllTransactions(checked === true)}
                />
                <Label htmlFor="include-all-transactions" className="cursor-pointer font-normal text-sm">
                  Incluir todas transações (detalhamento cliente a cliente)
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPDFConfigModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await handleExportPDF();
                    toast({
                      title: 'PDF gerado com sucesso!',
                      description: 'O relatório fiscal foi exportado com sucesso.',
                    });
                    setShowPDFConfigModal(false);
                  } catch (error: any) {
                    console.error('Erro ao gerar PDF:', error);
                    toast({
                      title: 'Erro ao gerar PDF',
                      description: error?.message || 'Ocorreu um erro ao gerar o relatório. Tente novamente.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="gap-2"
                style={{ backgroundColor: '#8E44EC', color: 'white' }}
              >
                <Download className="h-4 w-4" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioFiscal;

