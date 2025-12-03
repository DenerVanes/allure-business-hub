
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
      
      // Buscar todos os produtos do usuário
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Filtrar produtos com estoque baixo ou sem estoque (mesma lógica do dashboard)
      // Estoque baixo: quantity <= min_quantity (inclui quantity === 0)
      const filtered = (data || []).filter(p => p.quantity <= p.min_quantity);
      
      // Ordenar: primeiro os sem estoque (quantity === 0), depois os com estoque baixo
      return filtered.sort((a, b) => {
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
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertProducts.map((product) => {
                  const stockInfo = getStockStatus(product.quantity, product.min_quantity);
                  const StatusIcon = stockInfo.icon;
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.brand && (
                            <p className="text-sm text-muted-foreground">{product.brand}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${product.quantity === 0 ? 'text-red-600' : product.quantity <= product.min_quantity ? 'text-yellow-600' : ''}`}>
                          {product.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{product.min_quantity}</TableCell>
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
