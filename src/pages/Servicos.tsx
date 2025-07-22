
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Plus, Edit, Trash2, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewServiceModal } from '@/components/NewServiceModal';
import { NewCategoryModal } from '@/components/NewCategoryModal';
import { EditServiceModal } from '@/components/EditServiceModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const Servicos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewService, setShowNewService] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          service_categories (name)
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .update({ active: false })
        .eq('id', serviceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: 'Serviço removido',
        description: 'Serviço foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o serviço.',
        variant: 'destructive',
      });
    }
  });

  const groupedServices = services.reduce((acc, service) => {
    const categoryName = service.service_categories?.name || service.category || 'Sem categoria';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(service);
    return acc;
  }, {} as Record<string, any[]>);

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando serviços...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">Gerencie seus serviços e categorias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNewCategory(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
          <Button onClick={() => setShowNewService(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>
      </div>

      {Object.keys(groupedServices).length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum serviço cadastrado ainda.</p>
            <Button onClick={() => setShowNewService(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Primeiro Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedServices).map(([categoryName, categoryServices]) => (
            <Card key={categoryName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-5 w-5" />
                  {categoryName}
                  <Badge variant="outline" className="ml-auto">
                    {categoryServices.length} serviço(s)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryServices.map((service) => (
                    <Card key={service.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold">{service.name}</h3>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingService(service)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteServiceMutation.mutate(service.id)}
                              disabled={deleteServiceMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {service.description}
                          </p>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3" />
                            <span className="font-medium">R$ {service.price}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{service.duration}min</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewServiceModal
        open={showNewService}
        onOpenChange={setShowNewService}
      />

      <NewCategoryModal
        open={showNewCategory}
        onOpenChange={setShowNewCategory}
      />

      {editingService && (
        <EditServiceModal
          open={!!editingService}
          onOpenChange={(open) => !open && setEditingService(null)}
          service={editingService}
        />
      )}
    </div>
  );
};

export default Servicos;
