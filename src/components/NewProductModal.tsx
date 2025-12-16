
import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp, Info, Check, AlertCircle, Package, Droplets, Scale, Box, X, Edit2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  brand: z.string().min(1, 'Marca é obrigatória'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  unit: z.enum(['g', 'ml', 'unidade']),
  quantity_existing: z.string().optional(),
  quantity_purchased: z.string().optional(),
  quantity_per_unit: z.string().optional(),
  min_quantity: z.string().min(1, 'Quantidade mínima é obrigatória'),
  cost_price: z.string().optional(),
  auto_deduct: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ServiceConsumption {
  serviceId: string;
  consumptionType: 'per_client' | 'yield';
  consumptionPerClient?: number;
  yieldClients?: number;
}

interface NewProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct?: any; // Produto para edição (opcional)
}

export function NewProductModal({ open, onOpenChange, editingProduct }: NewProductModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedServices, setSelectedServices] = useState<Record<string, ServiceConsumption>>({});
  const [showServiceSection, setShowServiceSection] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [productNameSearch, setProductNameSearch] = useState('');
  const [productNameOpen, setProductNameOpen] = useState(false);
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<any>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  
  // Campos editáveis no modo de edição
  const [editableFields, setEditableFields] = useState<Record<string, boolean>>({
    name: false,
    brand: false,
    category: false,
    unit: false,
    quantity_per_unit: false,
    min_quantity: false,
    cost_price: false,
    auto_deduct: false,
  });

  // Categorias padrão
  const defaultCategories = [
    'Cabelo',
    'Unha',
    'Pele',
    'Maquiagem',
    'Acessórios',
    'Equipamentos',
    'Produtos Químicos',
    'Higiene',
    'Geral'
  ];

  // Buscar categorias disponíveis (padrão + customizadas)
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategories);
  
  useEffect(() => {
    if (user?.id && open) {
      const stored = localStorage.getItem(`product-categories-${user.id}`);
      const customCategories = stored ? JSON.parse(stored) : [];
      const storedExcluded = localStorage.getItem(`excluded-product-categories-${user.id}`);
      const excludedCategories = storedExcluded ? JSON.parse(storedExcluded) : [];
      
      const visibleDefault = defaultCategories.filter(cat => !excludedCategories.includes(cat));
      const visibleCustom = customCategories.filter((cat: string) => !excludedCategories.includes(cat));
      setAvailableCategories([...visibleDefault, ...visibleCustom]);
    }
  }, [user?.id, open]);

  // Buscar produtos existentes para autocomplete
  const { data: existingProducts = [] } = useQuery({
    queryKey: ['products-search', user?.id, productNameSearch],
    queryFn: async () => {
      if (!user?.id || !productNameSearch || productNameSearch.length < 2) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${productNameSearch}%`)
        .limit(10)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && productNameSearch.length >= 2 && !isEditingExisting,
  });

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
      unit: 'unidade',
      category: 'Geral',
      auto_deduct: false,
      quantity_existing: '',
      quantity_purchased: '',
      quantity_per_unit: '',
      min_quantity: '',
    },
  });

  const watchedUnit = watch('unit');
  const watchedQuantityExisting = watch('quantity_existing') || '';
  const watchedQuantityPurchased = watch('quantity_purchased') || '';
  const watchedQuantityPerUnit = watch('quantity_per_unit') || '';
  const watchedAutoDeduct = watch('auto_deduct');
  const watchedName = watch('name');
  const watchedBrand = watch('brand');

  // Calcular quantidade total
  const calculatedTotal = useMemo(() => {
    const existing = parseFloat(watchedQuantityExisting.replace(',', '.')) || 0;
    const purchased = parseFloat(watchedQuantityPurchased.replace(',', '.')) || 0;
    const perUnit = parseFloat(watchedQuantityPerUnit.replace(',', '.')) || 0;

    if (watchedUnit === 'unidade') {
      return existing + purchased;
    } else {
      // Para ml ou g, multiplicar unidades pela quantidade por unidade
      const totalUnits = existing + purchased;
      return totalUnits * (perUnit || 0);
    }
  }, [watchedQuantityExisting, watchedQuantityPurchased, watchedQuantityPerUnit, watchedUnit]);

  // Calcular total de unidades (frasco/pacote)
  const calculatedUnits = useMemo(() => {
    const existing = parseFloat(watchedQuantityExisting.replace(',', '.')) || 0;
    const purchased = parseFloat(watchedQuantityPurchased.replace(',', '.')) || 0;
    return existing + purchased;
  }, [watchedQuantityExisting, watchedQuantityPurchased]);

  // Converter para unidade maior (L ou kg)
  const formatQuantity = (value: number, unit: string) => {
    if (unit === 'ml' && value >= 1000) {
      return `${(value / 1000).toFixed(2)} L`;
    }
    if (unit === 'g' && value >= 1000) {
      return `${(value / 1000).toFixed(2)} kg`;
    }
    return `${value.toFixed(2)} ${unit}`;
  };

  // Quando selecionar produto existente
  const handleSelectExistingProduct = (product: any) => {
    setSelectedExistingProduct(product);
    setIsEditingExisting(true);
    setValue('name', product.name);
    setValue('brand', product.brand || '');
    setValue('unit', product.unit || 'unidade');
    
    // Calcular quantidade existente em unidades (frasco/pacote)
    let quantityExisting = '';
    if (product.unit === 'unidade') {
      // Para produtos em unidades, usar quantity diretamente
      quantityExisting = product.quantity?.toString() || '';
    } else {
      // Para produtos em ml ou g, sempre calcular unidades
      const perUnit = parseFloat(product.quantity_per_unit) || 0;
      const currentQuantity = parseFloat(product.quantity) || 0;
      
      // Se tem quantity_per_unit e quantity, calcular unidades
      if (perUnit > 0 && currentQuantity > 0) {
        // Calcular: quantidade atual (ml/g) / quantidade por unidade = número de unidades
        const units = currentQuantity / perUnit;
        quantityExisting = Math.round(units).toString();
      } else if (product.total_quantity && perUnit > 0) {
        // Se não tem quantity mas tem total_quantity, calcular dele
        const totalQty = parseFloat(product.total_quantity) || 0;
        const units = totalQty / perUnit;
        quantityExisting = Math.round(units).toString();
      } else {
        // Se não tem como calcular, deixar vazio
        quantityExisting = '';
      }
    }
    
    setValue('quantity_existing', quantityExisting);
    setValue('quantity_purchased', ''); // Sempre vazio para nova compra
    setValue('total_quantity', product.total_quantity?.toString() || product.quantity?.toString() || '');
    // Preencher automaticamente quantity_per_unit se existir
    setValue('quantity_per_unit', product.quantity_per_unit?.toString() || '');
    setValue('min_quantity', product.min_quantity?.toString() || '');
    setValue('cost_price', product.cost_price?.toString() || '');
    setValue('category', product.category || 'Geral');
    setValue('auto_deduct', product.auto_deduct || false);
    setProductNameOpen(false);
    setProductNameSearch('');
    
    toast({
      title: 'Produto carregado',
      description: 'Você está editando um produto existente. Clique no X para escolher outro.',
    });
  };

  // Alternar edição de campo específico
  const toggleFieldEdit = (fieldName: string) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };
  
  // Cancelar seleção de produto existente
  const handleClearExistingProduct = () => {
    setSelectedExistingProduct(null);
    setIsEditingExisting(false);
    setValue('name', '');
    setValue('brand', '');
    setValue('unit', 'unidade');
    setValue('quantity_existing', '');
    setValue('quantity_purchased', '');
    setValue('total_quantity', '');
    setValue('quantity_per_unit', '');
    setValue('min_quantity', '');
    setValue('cost_price', '');
    setValue('auto_deduct', false);
    setProductNameSearch('');
    setSelectedServices({});
    setShowServiceSection(false);
    setProductNameOpen(false);
    
    toast({
      title: 'Seleção cancelada',
      description: 'Você pode escolher outro produto ou criar um novo.',
    });
  };

  // Carregar dados do produto quando estiver em modo de edição
  useEffect(() => {
    if (open && editingProduct) {
      setIsEditingExisting(true);
      setSelectedExistingProduct(editingProduct);
      
      // Carregar dados do produto
      const product = editingProduct;
      setValue('name', product.name || '');
      setValue('brand', product.brand || '');
      setValue('unit', product.unit || 'unidade');
      setValue('category', product.category || 'Geral');
      setValue('auto_deduct', product.auto_deduct || false);
      
      // Calcular quantidade existente em unidades
      let quantityExisting = '';
      if (product.unit === 'unidade') {
        quantityExisting = (product.estoque_unidades || product.quantity || 0).toString();
      } else {
        const perUnit = parseFloat(product.quantity_per_unit) || 0;
        const estoqueTotal = product.estoque_total || product.quantity || 0;
        if (perUnit > 0 && estoqueTotal > 0) {
          const units = estoqueTotal / perUnit;
          quantityExisting = Math.round(units).toString();
        }
      }
      
      setValue('quantity_existing', quantityExisting);
      setValue('quantity_purchased', ''); // Não permitir nova compra no modo de edição
      setValue('quantity_per_unit', (product.quantity_per_unit || '').toString());
      setValue('min_quantity', (product.estoque_minimo || product.min_quantity || 0).toString());
      setValue('cost_price', (product.preco_medio_atual || product.cost_price || 0).toString());
      
      // Resetar campos editáveis para bloqueados
      setEditableFields({
        name: false,
        brand: false,
        category: false,
        unit: false,
        quantity_per_unit: false,
        min_quantity: false,
        cost_price: false,
        auto_deduct: false,
      });
      
      // Carregar serviços vinculados
      if (product.service_products && product.service_products.length > 0) {
        const servicesMap: Record<string, ServiceConsumption> = {};
        product.service_products.forEach((sp: any) => {
          servicesMap[sp.service_id] = {
            serviceId: sp.service_id,
            consumptionType: sp.consumption_type === 'per_client' ? 'per_client' : 'yield',
            consumptionPerClient: sp.consumption_per_client,
            yieldClients: sp.yield_clients,
          };
        });
        setSelectedServices(servicesMap);
        setShowServiceSection(true);
      }
    }
  }, [open, editingProduct, setValue]);
  
  // Resetar formulário
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedServices({});
      setShowServiceSection(false);
      setShowSummary(false);
      setProductNameSearch('');
      setSelectedExistingProduct(null);
      setIsEditingExisting(false);
      setEditableFields({
        name: false,
        brand: false,
        category: false,
        unit: false,
        quantity_per_unit: false,
        min_quantity: false,
        cost_price: false,
        auto_deduct: false,
      });
    }
  }, [open, reset]);

  const toggleService = (serviceId: string) => {
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

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      const existing = parseFloat(data.quantity_existing?.replace(',', '.') || '0');
      const purchased = parseFloat(data.quantity_purchased?.replace(',', '.') || '0');
      const perUnit = parseFloat(data.quantity_per_unit?.replace(',', '.') || '0');

      let finalQuantity = 0; // Sempre em ml/g (ou unidades se unit === 'unidade')
      let totalQuantity = 0;

      if (data.unit === 'unidade') {
        // Para produtos em unidades, salvar direto
        finalQuantity = existing + purchased;
        totalQuantity = finalQuantity;
      } else {
        // REGRA DE OURO: Para ml ou g, SEMPRE salvar em ml/g no banco
        // O usuário digita em unidades (frascos), mas salvamos em ml/g
        const totalUnits = existing + purchased; // Total de frascos/pacotes
        if (perUnit > 0) {
          // Converter unidades para ml/g: frascos × ml_por_frasco = ml_total
          finalQuantity = totalUnits * perUnit;
          totalQuantity = finalQuantity;
        } else {
          // Se não tem quantidade por unidade definida, assumir que o usuário digitou direto em ml/g
          // (caso de produtos antigos ou migração)
          finalQuantity = existing + purchased;
          totalQuantity = finalQuantity;
        }
      }

      // Se for edição de produto existente, atualizar
      if (isEditingExisting && selectedExistingProduct) {
        // Calcular quantity_per_unit
        let quantityPerUnit = 0;
        if (data.unit !== 'unidade' && perUnit > 0) {
          quantityPerUnit = perUnit;
        } else if (data.unit === 'unidade') {
          quantityPerUnit = 1;
        }

        // Verificar se o preço médio foi alterado
        const novoPrecoMedio = data.cost_price ? parseFloat(data.cost_price.replace(',', '.')) : null;
        const precoMedioAtual = selectedExistingProduct.preco_medio_atual || selectedExistingProduct.cost_price || 0;
        const precoMedioAlterado = novoPrecoMedio !== null && Math.abs(novoPrecoMedio - precoMedioAtual) > 0.01;

        // Atualizar produto (não alterar estoque no modo de edição, apenas outros campos)
        const updateData: any = {
          name: editableFields.name ? data.name : selectedExistingProduct.name,
          brand: editableFields.brand ? data.brand : selectedExistingProduct.brand,
          quantity_per_unit: quantityPerUnit,
          min_quantity: editableFields.min_quantity ? parseFloat(data.min_quantity.replace(',', '.')) : selectedExistingProduct.estoque_minimo || selectedExistingProduct.min_quantity,
          auto_deduct: editableFields.auto_deduct ? data.auto_deduct : selectedExistingProduct.auto_deduct,
          updated_at: new Date().toISOString(),
        };

        // Se o preço médio foi alterado, atualizar
        if (editableFields.cost_price && precoMedioAlterado && novoPrecoMedio !== null) {
          updateData.preco_medio_atual = novoPrecoMedio;
          updateData.cost_price = novoPrecoMedio; // Compatibilidade
          
          // Buscar todas as transações financeiras relacionadas ao produto
          const { data: transactions, error: transactionsError } = await supabase
            .from('financial_transactions')
            .select('id, amount, description')
            .eq('product_id', selectedExistingProduct.id)
            .eq('type', 'expense')
            .eq('category', 'Produtos');

          if (transactionsError) {
            console.error('Erro ao buscar transações:', transactionsError);
          } else if (transactions && transactions.length > 0) {
            // Calcular a proporção do novo preço em relação ao antigo
            const proporcao = precoMedioAtual > 0 ? novoPrecoMedio / precoMedioAtual : 1;
            
            // Atualizar cada transação proporcionalmente
            for (const transaction of transactions) {
              const novoAmount = parseFloat(transaction.amount) * proporcao;
              
              await supabase
                .from('financial_transactions')
                .update({ amount: novoAmount })
                .eq('id', transaction.id);
            }
          }
        }

        if (editableFields.category) {
          updateData.category = data.category;
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', selectedExistingProduct.id);

        if (updateError) throw updateError;

        // Atualizar vínculos de serviços
        await supabase
          .from('service_products')
          .delete()
          .eq('product_id', selectedExistingProduct.id)
          .eq('user_id', user.id);

        if (Object.keys(selectedServices).length > 0) {
          const serviceProducts = Object.values(selectedServices).map((service) => {
            const consumption = service.consumptionType === 'per_client'
              ? { consumption_per_client: service.consumptionPerClient || 0 }
              : { yield_clients: service.yieldClients || 0 };

            return {
              product_id: selectedExistingProduct.id,
              service_id: service.serviceId,
              user_id: user.id,
              consumption_type: service.consumptionType,
              ...consumption,
            };
          });

          await supabase.from('service_products').insert(serviceProducts);
        }

        return;
      }

      // Calcular quantity_per_unit
      let quantityPerUnit = 0;
      if (data.unit !== 'unidade' && perUnit > 0) {
        quantityPerUnit = perUnit;
      } else if (data.unit === 'unidade') {
        quantityPerUnit = 1; // Para unidade, cada unidade = 1
      }

      // Calcular estoque_unidades (soma do estoque atual + compra nova)
      // IMPORTANTE: Na primeira vez, estoque atual usa o mesmo preço da nova compra
      const estoqueUnidades = existing + purchased; // Total em unidades (frascos/caixas)
      let estoqueTotal = finalQuantity; // Já está calculado em ml/g/unidade
      
      // Calcular preço médio inicial
      // REGRA: Na primeira vez, usar o preço da nova compra como preço médio para TODO o estoque
      // (tanto o estoque atual quanto o novo, já que não sabemos o preço do estoque antigo)
      let averagePrice = null;
      if (data.cost_price && purchased > 0) {
        // Usar o preço da nova compra como preço médio inicial para TODO o estoque
        averagePrice = parseFloat(data.cost_price.replace(',', '.'));
      } else if (data.cost_price && existing > 0 && purchased === 0) {
        // Se só tem estoque atual sem compra nova, usar o preço informado
        averagePrice = parseFloat(data.cost_price.replace(',', '.'));
      }

      // Criar novo produto
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: data.name,
          brand: data.brand,
          cost_price: averagePrice, // Compatibilidade
          preco_medio_atual: averagePrice, // Novo campo
          quantity: finalQuantity, // Compatibilidade
          estoque_unidades: estoqueUnidades, // Novo campo
          estoque_total: estoqueTotal, // Novo campo (será calculado pelo trigger)
          total_quantity: totalQuantity, // Compatibilidade
          quantity_per_unit: quantityPerUnit,
          min_quantity: parseFloat(data.min_quantity.replace(',', '.')),
          unit: data.unit,
          control_type: data.unit === 'unidade' ? 'unidade' : 'consumo',
          auto_deduct: data.auto_deduct,
          category: data.category,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Se tem quantidade comprada e preço, criar histórico de entrada e transação financeira
      // IMPORTANTE: Só criar histórico e transação para a compra NOVA, não para o estoque atual
      if (purchased > 0 && averagePrice && averagePrice > 0) {
        const purchaseQuantityInUnits = purchased;
        const purchaseTotalAmount = purchaseQuantityInUnits * averagePrice;

        // Calcular estoque antes da compra nova (só o estoque atual informado pelo usuário)
        let estoqueUnidadesAntes = existing;
        let estoqueTotalAntes = 0;
        if (data.unit === 'unidade') {
          estoqueTotalAntes = existing;
        } else {
          // Para ml/g: converter unidades para ml/g
          if (quantityPerUnit > 0) {
            estoqueTotalAntes = existing * quantityPerUnit;
          } else {
            estoqueTotalAntes = existing;
          }
        }

        // Criar histórico de entrada (só para a compra nova)
        const { error: entryError } = await supabase
          .from('stock_entries')
          .insert({
            product_id: product.id,
            user_id: user.id,
            quantidade_comprada: purchaseQuantityInUnits,
            preco_unitario: averagePrice,
            preco_total: purchaseTotalAmount,
            data_compra: new Date().toISOString().split('T')[0],
            estoque_unidades_antes: estoqueUnidadesAntes,
            estoque_total_antes: estoqueTotalAntes,
            preco_medio_antes: averagePrice, // Mesmo preço, pois é a primeira vez (estoque atual usa mesmo preço)
            estoque_unidades_depois: estoqueUnidades,
            estoque_total_depois: estoqueTotal,
            preco_medio_depois: averagePrice,
            created_by: user.id,
          });

        if (entryError) {
          console.error('Erro ao criar histórico de entrada:', entryError);
        }

        // Criar transação financeira
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert({
            user_id: user.id,
            type: 'expense',
            amount: purchaseTotalAmount,
            description: `Compra de produto - ${data.name} (${purchaseQuantityInUnits} ${data.unit === 'ml' ? 'frascos' : data.unit === 'g' ? 'pacotes' : 'un'})`,
            category: 'Produtos',
            transaction_date: new Date().toISOString().split('T')[0],
            product_id: product.id,
            is_variable_cost: true,
          });

        if (transactionError) {
          console.error('Erro ao criar transação:', transactionError);
          // Não bloquear o cadastro se falhar a transação
        }
      }

      // Criar vínculos com serviços
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
      toast({
        title: isEditingExisting ? 'Produto atualizado' : 'Produto cadastrado',
        description: 'Produto foi salvo com sucesso.',
      });
      reset();
      setSelectedServices({});
      setShowServiceSection(false);
      setShowSummary(false);
      setSelectedExistingProduct(null);
      setIsEditingExisting(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o produto.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: ProductFormData) => {
    // Validar quantidade comprada (obrigatória apenas para produto novo)
    if (!isEditingExisting && (!data.quantity_purchased || data.quantity_purchased.trim() === '')) {
      toast({
        title: 'Erro',
        description: 'Quantidade comprada é obrigatória para produtos novos.',
        variant: 'destructive',
      });
      return;
    }

    // Validar serviços selecionados
    if (watchedAutoDeduct && Object.keys(selectedServices).length > 0) {
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

    if (!showSummary) {
      setShowSummary(true);
      return;
    }

    createProductMutation.mutate(data);
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'g': return 'gramas (g)';
      case 'ml': return 'mililitros (ml)';
      case 'unidade': return 'unidade';
      default: return unit;
    }
  };

  const getUnitIcon = (unit: string) => {
    switch (unit) {
      case 'g': return <Scale className="h-5 w-5" />;
      case 'ml': return <Droplets className="h-5 w-5" />;
      case 'unidade': return <Box className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditingExisting ? 'Atualizar Produto' : 'Cadastrar Novo Produto'}</DialogTitle>
          <DialogDescription>
            {isEditingExisting 
              ? 'Atualize as informações do produto existente'
              : 'Preencha as informações do produto para cadastro no estoque'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Resumo Final */}
          {showSummary && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg">Resumo do Cadastro</CardTitle>
                <CardDescription>Revise as informações antes de salvar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Produto:</span> {watchedName}
                  </div>
                  <div>
                    <span className="font-medium">Marca:</span> {watchedBrand}
                  </div>
                  <div>
                    <span className="font-medium">Categoria:</span> {watch('category')}
                  </div>
                  <div>
                    <span className="font-medium">Unidade:</span> {getUnitLabel(watchedUnit)}
                  </div>
                  <div>
                    <span className="font-medium">Estoque Total:</span> {formatQuantity(calculatedTotal, watchedUnit)}
                  </div>
                  <div>
                    <span className="font-medium">Quantidade Mínima:</span> {watch('min_quantity')} unidades
                  </div>
                  <div>
                    <span className="font-medium">Baixa Automática:</span> {watchedAutoDeduct ? 'Sim' : 'Não'}
                  </div>
                </div>
                {watchedAutoDeduct && Object.keys(selectedServices).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="font-medium text-sm">Serviços vinculados:</span>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      {Object.entries(selectedServices).map(([serviceId, service]) => {
                        const serviceName = services.find(s => s.id === serviceId)?.name;
                        const consumption = service.consumptionType === 'per_client'
                          ? `${service.consumptionPerClient} ${watchedUnit} por cliente`
                          : `Rende ${service.yieldClients} clientes`;
                        return (
                          <li key={serviceId}>{serviceName}: {consumption}</li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSummary(false)}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProductMutation.isPending}
                    className="flex-1"
                  >
                    {createProductMutation.isPending ? 'Salvando...' : 'Confirmar e Salvar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showSummary && (
            <>
              {/* Busca Inteligente de Produtos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="name">Nome do Produto *</Label>
                  {isEditingExisting && editingProduct && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFieldEdit('name')}
                      className="h-6 px-2 text-xs"
                    >
                      {editableFields.name ? (
                        <><Lock className="h-3 w-3 mr-1" /> Bloquear</>
                      ) : (
                        <><Edit2 className="h-3 w-3 mr-1" /> Editar</>
                      )}
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Digite o nome do produto..."
                    value={watchedName || productNameSearch}
                    onChange={(e) => {
                      if (!isEditingExisting || !editingProduct || editableFields.name) {
                        setProductNameSearch(e.target.value);
                        setValue('name', e.target.value);
                        if (e.target.value.length >= 2) {
                          setProductNameOpen(true);
                        } else {
                          setProductNameOpen(false);
                        }
                      }
                    }}
                    disabled={isEditingExisting && editingProduct && !editableFields.name}
                    onFocus={() => {
                      if (!isEditingExisting && productNameSearch.length >= 2 && existingProducts.length > 0) {
                        setProductNameOpen(true);
                      }
                    }}
                    onBlur={(e) => {
                      // Delay para permitir clique nos itens da lista
                      const target = e.currentTarget;
                      setTimeout(() => {
                        // Verificar se o foco não foi para um item da lista
                        try {
                          if (target && document.activeElement) {
                            if (!target.contains(document.activeElement)) {
                              setProductNameOpen(false);
                            }
                          } else {
                            setProductNameOpen(false);
                          }
                        } catch (error) {
                          // Se houver erro, apenas fechar
                          setProductNameOpen(false);
                        }
                      }, 200);
                    }}
                    disabled={isEditingExisting}
                    className={cn(isEditingExisting && 'bg-gray-100')}
                    autoComplete="off"
                  />
                  {isEditingExisting && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-blue-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editando produto existente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button
                        type="button"
                        onClick={handleClearExistingProduct}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Cancelar e escolher outro produto"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {productNameOpen && productNameSearch.length >= 2 && existingProducts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {existingProducts.map((product) => (
                        <div
                          key={product.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevenir blur do input
                            handleSelectExistingProduct(product);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            {product.brand && (
                              <span className="text-xs text-gray-500">{product.brand}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="brand">Marca *</Label>
                  {isEditingExisting && editingProduct && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFieldEdit('brand')}
                      className="h-6 px-2 text-xs"
                    >
                      {editableFields.brand ? (
                        <><Lock className="h-3 w-3 mr-1" /> Bloquear</>
                      ) : (
                        <><Edit2 className="h-3 w-3 mr-1" /> Editar</>
                      )}
                    </Button>
                  )}
                </div>
                <Input
                  id="brand"
                  {...register('brand')}
                  placeholder="Ex: L'Oréal, Wella, etc."
                  disabled={isEditingExisting && editingProduct && !editableFields.brand}
                />
                {errors.brand && (
                  <p className="text-sm text-red-500">{errors.brand.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="category">Categoria *</Label>
                  {isEditingExisting && editingProduct && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFieldEdit('category')}
                      className="h-6 px-2 text-xs"
                    >
                      {editableFields.category ? (
                        <><Lock className="h-3 w-3 mr-1" /> Bloquear</>
                      ) : (
                        <><Edit2 className="h-3 w-3 mr-1" /> Editar</>
                      )}
                    </Button>
                  )}
                </div>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value)}
                  disabled={isEditingExisting && editingProduct && !editableFields.category}
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
                  <p className="text-sm text-red-500">{errors.category.message}</p>
                )}
              </div>

              <Separator />

              {/* Definição da Unidade Base */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Como este produto é armazenado? *</Label>
                  <p className="text-sm text-gray-500 mb-3">Selecione a unidade base do produto</p>
                </div>
                
                <RadioGroup
                  value={watchedUnit}
                  onValueChange={(value) => {
                    setValue('unit', value as 'g' | 'ml' | 'unidade');
                    if (value === 'unidade') {
                      setValue('quantity_per_unit', '');
                    }
                  }}
                  className="grid grid-cols-3 gap-4"
                >
                  <Card className={cn(
                    "cursor-pointer transition-all",
                    watchedUnit === 'unidade' ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"
                  )}>
                    <label className="cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="unidade" id="unit-unidade" className="mt-1" />
                          <Box className="h-5 w-5" />
                          <CardTitle className="text-base">Unidade</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                          Ex: caixa de cílios, frasco, pacote
                        </CardDescription>
                      </CardHeader>
                    </label>
                  </Card>

                  <Card className={cn(
                    "cursor-pointer transition-all",
                    watchedUnit === 'ml' ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"
                  )}>
                    <label className="cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="ml" id="unit-ml" className="mt-1" />
                          <Droplets className="h-5 w-5" />
                          <CardTitle className="text-base">Mililitros</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                          Ex: shampoos, condicionadores, tinturas líquidas
                        </CardDescription>
                      </CardHeader>
                    </label>
                  </Card>

                  <Card className={cn(
                    "cursor-pointer transition-all",
                    watchedUnit === 'g' ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"
                  )}>
                    <label className="cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="g" id="unit-g" className="mt-1" />
                          <Scale className="h-5 w-5" />
                          <CardTitle className="text-base">Gramas</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                          Ex: pós, gel, cremes, máscaras
                        </CardDescription>
                      </CardHeader>
                    </label>
                  </Card>
                </RadioGroup>
              </div>

              <Separator />

              {/* Entrada de Estoque */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Entrada de Estoque</Label>
                  <p className="text-sm text-gray-500 mb-3">Informe as quantidades do produto</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity_existing">
                      {isEditingExisting && editingProduct ? 'Estoque Atual' : 'Quantidade que já possuo'}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 inline ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {isEditingExisting && editingProduct 
                                ? 'Estoque atual do produto (somente leitura - use Entrada/Saída para alterar)' 
                                : 'Quantidade que você já tem em estoque'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="quantity_existing"
                      type="number"
                      step="0.01"
                      {...register('quantity_existing')}
                      placeholder=""
                      disabled={isEditingExisting && editingProduct}
                      readOnly={isEditingExisting && editingProduct}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {watchedUnit === 'unidade' ? 'Ex: 1 frasco' : `Ex: ${watchedUnit === 'ml' ? '1 frasco' : '1 pacote'}`}
                      {isEditingExisting && editingProduct && ' (somente leitura)'}
                    </p>
                  </div>

                  {!isEditingExisting && (
                    <div>
                      <Label htmlFor="quantity_purchased">
                        Quantidade comprada agora *
                      </Label>
                      <Input
                        id="quantity_purchased"
                        type="number"
                        step="0.01"
                        {...register('quantity_purchased')}
                        placeholder=""
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {watchedUnit === 'unidade' ? 'Ex: 2 frascos' : `Ex: ${watchedUnit === 'ml' ? '2 frascos' : '2 pacotes'}`}
                      </p>
                      {errors.quantity_purchased && (
                        <p className="text-sm text-red-500 mt-1">{errors.quantity_purchased.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {watchedUnit !== 'unidade' && (
                  <div>
                    <Label htmlFor="quantity_per_unit">
                      Quantidade por unidade ({watchedUnit})
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 inline ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Quantidade de {watchedUnit} que cada frasco/pacote contém</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="quantity_per_unit"
                      type="number"
                      step="0.01"
                      {...register('quantity_per_unit')}
                      placeholder={watchedUnit === 'ml' ? 'Ex: 500 ml por frasco' : 'Ex: 500 g por pacote'}
                    />
                  </div>
                )}

                {/* Exibição do Total Calculado */}
                {calculatedTotal > 0 && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">Estoque Total Calculado:</p>
                          {watchedUnit === 'unidade' ? (
                            <p className="text-2xl font-bold text-green-700 mt-1">
                              {calculatedTotal.toFixed(0)} unidades
                            </p>
                          ) : (
                            <>
                              <p className="text-2xl font-bold text-green-700 mt-1">
                                {formatQuantity(calculatedTotal, watchedUnit)}
                              </p>
                              {calculatedUnits > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                  {calculatedUnits.toFixed(0)} {calculatedUnits === 1 ? 'unidade' : 'unidades'}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        {getUnitIcon(watchedUnit)}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_quantity">
                      Quantidade Mínima para Alerta (em unidades) *
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 inline ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Quantidade mínima em unidades (frasco/pacote) para alertar estoque baixo</p>
                            <p className="mt-1 text-xs">Ex: Se tiver 5 frascos de 500ml, coloque 1 para alertar quando restar 1 frasco</p>
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

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="cost_price">Preço Médio Atual (R$)</Label>
                      {isEditingExisting && editingProduct && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFieldEdit('cost_price')}
                          className="h-6 px-2 text-xs"
                        >
                          {editableFields.cost_price ? (
                            <><Lock className="h-3 w-3 mr-1" /> Bloquear</>
                          ) : (
                            <><Edit2 className="h-3 w-3 mr-1" /> Editar</>
                          )}
                        </Button>
                      )}
                    </div>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      {...register('cost_price')}
                      placeholder="0.00"
                      disabled={isEditingExisting && editingProduct && !editableFields.cost_price}
                    />
                    {isEditingExisting && editingProduct && editableFields.cost_price && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Alterar o preço médio recalculará o preço médio do produto e atualizará as transações financeiras relacionadas.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Configuração de Consumo */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_deduct"
                    checked={watchedAutoDeduct}
                    onCheckedChange={(checked) => setValue('auto_deduct', checked as boolean)}
                  />
                  <Label htmlFor="auto_deduct" className="cursor-pointer text-base font-semibold">
                    Ativar baixa automática quando serviço for finalizado
                  </Label>
                </div>

                {watchedAutoDeduct && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Como funciona a baixa automática:</p>
                          <p>Quando um serviço vinculado for finalizado, o estoque será reduzido automaticamente conforme o consumo configurado.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {watchedAutoDeduct && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Vincular a Serviços</Label>
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
                      <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                        {services.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Nenhum serviço cadastrado. Cadastre serviços primeiro.
                          </p>
                        ) : (
                          services.map((service) => {
                            const isSelected = !!selectedServices[service.id];
                            const serviceData = selectedServices[service.id];

                            return (
                              <Card key={service.id} className="bg-white">
                                <CardContent className="p-4">
                                  <div className="flex items-center space-x-2 mb-3">
                                    <Checkbox
                                      id={`service-${service.id}`}
                                      checked={isSelected}
                                      onCheckedChange={() => toggleService(service.id)}
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
                                              Quantidade utilizada por cliente ({getUnitLabel(watchedUnit)})
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
                                            {calculatedTotal > 0 && serviceData?.yieldClients && (
                                              <Card className="bg-blue-50 border-blue-200">
                                                <CardContent className="p-2">
                                                  <p className="text-xs text-blue-800">
                                                    <Info className="h-3 w-3 inline mr-1" />
                                                    Consumo automático: {(calculatedTotal / serviceData.yieldClients).toFixed(2)} {watchedUnit} por cliente
                                                  </p>
                                                </CardContent>
                                              </Card>
                                            )}
                                          </div>
                                        )}
                                      </RadioGroup>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                  disabled={createProductMutation.isPending}
                >
                  {createProductMutation.isPending ? 'Salvando...' : 'Continuar'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
