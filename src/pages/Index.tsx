import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  DollarSign, 
  Package, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Plus,
  Eye
} from 'lucide-react';
import { TodaySchedule } from '@/components/TodaySchedule';
import { MetricCard } from '@/components/MetricCard';
import { FinanceModal } from '@/components/FinanceModal';
import { NewClientModal } from '@/components/NewClientModal';
import { CollaboratorModal } from '@/components/CollaboratorModal';
import { StockAlertModal } from '@/components/StockAlertModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isThisMonth } from 'date-fns';
import { getBrazilianDate, convertToSupabaseDate } from '@/utils/timezone';

const Index = () => {
  const { user } = useAuth();
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeModalType, setFinanceModalType] = useState<'income' | 'expense'>('income');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [showStockAlertModal, setShowStockAlertModal] = useState(false);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['financial-transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

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

  const { data: products = [] } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Cálculos das métricas
  // Obter data de hoje no formato YYYY-MM-DD usando timezone brasileiro
  const todayString = convertToSupabaseDate(getBrazilianDate());
  
  const todayAppointments = appointments.filter(appointment => {
    // Comparar apenas a string da data, ignorando timezone
    return appointment.appointment_date === todayString;
  });
  
  // Agendamentos por status do dia atual
  const todayPendingAppointments = todayAppointments.filter(apt => apt.status === 'agendado');
  const todayConfirmedAppointments = todayAppointments.filter(apt => apt.status === 'confirmado');
  const todayFinalizedAppointments = todayAppointments.filter(apt => apt.status === 'finalizado');
  
  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && isThisMonth(new Date(t.transaction_date)))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && isThisMonth(new Date(t.transaction_date)))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.min_quantity);

  const openFinanceModal = (type: 'income' | 'expense') => {
    setFinanceModalType(type);
    setShowFinanceModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Agendamentos Hoje"
          value={todayAppointments.length}
          icon={Calendar}
          description="Total de agendamentos do dia"
        />
        <MetricCard
          title="A Confirmar"
          value={todayPendingAppointments.length}
          icon={AlertTriangle}
          description="Aguardando confirmação"
        />
        <MetricCard
          title="Confirmados"
          value={todayConfirmedAppointments.length}
          icon={Users}
          description="Clientes confirmados"
        />
        <MetricCard
          title="Finalizados"
          value={todayFinalizedAppointments.length}
          icon={TrendingUp}
          description="Atendimentos concluídos"
        />
      </div>

      {/* Today Schedule - full width row */}
      <div className="w-full">
        <TodaySchedule />
      </div>
      
      {/* Bottom cards row - Stock Alerts and Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-yellow-600" />
              Alertas de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Produtos com estoque baixo</p>
                  <p className="text-sm text-muted-foreground">
                    {lowStockProducts.length} produtos precisam de atenção
                  </p>
                </div>
                <Badge variant={lowStockProducts.length > 0 ? "destructive" : "default"}>
                  {lowStockProducts.length}
                </Badge>
              </div>
              
              <Button 
                onClick={() => setShowStockAlertModal(true)}
                variant="outline" 
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Produtos
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Receitas do Mês</span>
                <span className="text-green-600 font-semibold">R$ {monthlyIncome.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Despesas do Mês</span>
                <span className="text-red-600 font-semibold">R$ {monthlyExpenses.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Saldo do Mês</span>
                  <span className={`font-bold ${monthlyIncome - monthlyExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    R$ {(monthlyIncome - monthlyExpenses).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FinanceModal
        open={showFinanceModal}
        onOpenChange={setShowFinanceModal}
        type={financeModalType}
      />

      <NewClientModal
        open={showNewClientModal}
        onOpenChange={setShowNewClientModal}
      />

      <CollaboratorModal
        open={showCollaboratorModal}
        onOpenChange={setShowCollaboratorModal}
      />

      <StockAlertModal
        open={showStockAlertModal}
        onOpenChange={setShowStockAlertModal}
      />
    </div>
  );
};

export default Index;
