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
import { isToday, isThisMonth } from 'date-fns';

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
  const todayAppointments = appointments.filter(a => isToday(new Date(a.appointment_date)));
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Agendamentos Hoje"
          value={todayAppointments.length}
          icon={Calendar}
          color="blue"
        />
        <MetricCard
          title="Receitas do Mês"
          value={`R$ ${monthlyIncome.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Despesas do Mês"
          value={`R$ ${monthlyExpenses.toFixed(2)}`}
          icon={TrendingDown}
          color="red"
        />
        <MetricCard
          title="Total de Clientes"
          value={clients.length}
          icon={Users}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodaySchedule />
        
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => openFinanceModal('income')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Receita
            </Button>
            
            <Button 
              onClick={() => openFinanceModal('expense')}
              variant="destructive"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Despesa
            </Button>
            
            <Button 
              onClick={() => setShowNewClientModal(true)}
              variant="outline"
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
            
            <Button 
              onClick={() => setShowCollaboratorModal(true)}
              variant="outline"
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              Novo Colaborador
            </Button>
          </CardContent>
        </Card>
      </div>

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
