
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
import { UserCheck, Plus, Search, MoreVertical, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { CollaboratorModal } from '@/components/CollaboratorModal';

export default function Colaboradores() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<any>(null);

  const { data: collaborators = [] } = useQuery({
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie os colaboradores do seu salão
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Colaborador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Lista de Colaboradores
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCollaborators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum colaborador encontrado</p>
              </div>
            ) : (
              filteredCollaborators.map((collaborator) => (
                <div 
                  key={collaborator.id} 
                  className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/30 hover:shadow-soft transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                      {collaborator.photo_url ? (
                        <img
                          src={collaborator.photo_url}
                          alt={collaborator.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserCheck className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {collaborator.name}
                        <Badge 
                          variant={collaborator.active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {collaborator.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      {collaborator.specialty && collaborator.specialty.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {collaborator.specialty.map((spec: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {collaborator.phone && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {collaborator.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingCollaborator(collaborator)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onClick={() => toggleActiveStatusMutation.mutate({ 
                          id: collaborator.id, 
                          active: !collaborator.active 
                        })}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        {collaborator.active ? 'Desativar' : 'Ativar'}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onClick={() => deleteCollaboratorMutation.mutate(collaborator.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
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
