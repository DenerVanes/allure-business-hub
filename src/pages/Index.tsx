import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Eye,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { TodaySchedule } from '@/components/TodaySchedule';
import { MetricCard } from '@/components/MetricCard';
import { FinanceModal } from '@/components/FinanceModal';
import { NewClientModal } from '@/components/NewClientModal';
import { CollaboratorModal } from '@/components/CollaboratorModal';
import { StockAlertModal } from '@/components/StockAlertModal';
import { AppointmentsStatusModal } from '@/components/AppointmentsStatusModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isThisMonth } from 'date-fns';
import { getBrazilianDate, convertToSupabaseDate } from '@/utils/timezone';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Verificar se há token de recuperação na URL e redirecionar
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      // Redirecionar para a página de reset de senha com o hash
      navigate(`/reset-password${window.location.hash}`, { replace: true });
    }
  }, [navigate]);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeModalType, setFinanceModalType] = useState<'income' | 'expense'>('income');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [showStockAlertModal, setShowStockAlertModal] = useState(false);
  const [showAllAppointmentsModal, setShowAllAppointmentsModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showConfirmedModal, setShowConfirmedModal] = useState(false);
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name, price, duration),
          clients (name, phone),
          collaborators (name)
        `)
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
  const todayCanceledAppointments = todayAppointments.filter(apt => apt.status === 'cancelado');
  
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
    <div className="space-y-6 p-4">
      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Agendamentos Hoje"
          value={todayAppointments.length}
          icon={Calendar}
          description="Total de agendamentos do dia"
          action={
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full rounded-full"
              style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
              onClick={() => setShowAllAppointmentsModal(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Tudo
            </Button>
          }
        />
        <MetricCard
          title="A Confirmar"
          value={todayPendingAppointments.length}
          icon={AlertTriangle}
          description="Aguardando confirmação"
          action={
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowPendingModal(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Tudo
            </Button>
          }
        />
        <MetricCard
          title="Confirmados"
          value={todayConfirmedAppointments.length}
          icon={CheckCircle}
          description="Clientes confirmados"
          action={
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowConfirmedModal(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Tudo
            </Button>
          }
        />
        <MetricCard
          title="Finalizados"
          value={todayFinalizedAppointments.length}
          icon={TrendingUp}
          description="Atendimentos concluídos"
          action={
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowFinalizedModal(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Tudo
            </Button>
          }
        />
        <MetricCard
          title="Cancelados"
          value={todayCanceledAppointments.length}
          icon={XCircle}
          description="Agendamentos cancelados"
          action={
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowCanceledModal(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Tudo
            </Button>
          }
        />
      </div>

      {/* Today Schedule - full width row */}
      <div className="w-full">
        <TodaySchedule />
      </div>
      
      {/* Bottom cards row - Stock Alerts and Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card 
          className="border-0 shadow-md"
          style={{ borderRadius: '20px' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#5A2E98' }}>
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: '#FDE68A' }}
              >
                <Package className="h-5 w-5" style={{ color: '#F59E0B' }} />
              </div>
              Alertas de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm" style={{ color: '#5A2E98' }}>
                    Produtos com estoque baixo
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#5A4A5E' }}>
                    {lowStockProducts.length} produtos precisam de atenção
                  </p>
                </div>
                <Badge 
                  className="text-xs px-2 py-1"
                  style={{ 
                    backgroundColor: lowStockProducts.length > 0 ? '#FECDD3' : '#E5E7EB',
                    color: lowStockProducts.length > 0 ? '#EF4444' : '#9CA3AF'
                  }}
                >
                  {lowStockProducts.length}
                </Badge>
              </div>
              
              <Button 
                onClick={() => setShowStockAlertModal(true)}
                variant="outline" 
                className="w-full rounded-full"
                style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Produtos
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-md"
          style={{ borderRadius: '20px' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#5A2E98' }}>
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: '#DBEAFE' }}
              >
                <TrendingUp className="h-5 w-5" style={{ color: '#3B82F6' }} />
              </div>
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                  Receitas do Mês
                </span>
                <span className="text-sm font-semibold" style={{ color: '#10B981' }}>
                  R$ {monthlyIncome.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                  Despesas do Mês
                </span>
                <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                  R$ {monthlyExpenses.toFixed(2)}
                </span>
              </div>
              <div 
                className="border-t pt-3 mt-2"
                style={{ borderColor: '#F7D5E8' }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm" style={{ color: '#5A2E98' }}>
                    Saldo do Mês
                  </span>
                  <span 
                    className="font-bold text-base"
                    style={{ 
                      color: monthlyIncome - monthlyExpenses >= 0 ? '#10B981' : '#EF4444'
                    }}
                  >
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

      <AppointmentsStatusModal
        open={showAllAppointmentsModal}
        onOpenChange={setShowAllAppointmentsModal}
        status="all"
        title="Todos os Agendamentos de Hoje"
        appointmentsOverride={todayAppointments}
      />

      <AppointmentsStatusModal
        open={showPendingModal}
        onOpenChange={setShowPendingModal}
        status="agendado"
        title="Agendamentos a Confirmar"
        appointmentsOverride={todayPendingAppointments}
      />

      <AppointmentsStatusModal
        open={showConfirmedModal}
        onOpenChange={setShowConfirmedModal}
        status="confirmado"
        title="Agendamentos Confirmados"
        appointmentsOverride={todayConfirmedAppointments}
      />

      <AppointmentsStatusModal
        open={showFinalizedModal}
        onOpenChange={setShowFinalizedModal}
        status="finalizado"
        title="Agendamentos Finalizados"
        appointmentsOverride={todayFinalizedAppointments}
      />

      <AppointmentsStatusModal
        open={showCanceledModal}
        onOpenChange={setShowCanceledModal}
        status="cancelado"
        title="Agendamentos Cancelados"
        appointmentsOverride={todayCanceledAppointments}
      />
    </div>
  );
};

export default Index;
