import { MetricCard } from '@/components/MetricCard';
import { TodaySchedule } from '@/components/TodaySchedule';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  Plus,
  Eye,
  Users,
  Sparkles
} from 'lucide-react';

const Index = () => {
  // Mock data - em produção virá do banco de dados
  const monthlyRevenue = 'R$ 12.450,00';
  const monthlyAppointments = 89;
  const averageTicket = 'R$ 139,89';
  const lowStockItems = 3;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Olá, bem-vinda! 
            <Sparkles className="inline h-8 w-8 ml-2 text-primary animate-glow" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Aqui está um resumo do seu negócio hoje
          </p>
        </div>
        <Button variant="default" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Receita do Mês"
          value={monthlyRevenue}
          change="+12% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
          description="Julho 2024"
        />
        
        <MetricCard
          title="Agendamentos"
          value={monthlyAppointments}
          change="5 hoje"
          changeType="neutral"
          icon={Calendar}
          description="Este mês"
        />
        
        <MetricCard
          title="Ticket Médio"
          value={averageTicket}
          change="+8% vs mês anterior"
          changeType="positive"
          icon={TrendingUp}
          description="Por atendimento"
        />
        
        <MetricCard
          title="Alertas de Estoque"
          value={lowStockItems}
          change="Produtos em falta"
          changeType="negative"
          icon={AlertTriangle}
          description="Requer atenção"
          action={
            <Button variant="soft" size="sm" className="w-full text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Ver Produtos
            </Button>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <TodaySchedule />

        {/* Quick Actions */}
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="elegant" className="w-full justify-start gap-3">
              <Calendar className="h-4 w-4" />
              Novo Agendamento
            </Button>
            
            <Button variant="outline" className="w-full justify-start gap-3">
              <Users className="h-4 w-4" />
              Cadastrar Cliente
            </Button>
            
            <Button variant="outline" className="w-full justify-start gap-3">
              <Plus className="h-4 w-4" />
              Adicionar Serviço
            </Button>
            
            <Button variant="outline" className="w-full justify-start gap-3">
              <DollarSign className="h-4 w-4" />
              Registrar Receita
            </Button>
            
            <div className="pt-3 border-t border-border/30">
              <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                Ver todas as opções →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-full">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pagamento recebido</p>
                  <p className="text-xs text-muted-foreground">Maria Silva - Corte + Escova</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-600">R$ 85,00</p>
                <p className="text-xs text-muted-foreground">há 2 horas</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Novo agendamento</p>
                  <p className="text-xs text-muted-foreground">Ana Costa - Manicure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Amanhã 10:30</p>
                <p className="text-xs text-muted-foreground">há 3 horas</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-full">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Estoque baixo</p>
                  <p className="text-xs text-muted-foreground">Shampoo Hidratante - 2 unidades</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-orange-600">Crítico</p>
                <p className="text-xs text-muted-foreground">ontem</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
