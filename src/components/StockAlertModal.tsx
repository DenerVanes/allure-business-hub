
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StockAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAlertModal({ open, onOpenChange }: StockAlertModalProps) {
  const { user } = useAuth();

  const { data: alertProducts = [], isLoading } = useQuery({
    queryKey: ['stock-alerts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Buscar todos os produtos do usuário com seus vínculos de serviços
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id);
      
      if (productsError) throw productsError;
      
      // Buscar vínculos de produtos com serviços
      const { data: serviceProducts, error: serviceProductsError } = await supabase
        .from('service_products')
        .select('*, services(name)')
        .eq('user_id', user.id);
      
      if (serviceProductsError) throw serviceProductsError;
      
      // Filtrar produtos com estoque baixo ou sem estoque
      // Calcular unidades restantes e comparar com min_quantity em unidades
      const filtered = (products || []).filter(p => {
        const calculateUnits = (quantity: number, quantityPerUnit: number | null, unit: string | null) => {
          if (unit === 'unidade' || !quantityPerUnit || quantityPerUnit === 0) {
            return quantity;
          }
          return quantity / quantityPerUnit;
        };
        
        const unitsRemaining = calculateUnits(p.quantity, p.quantity_per_unit, p.unit);
        return unitsRemaining <= p.min_quantity || p.quantity === 0;
      });
      
      // Enriquecer produtos com informações de consumo e estimativa
      const enriched = filtered.map(product => {
        // Buscar vínculos deste produto
        const productLinks = (serviceProducts || []).filter(sp => sp.product_id === product.id);
        
        // Calcular estimativa de atendimentos restantes
        let estimatedAppointments: number | null = null;
        let consumptionInfo: string | null = null;
        
        if (productLinks.length > 0 && product.auto_deduct && product.quantity > 0) {
          // Calcular média de consumo considerando todos os serviços vinculados
          let totalConsumption = 0;
          let validLinks = 0;
          
          productLinks.forEach(link => {
            let consumption = 0;
            if (link.consumption_type === 'per_client' && link.consumption_per_client) {
              consumption = link.consumption_per_client;
            } else if (link.consumption_type === 'yield' && product.total_quantity && link.yield_clients) {
              consumption = product.total_quantity / link.yield_clients;
            }
            
            if (consumption > 0) {
              totalConsumption += consumption;
              validLinks++;
            }
          });
          
          if (validLinks > 0) {
            const avgConsumption = totalConsumption / validLinks;
            if (avgConsumption > 0) {
              estimatedAppointments = Math.floor(product.quantity / avgConsumption);
              consumptionInfo = `${avgConsumption.toFixed(2)} ${product.unit || ''} por atendimento (média)`;
            }
          }
        }
        
        return {
          ...product,
          estimatedAppointments,
          consumptionInfo,
          linkedServices: productLinks.map(sp => (sp.services as any)?.name).filter(Boolean),
        };
      });
      
      // Ordenar: primeiro os sem estoque (quantity === 0), depois os com estoque baixo
      return enriched.sort((a, b) => {
        if (a.quantity === 0 && b.quantity !== 0) return -1;
        if (a.quantity !== 0 && b.quantity === 0) return 1;
        return a.quantity - b.quantity;
      });
    },
    enabled: !!user?.id && open
  });

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return { status: 'Sem estoque', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (quantity <= minQuantity) {
      return { status: 'Estoque baixo', variant: 'secondary' as const, icon: AlertTriangle };
    }
    return { status: 'Normal', variant: 'default' as const, icon: Package };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Alertas de Estoque
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Carregando produtos...</p>
            </div>
          ) : alertProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto com alerta de estoque!</p>
              <p className="text-sm text-muted-foreground">Todos os produtos estão com estoque adequado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Estimativa</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertProducts.map((product: any) => {
                  const stockInfo = getStockStatus(product.quantity, product.min_quantity);
                  const StatusIcon = stockInfo.icon;
                  const unitLabel = product.unit === 'g' ? 'g' : product.unit === 'ml' ? 'ml' : 'un';
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.brand && (
                            <p className="text-sm text-muted-foreground">{product.brand}</p>
                          )}
                          {product.linkedServices && product.linkedServices.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Usado em: {product.linkedServices.join(', ')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <div>
                          <span className={`font-medium ${product.quantity === 0 ? 'text-red-600' : product.quantity <= product.min_quantity ? 'text-yellow-600' : ''}`}>
                            {product.quantity} {unitLabel}
                          </span>
                          {product.consumptionInfo && (
                            <p className="text-xs text-gray-500 mt-1">{product.consumptionInfo}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.min_quantity} {unitLabel}</TableCell>
                      <TableCell>
                        {product.estimatedAppointments !== null ? (
                          <div>
                            <span className="font-medium text-blue-600">
                              ~{product.estimatedAppointments} atendimentos
                            </span>
                            {product.estimatedAppointments <= 5 && (
                              <p className="text-xs text-red-600 mt-1">⚠️ Crítico</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockInfo.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {stockInfo.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
