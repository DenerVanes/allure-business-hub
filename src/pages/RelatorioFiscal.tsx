import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, Package, CreditCard, Receipt, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTransactionDate, getBrazilianDate } from '@/utils/timezone';
import type { Database } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // Receita bruta total
  const grossIncome = useMemo(() => {
    return taxableIncome.reduce((sum, t) => {
      const appointment = (t as any).appointments;
      // Se tiver appointment com serviço, usar o preço original do serviço como bruto
      if (appointment?.services?.price) {
        return sum + Number(appointment.services.price);
      }
      // Se não tiver serviço, usar o valor da transação como bruto (sem desconto)
      return sum + Number(t.amount);
    }, 0);
  }, [taxableIncome]);

  // Total de descontos
  const totalDiscounts = useMemo(() => {
    return taxableIncome.reduce((sum, t) => {
      const appointment = (t as any).appointments;
      // Calcular desconto: preço original do serviço - valor final pago
      if (appointment?.services?.price) {
        const servicePrice = Number(appointment.services.price);
        // O valor final pode estar no appointment.total_amount ou na transaction.amount
        const finalAmount = Number(appointment.total_amount || t.amount);
        const discount = servicePrice - finalAmount;
        return sum + (discount > 0 ? discount : 0);
      }
      return sum;
    }, 0);
  }, [taxableIncome]);

  // Receita líquida tributável
  const netTaxableIncome = grossIncome - totalDiscounts;

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
      // Usar sempre o preço original do serviço (valor bruto)
      if (appointment?.services?.price) {
        return sum + Number(appointment.services.price);
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
  const monthlyRevenue = useMemo(() => {
    if (taxRegime !== 'MEI') return {};
    
    const monthly: Record<string, number> = {};
    
    annualTransactions.forEach(t => {
      const appointment = (t as any).appointments;
      const transactionDate = new Date(t.transaction_date + 'T00:00:00');
      const monthKey = format(transactionDate, 'MMMM yyyy', { locale: ptBR });
      
      const grossValue = appointment?.services?.price 
        ? Number(appointment.services.price) 
        : Number(t.amount);
      
      monthly[monthKey] = (monthly[monthKey] || 0) + grossValue;
    });
    
    return monthly;
  }, [annualTransactions, taxRegime]);

  // Calcular média mensal e projeção anual
  const monthlyAverage = useMemo(() => {
    if (taxRegime !== 'MEI' || Object.keys(monthlyRevenue).length === 0) return 0;
    const totalMonths = Object.keys(monthlyRevenue).length;
    const totalRevenue = Object.values(monthlyRevenue).reduce((sum, val) => sum + val, 0);
    return totalRevenue / totalMonths;
  }, [monthlyRevenue, taxRegime]);

  const projectedAnnual = monthlyAverage * 12;

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
        .select('business_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Logo e cabeçalho
    doc.setFontSize(20);
    doc.text('Agendaris', 14, 20);
    doc.setFontSize(12);
    doc.text('Relatório Fiscal', 14, 30);
    
    // Nome do salão (se disponível)
    if (profile?.business_name) {
      doc.setFontSize(10);
      doc.text(`Salão: ${profile.business_name}`, 14, 38);
    }
    
    // Informações do período
    doc.setFontSize(10);
    const infoY = profile?.business_name ? 44 : 40;
    doc.text(`Período: ${format(new Date(start), 'dd/MM/yyyy')} a ${format(new Date(end), 'dd/MM/yyyy')}`, 14, infoY);
    doc.text(`Regime Tributário: ${taxRegime}`, 14, infoY + 6);
    doc.text(`Data de emissão: ${format(new Date(), 'dd/MM/yyyy')}`, 14, infoY + 12);
    
    let yPos = profile?.business_name ? 63 : 59;

    // Se for MEI, adicionar seção de limite MEI
    if (taxRegime === 'MEI') {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Limite de Faturamento MEI', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Limite anual: ${formatCurrency(MEI_LIMIT)}`, 20, yPos);
      yPos += 6;
      doc.text(`Faturamento acumulado: ${formatCurrency(annualGrossRevenue)}`, 20, yPos);
      yPos += 6;
      doc.text(`Percentual utilizado: ${meiUsagePercentage.toFixed(1)}%`, 20, yPos);
      yPos += 6;
      doc.text(`Limite restante: ${formatCurrency(Math.max(0, remainingLimit))}`, 20, yPos);
      yPos += 8;
      
      // Mensagem de alerta
      if (meiAlert) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.text(meiAlert.message, 20, yPos, { maxWidth: 180 });
        yPos += 12;
      }
      
      // Faturamento mensal
      if (Object.keys(monthlyRevenue).length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Faturamento Mensal - Ano Atual', 14, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        const monthlyTableData = Object.entries(monthlyRevenue)
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
          .map(([month, revenue]) => [
            month.charAt(0).toUpperCase() + month.slice(1),
            formatCurrency(revenue)
          ]);
        
        (doc as any).autoTable({
          startY: yPos,
          head: [['Mês', 'Faturamento Bruto']],
          body: monthlyTableData,
          theme: 'grid',
          headStyles: { fillColor: [138, 68, 236], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9 }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
        
        // Projeção anual
        if (monthlyAverage > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Projeção Anual', 14, yPos);
          yPos += 8;
          
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.text(`Faturamento anual estimado: ${formatCurrency(projectedAnnual)}`, 20, yPos);
          if (projectedAnnual > MEI_LIMIT) {
            yPos += 6;
            doc.setFont(undefined, 'italic');
            doc.text('⚠️ Se mantiver esse ritmo, você pode ultrapassar o limite do MEI.', 20, yPos);
            yPos += 8;
          }
        }
      }
      
      yPos += 10;
    }

    // 1. Detalhamento de Receita
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('1. Detalhamento de Receita', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Receita Bruta Total: ${formatCurrency(grossIncome)}`, 20, yPos);
    yPos += 10;

    // Tabela de receitas (sempre valores brutos para MEI)
    if (taxableIncome.length > 0) {
      const tableData = taxableIncome.map(t => {
        const appointment = (t as any).appointments;
        const clientName = appointment?.client_name || 'N/A';
        const serviceName = appointment?.services?.name || t.description || 'N/A';
        // Sempre usar o valor bruto (preço original do serviço) para MEI
        const grossValue = appointment?.services?.price ? Number(appointment.services.price) : Number(t.amount);
        
        return [
          format(new Date(t.transaction_date + 'T00:00:00'), 'dd/MM/yyyy'),
          clientName,
          serviceName,
          formatCurrency(grossValue)
        ];
      });

      (doc as any).autoTable({
        startY: yPos,
        head: [['Data', 'Cliente', 'Serviço/Produto', 'Valor Bruto']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [138, 68, 236], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // 2. Custos Fixos
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('2. Custos Fixos Dedutíveis', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    Object.entries(fixedCosts.byCategory).forEach(([category, amount]) => {
      doc.text(`${category}: ${formatCurrency(amount)}`, 20, yPos);
      yPos += 6;
    });
    
    doc.setFont(undefined, 'bold');
    doc.text(`Total de Custos Fixos: ${formatCurrency(fixedCosts.total)}`, 20, yPos);
    yPos += 10;

    // 3. Custos Variáveis
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('3. Custos Variáveis / Despesas Operacionais', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    Object.entries(variableCosts.byCategory).forEach(([category, amount]) => {
      doc.text(`${category}: ${formatCurrency(amount)}`, 20, yPos);
      yPos += 6;
    });
    
    doc.setFont(undefined, 'bold');
    doc.text(`Total de Custos Variáveis: ${formatCurrency(variableCosts.total)}`, 20, yPos);
    yPos += 10;

    // 4. Resumo Fiscal Final
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('4. Resumo Fiscal Final', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.text(`Receita Bruta Total: ${formatCurrency(grossIncome)}`, 20, yPos);
    yPos += 6;
    doc.text(`(-) Custos Fixos: ${formatCurrency(fixedCosts.total)}`, 20, yPos);
    yPos += 6;
    doc.text(`(-) Custos Variáveis: ${formatCurrency(variableCosts.total)}`, 20, yPos);
    yPos += 8;
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text(`Resultado Operacional: ${formatCurrency(operatingResult)}`, 20, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('Valores organizados para conferência contábil. Consulte seu contador para apuração final de impostos.', 14, yPos);
    
    doc.save(`Relatorio_Fiscal_${format(new Date(start), 'yyyy-MM-dd')}_${format(new Date(end), 'yyyy-MM-dd')}.pdf`);
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
            onClick={handleExportPDF}
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
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#FAF5FF' }}>
                  <p className="text-sm text-muted-foreground mb-2">
                    Mantendo o ritmo atual, seu faturamento anual estimado é:
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

          {/* Tabela Detalhada */}
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
                {taxableIncome.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma receita encontrada no período selecionado
                    </TableCell>
                  </TableRow>
                ) : (
                  taxableIncome.map((transaction) => {
                    const appointment = (transaction as any).appointments;
                    const clientName = appointment?.client_name || 'N/A';
                    const serviceName = appointment?.services?.name || transaction.description || 'N/A';
                    // Sempre usar o valor bruto (preço original do serviço) para MEI
                    const grossValue = appointment?.services?.price ? Number(appointment.services.price) : Number(transaction.amount);

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{formatTransactionDate(transaction.transaction_date)}</TableCell>
                        <TableCell>{clientName}</TableCell>
                        <TableCell>{serviceName}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(grossValue)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

          {/* 2. Custos Fixos Dedutíveis */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: 'white' }}>
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: '#5A2E98' }}>
            2. Custos Fixos Dedutíveis
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
    </div>
  );
};

export default RelatorioFiscal;

