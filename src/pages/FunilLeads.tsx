import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  UserPlus, 
  Flame, 
  TrendingUp, 
  Search, 
  Filter, 
  FileDown,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadKanbanColumn } from '@/components/crm/LeadKanbanColumn';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { LeadDetailModal } from '@/components/crm/LeadDetailModal';
import { LeadsListModal } from '@/components/crm/LeadsListModal';
import { generateLeadsPdf } from '@/utils/leadsPdfExport';

export interface Lead {
  id: string;
  salon_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  neighborhood: string | null;
  instagram: string | null;
  status: string;
  heat_score: number;
  origin: string | null;
  first_contact_date: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  next_action_description: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  novo_lead: { label: 'Novo Lead', color: '#3B82F6', icon: UserPlus },
  contato_realizado: { label: 'Contato Realizado', color: '#8B5CF6', icon: Phone },
  aguardando_resposta: { label: 'Aguardando Resposta', color: '#F59E0B', icon: MessageSquare },
  interesse_medio: { label: 'Interesse Médio', color: '#EC4899', icon: TrendingUp },
  interesse_alto: { label: 'Interesse Alto', color: '#EF4444', icon: Flame },
  fechado: { label: 'Fechado', color: '#10B981', icon: Users },
  perdido: { label: 'Perdido', color: '#6B7280', icon: Users },
};

