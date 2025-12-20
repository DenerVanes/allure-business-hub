
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  brand: z.string().optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  cost_price: z.string().optional(),
  quantity: z.string().min(1, 'Quantidade atual é obrigatória'),
  total_quantity: z.string().min(1, 'Quantidade total é obrigatória'),
  quantity_per_unit: z.string().optional(),
  min_quantity: z.string().min(1, 'Quantidade mínima é obrigatória'),
  description: z.string().optional(),
  unit: z.enum(['g', 'ml', 'unidade']),
  control_type: z.enum(['consumo', 'unidade']),
  auto_deduct: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ServiceConsumption {
  serviceId: string;
  consumptionType: 'per_client' | 'yield';
  consumptionPerClient?: number;
  yieldClients?: number;
}

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

export function EditProductModal({ open, onOpenChange, product }: EditProductModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedServices, setSelectedServices] = useState<Record<string, ServiceConsumption>>({});
  const [showServiceSection, setShowServiceSection] = useState(false);

  // Buscar categorias disponíveis (apenas as cadastradas pelo usuário)
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  
  useEffect(() => {
    if (user?.id && open) {
      const stored = localStorage.getItem(`product-categories-${user.id}`);
      const customCategories = stored ? JSON.parse(stored) : [];
      setAvailableCategories(customCategories);
    }
  }, [user?.id, open]);

  // Buscar serviços do usuário
  const { data: services = [] } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Buscar vínculos existentes do produto com serviços
  const { data: existingServiceProducts = [] } = useQuery({
    queryKey: ['service-products', product?.id],
    queryFn: async () => {
      if (!product?.id || !user?.id) return [];
      
      const { data, error } = await supabase
        .from('service_products')
        .select('*')
        .eq('product_id', product.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!product?.id && open,
  });

  // Carregar vínculos existentes quando produto ou dados mudarem
  useEffect(() => {
    if (existingServiceProducts.length > 0) {
      const servicesMap: Record<string, ServiceConsumption> = {};
      existingServiceProducts.forEach((sp: any) => {
        servicesMap[sp.service_id] = {
          serviceId: sp.service_id,
          consumptionType: sp.consumption_type,
          consumptionPerClient: sp.consumption_per_client || undefined,
          yieldClients: sp.yield_clients || undefined,
        };
      });
      setSelectedServices(servicesMap);
    }
  }, [existingServiceProducts]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      brand: product?.brand || '',
      category: product?.category || 'Geral',
      cost_price: product?.cost_price?.toString() || '',
      quantity: product?.quantity?.toString() || '',
      total_quantity: product?.total_quantity?.toString() || product?.quantity?.toString() || '',
      quantity_per_unit: product?.quantity_per_unit?.toString() || '',
      min_quantity: product?.min_quantity?.toString() || '',
      description: product?.description || '',
      unit: product?.unit || 'unidade',
      control_type: product?.control_type || 'unidade',
      auto_deduct: product?.auto_deduct || false,
    },
  });

  // Atualizar valores quando produto mudar
  useEffect(() => {
    if (product) {
      // REGRA DE OURO: quantity no banco está em ml/g, converter para unidades na UI
      let quantityInUnits = '';
      if (product.unit === 'unidade' || !product.quantity_per_unit || product.quantity_per_unit === 0) {
        quantityInUnits = product.quantity?.toString() || '';
      } else {
        // Converter de ml/g para unidades: quantity (ml/g) / quantity_per_unit = unidades
        const units = (product.quantity || 0) / (product.quantity_per_unit || 1);
        quantityInUnits = Math.round(units).toString();
      }

      reset({
        name: product.name || '',
        brand: product.brand || '',
        category: product.category || 'Geral',
        cost_price: product.cost_price?.toString() || '',
        quantity: quantityInUnits, // Mostrar em unidades na UI
        total_quantity: product.total_quantity?.toString() || product.quantity?.toString() || '',
        quantity_per_unit: product.quantity_per_unit?.toString() || '',
        min_quantity: product.min_quantity?.toString() || '',
        description: product.description || '',
        unit: product.unit || 'unidade',
        control_type: product.control_type || 'unidade',
        auto_deduct: product.auto_deduct || false,
      });
    }
  }, [product, reset]);

  const watchedUnit = watch('unit');
  const watchedControlType = watch('control_type');
  const watchedTotalQuantity = watch('total_quantity');
  const watchedAutoDeduct = watch('auto_deduct');

  const toggleService = (serviceId: string, serviceName: string) => {
    if (selectedServices[serviceId]) {
      const newSelected = { ...selectedServices };
      delete newSelected[serviceId];
      setSelectedServices(newSelected);
    } else {
      setSelectedServices({
        ...selectedServices,
        [serviceId]: {
          serviceId,
          consumptionType: 'per_client',
        },
      });
    }
  };

  const updateServiceConsumption = (serviceId: string, updates: Partial<ServiceConsumption>) => {
    setSelectedServices({
      ...selectedServices,
      [serviceId]: {
        ...selectedServices[serviceId],
        ...updates,
      },
    });
  };

  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!user?.id || !product?.id) throw new Error('Dados não encontrados');

      // Atualizar produto
      // REGRA DE OURO: Converter unidades para ml/g antes de salvar
      const quantityInUnits = parseFloat(data.quantity.replace(',', '.'));
      const perUnit = parseFloat(data.quantity_per_unit?.replace(',', '.') || '0');
      
      let finalQuantity = 0; // Sempre em ml/g (ou unidades se unit === 'unidade')
      let totalQuantity = 0;

      if (data.unit === 'unidade') {
        // Para produtos em unidades, salvar direto
        finalQuantity = quantityInUnits;
        totalQuantity = parseFloat(data.total_quantity?.replace(',', '.') || quantityInUnits.toString());
      } else {
        // Para ml ou g: converter unidades para ml/g
        if (perUnit > 0) {
          // Converter unidades para ml/g: frascos × ml_por_frasco = ml_total
          finalQuantity = quantityInUnits * perUnit;
          totalQuantity = finalQuantity;
        } else {
          // Se não tem quantidade por unidade, assumir que o usuário digitou direto em ml/g
          finalQuantity = quantityInUnits;
          totalQuantity = parseFloat(data.total_quantity?.replace(',', '.') || quantityInUnits.toString());
        }
      }

      const { error: productError } = await supabase
        .from('products')
        .update({
          name: data.name,
          brand: data.brand || null,
          category: data.category,
          cost_price: data.cost_price ? parseFloat(data.cost_price.replace(',', '.')) : null,
          quantity: finalQuantity, // Salvar em ml/g
          total_quantity: totalQuantity,
          quantity_per_unit: perUnit > 0 ? perUnit : (data.unit === 'unidade' ? 1 : null),
          min_quantity: parseFloat(data.min_quantity.replace(',', '.')),
          description: data.description || null,
          unit: data.unit,
          control_type: data.control_type,
          auto_deduct: data.auto_deduct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (productError) throw productError;

      // Remover todos os vínculos existentes
      const { error: deleteError } = await supabase
        .from('service_products')
        .delete()
        .eq('product_id', product.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Criar novos vínculos
      if (Object.keys(selectedServices).length > 0) {
        const serviceProducts = Object.values(selectedServices).map((service) => {
          const consumption = service.consumptionType === 'per_client'
            ? { consumption_per_client: service.consumptionPerClient || 0 }
            : { yield_clients: service.yieldClients || 0 };

          return {
            product_id: product.id,
            service_id: service.serviceId,
            user_id: user.id,
            consumption_type: service.consumptionType,
            ...consumption,
          };
        });

        const { error: serviceProductsError } = await supabase
          .from('service_products')
          .insert(serviceProducts);

        if (serviceProductsError) throw serviceProductsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['service-products'] });
      toast({
        title: 'Produto atualizado',
        description: 'Produto foi atualizado com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível atualizar o produto.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: ProductFormData) => {
    // Validar serviços selecionados
    if (Object.keys(selectedServices).length > 0) {
      for (const [serviceId, service] of Object.entries(selectedServices)) {
        if (service.consumptionType === 'per_client' && (!service.consumptionPerClient || service.consumptionPerClient <= 0)) {
          toast({
            title: 'Erro',
            description: `Configure o consumo para o serviço "${services.find(s => s.id === serviceId)?.name}"`,
            variant: 'destructive',
          });
          return;
        }
        if (service.consumptionType === 'yield' && (!service.yieldClients || service.yieldClients <= 0)) {
          toast({
            title: 'Erro',
            description: `Configure o rendimento para o serviço "${services.find(s => s.id === serviceId)?.name}"`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    updateProductMutation.mutate(data);
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'g': return 'gramas (g)';
      case 'ml': return 'mililitros (ml)';
      case 'unidade': return 'unidade';
      default: return unit;
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>
            Atualize as informações do produto e seus vínculos com serviços
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Informações Básicas</h3>
            
            <div>
              <Label htmlFor="name">Nome do Produto *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ex: Shampoo Hidratante"
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                {...register('brand')}
                placeholder="Ex: L'Oréal"
              />
            </div>

            <div>
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Controle de Estoque */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Controle de Estoque</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit">Unidade de Medida *</Label>
                <Select 
                  value={watchedUnit} 
                  onValueChange={(value) => setValue('unit', value as 'g' | 'ml' | 'unidade')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">Gramas (g)</SelectItem>
                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="control_type">Tipo de Controle *</Label>
                <Select 
                  value={watchedControlType} 
                  onValueChange={(value) => setValue('control_type', value as 'consumo' | 'unidade')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumo">Controle por Consumo</SelectItem>
                    <SelectItem value="unidade">Controle por Unidade</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {watchedControlType === 'consumo' 
                    ? 'Ex: Shampoo, tintura, gel' 
                    : 'Ex: Luvas, toalha descartável'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="total_quantity">Quantidade Total *</Label>
                <Input
                  id="total_quantity"
                  type="number"
                  step="0.01"
                  {...register('total_quantity')}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: 500 {watchedUnit === 'g' ? 'g' : watchedUnit === 'ml' ? 'ml' : 'un'}
                </p>
                {errors.total_quantity && (
                  <p className="text-sm text-red-500 mt-1">{errors.total_quantity.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="quantity">Quantidade Atual *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  {...register('quantity')}
                  placeholder="0"
                />
                {errors.quantity && (
                  <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="min_quantity">
                  Quantidade Mínima (em unidades) *
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 inline ml-1 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Quantidade mínima em unidades (frasco/pacote) para alertar estoque baixo</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="min_quantity"
                  type="number"
                  step="1"
                  {...register('min_quantity')}
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 mt-1">Ex: 1 unidade (frasco/pacote)</p>
                {errors.min_quantity && (
                  <p className="text-sm text-red-500 mt-1">{errors.min_quantity.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="cost_price">Preço de Custo (un)</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                {...register('cost_price')}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto_deduct"
                checked={watchedAutoDeduct}
                onCheckedChange={(checked) => setValue('auto_deduct', checked as boolean)}
              />
              <Label htmlFor="auto_deduct" className="cursor-pointer">
                Baixa automática quando serviço for finalizado
              </Label>
            </div>
          </div>

          <Separator />

          {/* Vínculo com Serviços */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Uso deste produto nos serviços</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowServiceSection(!showServiceSection)}
              >
                {showServiceSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {showServiceSection && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum serviço cadastrado. Cadastre serviços primeiro.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => {
                      const isSelected = !!selectedServices[service.id];
                      const serviceData = selectedServices[service.id];

                      return (
                        <div key={service.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex items-center space-x-2 mb-3">
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleService(service.id, service.name)}
                            />
                            <Label htmlFor={`service-${service.id}`} className="cursor-pointer font-medium">
                              {service.name}
                            </Label>
                          </div>

                          {isSelected && (
                            <div className="ml-6 space-y-3 mt-3 pt-3 border-t">
                              <RadioGroup
                                value={serviceData?.consumptionType || 'per_client'}
                                onValueChange={(value) => updateServiceConsumption(service.id, {
                                  consumptionType: value as 'per_client' | 'yield',
                                })}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="per_client" id={`per-client-${service.id}`} />
                                  <Label htmlFor={`per-client-${service.id}`} className="cursor-pointer">
                                    Consumo por cliente
                                  </Label>
                                </div>
                                {serviceData?.consumptionType === 'per_client' && (
                                  <div className="ml-6 mt-2">
                                    <Label htmlFor={`consumption-${service.id}`} className="text-xs">
                                      Quantidade usada por cliente ({getUnitLabel(watchedUnit)})
                                    </Label>
                                    <Input
                                      id={`consumption-${service.id}`}
                                      type="number"
                                      step="0.01"
                                      value={serviceData?.consumptionPerClient || ''}
                                      onChange={(e) => updateServiceConsumption(service.id, {
                                        consumptionPerClient: parseFloat(e.target.value) || 0,
                                      })}
                                      placeholder="Ex: 10"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center space-x-2 mt-3">
                                  <RadioGroupItem value="yield" id={`yield-${service.id}`} />
                                  <Label htmlFor={`yield-${service.id}`} className="cursor-pointer">
                                    Rendimento por quantidade de clientes
                                  </Label>
                                </div>
                                {serviceData?.consumptionType === 'yield' && (
                                  <div className="ml-6 mt-2 space-y-2">
                                    <div>
                                      <Label htmlFor={`yield-clients-${service.id}`} className="text-xs">
                                        Este produto rende quantos atendimentos?
                                      </Label>
                                      <Input
                                        id={`yield-clients-${service.id}`}
                                        type="number"
                                        value={serviceData?.yieldClients || ''}
                                        onChange={(e) => {
                                          const yieldClients = parseInt(e.target.value) || 0;
                                          updateServiceConsumption(service.id, { yieldClients });
                                        }}
                                        placeholder="Ex: 50"
                                      />
                                    </div>
                                    {watchedTotalQuantity && serviceData?.yieldClients && (
                                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                                        <Info className="h-3 w-3 inline mr-1" />
                                        Consumo automático: {(
                                          parseFloat(watchedTotalQuantity.replace(',', '.')) / serviceData.yieldClients
                                        ).toFixed(2)} {watchedUnit} por cliente
                                      </div>
                                    )}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrição do produto (opcional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateProductMutation.isPending}
            >
              {updateProductMutation.isPending ? 'Salvando...' : 'Atualizar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
