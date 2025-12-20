import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUp, ArrowDown, Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { UpsellModal } from '@/components/marketing/UpsellModal';
import { DownsellModal } from '@/components/marketing/DownsellModal';

interface Campaign {
  id: string;
  type: 'upsell' | 'downsell';
  main_service_id: string;
  linked_service_id: string;
  custom_duration_minutes: number | null;
  extra_price: number;
  message: string;
  active: boolean;
  created_at: string;
  main_service?: {
    id: string;
    name: string;
    price: number;
  };
  linked_service?: {
    id: string;
    name: string;
    price: number;
  };
}

export default function UpsellDownsell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showDownsellModal, setShowDownsellModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['upsell-downsell-campaigns', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('upsell_downsell_campaigns')
        .select(`
          *,
          main_service:services!upsell_downsell_campaigns_main_service_id_fkey(id, name, price),
          linked_service:services!upsell_downsell_campaigns_linked_service_id_fkey(id, name, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user?.id
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('upsell_downsell_campaigns')
        .update({ active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-downsell-campaigns'] });
      toast({
        title: 'Status atualizado',
        description: 'Campanha atualizada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar campanha.',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('upsell_downsell_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-downsell-campaigns'] });
      toast({
        title: 'Campanha excluída',
        description: 'Campanha removida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir campanha.',
        variant: 'destructive',
      });
    }
  });

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    if (campaign.type === 'upsell') {
      setShowUpsellModal(true);
    } else {
      setShowDownsellModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowUpsellModal(false);
    setShowDownsellModal(false);
    setEditingCampaign(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#9333EA] to-[#F472B6] bg-clip-text text-transparent">
            Upsell / Downsell
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure ofertas inteligentes para aumentar o ticket médio durante o agendamento online
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingCampaign(null);
              setShowUpsellModal(true);
            }}
            className="bg-gradient-to-r from-[#9333EA] to-[#F472B6] hover:from-[#7C2D9A] hover:to-[#DB2777]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Upsell
          </Button>
          <Button
            onClick={() => {
              setEditingCampaign(null);
              setShowDownsellModal(true);
            }}
            variant="outline"
            className="border-[#9333EA] text-[#9333EA] hover:bg-[#9333EA] hover:text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Downsell
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma campanha cadastrada. Crie sua primeira campanha para começar!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Serviço Principal</TableHead>
                  <TableHead>Serviço Vinculado</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Badge
                        variant={campaign.type === 'upsell' ? 'default' : 'secondary'}
                        className={campaign.type === 'upsell' 
                          ? 'bg-gradient-to-r from-[#9333EA] to-[#F472B6]' 
                          : 'bg-purple-100 text-purple-700'
                        }
                      >
                        {campaign.type === 'upsell' ? (
                          <ArrowUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDown className="h-3 w-3 mr-1" />
                        )}
                        {campaign.type === 'upsell' ? 'Upsell' : 'Downsell'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {campaign.main_service?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {campaign.linked_service?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {campaign.type === 'upsell' 
                        ? `+ ${formatCurrency(campaign.extra_price)}`
                        : formatCurrency(campaign.linked_service?.price || 0)
                      }
                    </TableCell>
                    <TableCell>
                      {campaign.custom_duration_minutes 
                        ? `${campaign.custom_duration_minutes} min`
                        : 'Automático'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={campaign.active ? 'default' : 'secondary'}>
                        {campaign.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: campaign.id, 
                            active: !campaign.active 
                          })}
                        >
                          {campaign.active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(campaign)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta campanha?')) {
                              deleteMutation.mutate(campaign.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showUpsellModal && (
        <UpsellModal
          open={showUpsellModal}
          onOpenChange={handleCloseModal}
          editingCampaign={editingCampaign}
        />
      )}

      {showDownsellModal && (
        <DownsellModal
          open={showDownsellModal}
          onOpenChange={handleCloseModal}
          editingCampaign={editingCampaign}
        />
      )}
    </div>
  );
}