export default function FunilLeads() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterHeat, setFilterHeat] = useState<string>('all');
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showLeadsListModal, setShowLeadsListModal] = useState(false);
  const [leadsListStatus, setLeadsListStatus] = useState<'fechado' | 'perdido' | null>(null);

  // Configurar sensor com delay para permitir cliques
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requer movimento de 8px antes de iniciar drag
      },
    })
  );

  // Buscar leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('leads' as any)
        .select('*')
        .order('created_at', { ascending: false }));
      
      if (error) throw error;
      return (data as unknown as Lead[]) || [];
    },
    enabled: isAdmin
  });

  // Mutation para atualizar status do lead
  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await (supabase
        .from('leads' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Status atualizado',
        description: 'O lead foi movido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  });

  // Filtrar leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Busca por texto
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          lead.salon_name.toLowerCase().includes(query) ||
          lead.contact_name?.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query) ||
          lead.phone?.includes(query) ||
          lead.email?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtro por origem
      if (filterOrigin !== 'all' && lead.origin !== filterOrigin) return false;

      // Filtro por cidade
      if (filterCity !== 'all' && lead.city !== filterCity) return false;

      // Filtro por temperatura
      if (filterHeat !== 'all') {
        if (filterHeat === 'quente' && lead.heat_score < 70) return false;
        if (filterHeat === 'morno' && (lead.heat_score < 30 || lead.heat_score >= 70)) return false;
        if (filterHeat === 'frio' && lead.heat_score >= 30) return false;
      }

      return true;
    });
  }, [leads, searchQuery, filterOrigin, filterCity, filterHeat]);

  // Agrupar leads por status
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    Object.keys(statusConfig).forEach(status => {
      grouped[status] = filteredLeads.filter(lead => lead.status === status);
    });
    return grouped;
  }, [filteredLeads]);

  // Obter cidades únicas para filtro
  const uniqueCities = useMemo(() => {
    const cities = new Set(leads.map(l => l.city).filter(Boolean));
    return Array.from(cities).sort();
  }, [leads]);

  // Métricas
  const metrics = useMemo(() => {
    const total = leads.length;
    const contatados = leads.filter(l => l.status !== 'novo_lead').length;
    const quentes = leads.filter(l => l.heat_score >= 70).length;
    const convertidos = leads.filter(l => l.status === 'fechado').length;
    const taxaConversao = total > 0 ? ((convertidos / total) * 100).toFixed(1) : '0';
    
    return { total, contatados, quentes, convertidos, taxaConversao };
  }, [leads]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (!over) return;
    
    const leadId = active.id as string;
    const newStatus = over.id as string;
    
    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.status !== newStatus && statusConfig[newStatus as keyof typeof statusConfig]) {
      updateLeadStatusMutation.mutate({ leadId, newStatus });
    }
  };

  const activeLead = activeDragId ? leads.find(l => l.id === activeDragId) : null;

  // Proteção de rota
  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#8E44EC' }}></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 pb-8" style={{ backgroundColor: '#FCFCFD' }}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-[#5A2E98]">🎀 CRM de Vendas</h1>
        <p className="text-[#5A4A5E] text-lg">Gerencie seus leads e acompanhe o funil de vendas</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md" style={{ borderRadius: '20px' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#F7D5E8' }}>
                <Users className="h-5 w-5" style={{ color: '#8E44EC' }} />
              </div>
              <div>
                <p className="text-xs text-[#5A4A5E]">Total</p>
                <p className="text-2xl font-bold" style={{ color: '#8E44EC' }}>{metrics.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" style={{ borderRadius: '20px' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#E9D5FF' }}>
                <Phone className="h-5 w-5" style={{ color: '#8B5CF6' }} />
              </div>
              <div>
                <p className="text-xs text-[#5A4A5E]">Contatados</p>
                <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{metrics.contatados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" style={{ borderRadius: '20px' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#FECDD3' }}>
                <Flame className="h-5 w-5" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <p className="text-xs text-[#5A4A5E]">Quentes</p>
                <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{metrics.quentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" style={{ borderRadius: '20px' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#D1FAE5' }}>
                <TrendingUp className="h-5 w-5" style={{ color: '#10B981' }} />
              </div>
              <div>
                <p className="text-xs text-[#5A4A5E]">Convertidos</p>
                <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{metrics.convertidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" style={{ borderRadius: '20px' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#FDE68A' }}>
                <TrendingUp className="h-5 w-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p className="text-xs text-[#5A4A5E]">Taxa</p>
                <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{metrics.taxaConversao}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button 
          onClick={() => setShowNewLeadModal(true)}
          className="rounded-full px-6"
          style={{ backgroundColor: '#8E44EC', color: 'white' }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => generateLeadsPdf(leads)}
          className="rounded-full px-6"
          style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Gerar PDF
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '20px' }}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
              <Input
                placeholder="Buscar por nome, cidade, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>

            <Select value={filterOrigin} onValueChange={setFilterOrigin}>
              <SelectTrigger className="w-[150px]" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-[150px]" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cidades</SelectItem>
                {uniqueCities.map(city => (
                  <SelectItem key={city} value={city as string}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterHeat} onValueChange={setFilterHeat}>
              <SelectTrigger className="w-[150px]" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="quente">🔥 Quente (70%+)</SelectItem>
                <SelectItem value="morno">🌤 Morno (30-69%)</SelectItem>
                <SelectItem value="frio">❄️ Frio (0-29%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(statusConfig).map(([status, config]) => (
            <LeadKanbanColumn
              key={status}
              status={status}
              config={config}
              leads={leadsByStatus[status] || []}
              onLeadClick={setSelectedLead}
              onViewAll={
                (status === 'fechado' || status === 'perdido') 
                  ? () => {
                      setLeadsListStatus(status as 'fechado' | 'perdido');
                      setShowLeadsListModal(true);
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && (
            <LeadCard 
              lead={activeLead} 
              onClick={() => {}} 
              isDragging 
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Modais */}
      <NewLeadModal
        open={showNewLeadModal}
        onOpenChange={setShowNewLeadModal}
      />

      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

      {leadsListStatus && (
        <LeadsListModal
          open={showLeadsListModal}
          onOpenChange={setShowLeadsListModal}
          leads={leadsByStatus[leadsListStatus] || []}
          title={leadsListStatus === 'fechado' ? 'Leads Fechados' : 'Leads Perdidos'}
          onLeadClick={setSelectedLead}
        />
      )}
    </div>
  );
}
