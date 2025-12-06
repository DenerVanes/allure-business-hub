import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Scissors, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign, 
  Search,
  Filter,
  FolderOpen,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NewServiceModal } from '@/components/NewServiceModal';
import { ManageCategoriesModal } from '@/components/ManageCategoriesModal';
import { EditServiceModal } from '@/components/EditServiceModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const Servicos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewService, setShowNewService] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  
  // Estados para busca e filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPrice, setFilterPrice] = useState<string>('all');
  const [filterDuration, setFilterDuration] = useState<string>('all');

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          service_categories (name, id)
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

  const handleServiceCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['services'] });
    queryClient.invalidateQueries({ queryKey: ['service-categories'] });
  };

  // Filtrar e buscar serviços
  const filteredServices = useMemo(() => {
    let filtered = [...services];

    // Busca por texto
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query) ||
        service.service_categories?.name?.toLowerCase().includes(query) ||
        service.price.toString().includes(query) ||
        service.duration.toString().includes(query)
      );
    }

    // Filtro por categoria
    if (filterCategory !== 'all') {
      filtered = filtered.filter(service => {
        if (filterCategory === 'uncategorized') {
          return !service.category_id && (!service.category || service.category === 'Sem categoria');
        }
        
        // O filterCategory é sempre um UUID (ID da categoria)
        // Precisamos comparar com:
        // 1. service.category_id (se o serviço tem category_id)
        // 2. service.service_categories?.id (se a relação foi carregada)
        // 3. Se o serviço só tem category (string), precisamos verificar se essa string
        //    corresponde ao nome de alguma categoria que tenha o ID igual a filterCategory
        
        const serviceCategoryId = service.service_categories?.id || service.category_id;
        
        // Comparação direta por ID
        if (serviceCategoryId === filterCategory) {
          return true;
        }
        
        // Se o serviço não tem category_id mas tem category (string antiga),
        // verificar se existe uma categoria com esse nome e ID igual ao filtro
        if (!service.category_id && service.category) {
          const matchingCategory = categories.find(cat => 
            cat.id === filterCategory && cat.name === service.category
          );
          if (matchingCategory) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Filtro por preço
    if (filterPrice !== 'all') {
      filtered = filtered.filter(service => {
        const price = parseFloat(String(service.price));
        switch (filterPrice) {
          case '0-50': return price <= 50;
          case '50-100': return price > 50 && price <= 100;
          case '100-200': return price > 100 && price <= 200;
          case '200+': return price > 200;
          default: return true;
        }
      });
    }

    // Filtro por duração
    if (filterDuration !== 'all') {
      filtered = filtered.filter(service => {
        const duration = parseInt(String(service.duration));
        switch (filterDuration) {
          case '0-30': return duration <= 30;
          case '30-60': return duration > 30 && duration <= 60;
          case '60-90': return duration > 60 && duration <= 90;
          case '90+': return duration > 90;
          default: return true;
        }
      });
    }

    return filtered;
  }, [services, searchQuery, filterCategory, filterPrice, filterDuration]);

  // Agrupar serviços por categoria
  const groupedServices = useMemo(() => {
    return filteredServices.reduce((acc, service) => {
      const categoryName = service.service_categories?.name || service.category || 'Sem categoria';
      const categoryId = service.service_categories?.id || service.category_id || 'uncategorized';
      
      const key = `${categoryId}-${categoryName}`;
      if (!acc[key]) {
        acc[key] = {
          name: categoryName,
          id: categoryId,
          services: []
        };
      }
      acc[key].services.push(service);
      return acc;
    }, {} as Record<string, { name: string; id: string; services: any[] }>);
  }, [filteredServices]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterPrice('all');
    setFilterDuration('all');
  };

  const hasActiveFilters = searchQuery || filterCategory !== 'all' || filterPrice !== 'all' || filterDuration !== 'all';

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
      {/* Header com Action Bar */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">Gerencie seus serviços e categorias</p>
        </div>
        
        {/* Action Bar */}
        <div className="flex items-center gap-3 p-4 bg-card border rounded-lg shadow-sm">
          <Button 
            onClick={() => setShowNewService(true)}
            className="gap-2"
            size="lg"
          >
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
          <Button 
            onClick={() => setShowManageCategories(true)}
            variant="outline"
            className="gap-2"
            size="lg"
          >
            <FolderOpen className="h-4 w-4" />
            Gerenciar Categorias
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviços por nome, categoria, preço ou duração..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtros:</span>
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="uncategorized">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPrice} onValueChange={setFilterPrice}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Preço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os preços</SelectItem>
                <SelectItem value="0-50">Até R$ 50</SelectItem>
                <SelectItem value="50-100">R$ 50 - R$ 100</SelectItem>
                <SelectItem value="100-200">R$ 100 - R$ 200</SelectItem>
                <SelectItem value="200+">Acima de R$ 200</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDuration} onValueChange={setFilterDuration}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Duração" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as durações</SelectItem>
                <SelectItem value="0-30">Até 30 min</SelectItem>
                <SelectItem value="30-60">30 - 60 min</SelectItem>
                <SelectItem value="60-90">60 - 90 min</SelectItem>
                <SelectItem value="90+">Acima de 90 min</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Serviços */}
      {Object.keys(groupedServices).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Scissors className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              {hasActiveFilters 
                ? 'Nenhum serviço encontrado com os filtros aplicados'
                : 'Nenhum serviço cadastrado ainda'}
            </p>
            {!hasActiveFilters && (
              <Button onClick={() => setShowNewService(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedServices).map((category) => (
            <Card 
              key={category.id} 
              className="border-l-4 border-l-primary/20 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scissors className="h-5 w-5 text-primary" />
                  <span className="text-[#5A2E98] font-semibold">{category.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {category.services.length} serviço(s)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {category.services.map((service) => (
                    <div
                      key={service.id}
                      className="group relative p-3 border rounded-lg hover:border-primary/50 hover:shadow-md transition-all bg-card"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm flex-1 line-clamp-1">
                          {service.name}
                        </h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingService(service)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteServiceMutation.mutate(service.id)}
                            disabled={deleteServiceMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign className="h-3 w-3" />
                          <span>R$ {parseFloat(service.price).toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{service.duration}min</span>
                        </div>
                      </div>
                      
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modais */}
      <NewServiceModal
        open={showNewService}
        onOpenChange={setShowNewService}
        onServiceCreated={handleServiceCreated}
      />

      <ManageCategoriesModal
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
        services={services}
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
