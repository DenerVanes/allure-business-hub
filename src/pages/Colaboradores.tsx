import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { UserCheck, Plus, Search, MoreVertical, Phone, Edit, Trash2, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { CollaboratorModal } from '@/components/CollaboratorModal';
import { formatWorkScheduleSummary } from '@/utils/collaboratorSchedule';

export default function Colaboradores() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<any>(null);

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Buscar horários de todos os colaboradores
  const { data: allSchedules = [] } = useQuery({
    queryKey: ['collaborator-schedules-all', user?.id],
    queryFn: async () => {
      if (!user?.id || collaborators.length === 0) return [];
      
      const collaboratorIds = collaborators.map(c => c.id);
      const { data, error } = await supabase
        .from('collaborator_schedules')
        .select('*')
        .in('collaborator_id', collaboratorIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && collaborators.length > 0
  });

  // Função para obter horários de um colaborador
  const getCollaboratorSchedules = (collaboratorId: string) => {
    return allSchedules.filter(s => s.collaborator_id === collaboratorId);
  };

  const deleteCollaboratorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast({
        title: 'Colaborador removido',
        description: 'Colaborador foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o colaborador.',
        variant: 'destructive',
      });
    }
  });

  const toggleActiveStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('collaborators')
        .update({ active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast({
        title: 'Status atualizado',
        description: 'Status do colaborador foi atualizado com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do colaborador.',
        variant: 'destructive',
      });
    }
  });

  const filteredCollaborators = collaborators.filter(collaborator =>
    collaborator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (collaborator.specialty && collaborator.specialty.some((spec: string) => 
      spec.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  // Estatísticas
  const totalCollaborators = collaborators.length;
  const activeCollaborators = collaborators.filter(c => c.active).length;
  const inactiveCollaborators = collaborators.filter(c => !c.active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#8E44EC' }}></div>
          <p className="text-[#5A4A5E]">Carregando colaboradores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" style={{ backgroundColor: '#FCFCFD' }}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-[#5A2E98]">Colaboradores</h1>
        <p className="text-[#5A4A5E] text-lg">Gerencie os colaboradores do seu salão</p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-3 sticky top-4 z-10 bg-[#FCFCFD]/95 backdrop-blur-sm py-2">
        <Button 
          onClick={() => setShowNewModal(true)}
          className="rounded-full px-6 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
          style={{ 
            backgroundColor: '#8E44EC',
            color: 'white'
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <Users className="h-6 w-6" style={{ color: '#8E44EC' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
              >
                Total
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Total de Colaboradores</p>
              <p className="text-3xl font-bold" style={{ color: '#8E44EC' }}>
                {totalCollaborators}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <UserCheck className="h-6 w-6" style={{ color: '#8E44EC' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
              >
                Ativos
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Colaboradores Ativos</p>
              <p className="text-3xl font-bold" style={{ color: '#8E44EC' }}>
                {activeCollaborators}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <UserCheck className="h-6 w-6" style={{ color: '#C9A7FD' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#C9A7FD' }}
              >
                Inativos
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Colaboradores Inativos</p>
              <p className="text-3xl font-bold" style={{ color: '#C9A7FD' }}>
                {inactiveCollaborators}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Principal com Lista */}
      <Card className="border-0 shadow-md" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
              <UserCheck className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Lista de Colaboradores
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
              <Input
                placeholder="Buscar por nome ou especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCollaborators.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-16 w-16 mx-auto mb-4" style={{ color: '#C9A7FD', opacity: 0.5 }} />
              <p className="text-lg font-medium mb-2" style={{ color: '#5A2E98' }}>
                {searchTerm 
                  ? 'Nenhum colaborador encontrado com os filtros aplicados.' 
                  : 'Nenhum colaborador cadastrado ainda.'}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => setShowNewModal(true)}
                  className="rounded-full mt-4"
                  style={{ backgroundColor: '#8E44EC', color: 'white' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Colaborador
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCollaborators.map((collaborator) => {
                const schedules = getCollaboratorSchedules(collaborator.id);
                const scheduleSummary = formatWorkScheduleSummary(schedules);
                
                return (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-[#F7D5E8] hover:shadow-md transition-all"
                    style={{ backgroundColor: '#FCFCFD' }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Foto do Colaborador */}
                      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: '#F7D5E8' }}>
                        {collaborator.photo_url ? (
                          <img
                            src={collaborator.photo_url}
                            alt={collaborator.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserCheck className="h-7 w-7" style={{ color: '#8E44EC' }} />
                          </div>
                        )}
                      </div>

                      {/* Informações */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg" style={{ color: '#5A2E98' }}>
                            {collaborator.name}
                          </h3>
                          <Badge 
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: collaborator.active ? '#F7D5E8' : '#E5E7EB',
                              color: collaborator.active ? '#8E44EC' : '#9CA3AF'
                            }}
                          >
                            {collaborator.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>

                        {/* Especialidades */}
                        {collaborator.specialty && collaborator.specialty.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {collaborator.specialty.map((spec: string, index: number) => (
                              <Badge 
                                key={index} 
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
                              >
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Informações de Contato e Horários */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-[#5A4A5E]">
                          {collaborator.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{collaborator.phone}</span>
                            </div>
                          )}
                          {scheduleSummary !== 'Horários não configurados' && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-xs">{scheduleSummary}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCollaborator(collaborator)}
                        className="h-8 w-8 p-0 hover:bg-[#F7D5E8]"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" style={{ color: '#5A4A5E' }} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActiveStatusMutation.mutate({ 
                          id: collaborator.id, 
                          active: !collaborator.active 
                        })}
                        className="h-8 w-8 p-0 hover:bg-[#F7D5E8]"
                        title={collaborator.active ? 'Desativar' : 'Ativar'}
                      >
                        <UserCheck className="h-4 w-4" style={{ color: collaborator.active ? '#8E44EC' : '#C9A7FD' }} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja excluir ${collaborator.name}?`)) {
                            deleteCollaboratorMutation.mutate(collaborator.id);
                          }
                        }}
                        className="h-8 w-8 p-0 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: '#EB67A3' }} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CollaboratorModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
      />

      {editingCollaborator && (
        <CollaboratorModal
          open={!!editingCollaborator}
          onOpenChange={(open) => !open && setEditingCollaborator(null)}
          collaborator={editingCollaborator}
        />
      )}
    </div>
  );
}
