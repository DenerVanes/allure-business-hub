import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Edit, Trash2, AlertTriangle, Minus, FolderOpen, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NewProductModal } from '@/components/NewProductModal';
import { EditProductModal } from '@/components/EditProductModal';
import { StockOutModal } from '@/components/StockOutModal';
import { StockInModal } from '@/components/StockInModal';
import { ManageProductCategoriesModal } from '@/components/ManageProductCategoriesModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const Estoque = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [stockOutProduct, setStockOutProduct] = useState<any>(null);
  const [stockInProduct, setStockInProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialFilter, setInitialFilter] = useState<string>('all');
  const [showManageCategories, setShowManageCategories] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Produto removido',
        description: 'Produto foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o produto.',
        variant: 'destructive',
      });
    }
  });

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return { status: 'Sem estoque', variant: 'destructive' as const, icon: AlertTriangle, color: '#EB67A3' };
    } else if (quantity <= minQuantity) {
      return { status: 'Estoque baixo', variant: 'secondary' as const, icon: AlertTriangle, color: '#F7A500' };
    }
    return { status: 'Em estoque', variant: 'default' as const, icon: Package, color: '#8E44EC' };
  };


  // Filtrar produtos
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filtro por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        (product.brand && product.brand.toLowerCase().includes(query)) ||
        (product.description && product.description.toLowerCase().includes(query)) ||
        (product.category && product.category.toLowerCase().includes(query))
      );
    }

    // Filtro por inicial
    if (initialFilter !== 'all') {
      filtered = filtered.filter(product => {
        const firstLetter = product.name.charAt(0).toUpperCase();
        return firstLetter === initialFilter;
      });
    }

    return filtered;
  }, [products, searchQuery, initialFilter]);

  // Agrupar produtos filtrados por categoria
  const groupedFilteredProducts = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      const category = product.category || 'Geral';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredProducts]);

  const filteredCategories = Object.keys(groupedFilteredProducts).sort();

  // Obter iniciais disponíveis
  const availableInitials = useMemo(() => {
    const initials = new Set<string>();
    
    filteredProducts.forEach(product => {
      const firstLetter = product.name.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstLetter)) {
        initials.add(firstLetter);
      }
    });
    
    return Array.from(initials).sort();
  }, [filteredProducts]);

  // Estatísticas
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.quantity <= p.min_quantity && p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#8E44EC' }}></div>
          <p className="text-[#5A4A5E]">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#5A2E98' }}>Estoque</h1>
          <p className="text-sm md:text-base text-[#5A4A5E]">Gerencie seu estoque de produtos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowManageCategories(true)}
            variant="outline"
            className="rounded-full w-full sm:w-auto"
            style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Gerenciar Categorias
          </Button>
          <Button 
            onClick={() => setShowNewProduct(true)}
            className="rounded-full w-full sm:w-auto"
            style={{ backgroundColor: '#8E44EC', color: 'white' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <Package className="h-6 w-6" style={{ color: '#8E44EC' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
              >
                Total
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Total de Produtos</p>
              <p className="text-3xl font-bold" style={{ color: '#8E44EC' }}>
                {totalProducts}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#F7A500' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#F7A500' }}
              >
                Atenção
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Estoque Baixo</p>
              <p className="text-3xl font-bold" style={{ color: '#F7A500' }}>
                {lowStockCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F7D5E8' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#EB67A3' }} />
              </div>
              <Badge 
                className="text-xs px-3 py-1 rounded-full"
                style={{ backgroundColor: '#F7D5E8', color: '#EB67A3' }}
              >
                Crítico
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#5A4A5E] font-medium">Sem Estoque</p>
              <p className="text-3xl font-bold" style={{ color: '#EB67A3' }}>
                {outOfStockCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Principal com Produtos */}
      <Card className="border-0 shadow-md" style={{ borderRadius: '25px', backgroundColor: 'white' }}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl" style={{ color: '#5A2E98' }}>
              <Package className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Produtos em Estoque
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>

            {/* Filtro por Inicial */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#5A4A5E]" />
                <span className="text-sm text-[#5A4A5E]">Filtrar por inicial:</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={initialFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInitialFilter('all')}
                  className="rounded-full text-xs"
                  style={initialFilter === 'all' ? { backgroundColor: '#8E44EC', color: 'white' } : { borderColor: '#F7D5E8', color: '#5A4A5E' }}
                >
                  Todas
                </Button>
                {availableInitials.map(letter => (
                  <Button
                    key={letter}
                    variant={initialFilter === letter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInitialFilter(letter)}
                    className="rounded-full text-xs min-w-[36px]"
                    style={initialFilter === letter ? { backgroundColor: '#8E44EC', color: 'white' } : { borderColor: '#F7D5E8', color: '#5A4A5E' }}
                  >
                    {letter}
                  </Button>
                ))}
              </div>
            </div>

            {/* Limpar Filtros */}
            {(searchQuery || initialFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setInitialFilter('all');
                }}
                className="rounded-full w-full sm:w-auto"
                style={{ borderColor: '#F7D5E8', color: '#8E44EC' }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Produtos agrupados por categoria */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4" style={{ color: '#C9A7FD', opacity: 0.5 }} />
              <p className="text-lg font-medium mb-2" style={{ color: '#5A2E98' }}>
                {searchQuery || initialFilter !== 'all' 
                  ? 'Nenhum produto encontrado com os filtros aplicados.' 
                  : 'Nenhum produto cadastrado ainda.'}
              </p>
              <Button 
                onClick={() => setShowNewProduct(true)}
                className="rounded-full mt-4"
                style={{ backgroundColor: '#8E44EC', color: 'white' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Produto
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCategories.map((category) => (
                <div key={category} className="space-y-4">
                  {/* Cabeçalho da Categoria */}
                  <div className="flex items-center gap-3 pb-2 border-b" style={{ borderColor: '#F7D5E8' }}>
                    <h3 className="text-base md:text-lg font-semibold" style={{ color: '#5A2E98' }}>
                      {category}
                    </h3>
                    <Badge 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
                    >
                      {groupedFilteredProducts[category].length} {groupedFilteredProducts[category].length === 1 ? 'produto' : 'produtos'}
                    </Badge>
                  </div>

                  {/* Grid de Produtos da Categoria */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {groupedFilteredProducts[category].map((product) => {
                      const stockInfo = getStockStatus(product.quantity, product.min_quantity);
                      const StatusIcon = stockInfo.icon;
                      
                      return (
                        <div
                          key={product.id}
                          className="group relative p-4 border rounded-lg hover:border-primary/50 hover:shadow-md transition-all bg-card"
                          style={{ borderRadius: '12px' }}
                        >
                          {/* Header do Card */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm md:text-base mb-1 line-clamp-1" style={{ color: '#5A2E98' }}>
                                {product.name}
                              </h3>
                              {product.brand && (
                                <p className="text-xs text-[#5A4A5E] line-clamp-1">
                                  {product.brand}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingProduct(product)}
                                title="Editar"
                              >
                                <Edit className="h-3.5 w-3.5" style={{ color: '#5A4A5E' }} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                disabled={deleteProductMutation.isPending}
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Descrição */}
                          {product.description && (
                            <p className="text-xs text-[#5A4A5E] mb-3 line-clamp-2">
                              {product.description}
                            </p>
                          )}

                          {/* Informações do Produto */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#5A4A5E]">Quantidade:</span>
                              <span className="font-medium" style={{ color: '#5A2E98' }}>
                                {product.quantity}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#5A4A5E]">Estoque Mín.:</span>
                              <span className="text-[#5A4A5E]">{product.min_quantity}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#5A4A5E]">Preço Custo:</span>
                              <span className="text-[#5A4A5E]">
                                {formatCurrency(product.cost_price)}
                              </span>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="mb-3">
                            <Badge 
                              className="flex items-center gap-1 w-fit rounded-full text-xs"
                              style={{ 
                                backgroundColor: stockInfo.color + '20',
                                color: stockInfo.color,
                                border: `1px solid ${stockInfo.color}40`
                              }}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {stockInfo.status}
                            </Badge>
                          </div>

                          {/* Ações */}
                          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: '#F7D5E8' }}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStockInProduct(product)}
                              className="flex-1 text-xs h-8"
                              style={{ borderColor: '#8E44EC', color: '#8E44EC' }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Entrada
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStockOutProduct(product)}
                              disabled={product.quantity === 0}
                              className="flex-1 text-xs h-8"
                              style={{ borderColor: '#F7A500', color: '#F7A500' }}
                            >
                              <Minus className="h-3 w-3 mr-1" />
                              Saída
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewProductModal
        open={showNewProduct}
        onOpenChange={setShowNewProduct}
      />

      {editingProduct && (
        <EditProductModal
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          product={editingProduct}
        />
      )}

      {stockOutProduct && (
        <StockOutModal
          open={!!stockOutProduct}
          onOpenChange={(open) => !open && setStockOutProduct(null)}
          product={stockOutProduct}
        />
      )}

      {stockInProduct && (
        <StockInModal
          open={!!stockInProduct}
          onOpenChange={(open) => !open && setStockInProduct(null)}
          product={stockInProduct}
        />
      )}

      <ManageProductCategoriesModal
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
        onCategoryAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }}
      />
    </div>
  );
};

export default Estoque;
