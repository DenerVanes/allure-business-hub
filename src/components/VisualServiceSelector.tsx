import { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Eye, 
  Hand, 
  Check, 
  ChevronDown,
  Clock,
  DollarSign,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Função para converter minutos em formato HH:MM
const formatDuration = (minutes: number): string => {
  if (!minutes || minutes < 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
  description?: string | null;
}

interface CategoryServiceSelectorProps {
  services: Service[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onShowCategoriesChange?: (showing: boolean) => void;
}

// Mapeamento de ícones por categoria
const getCategoryIcon = (category: string) => {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('cabelo') || categoryLower.includes('hair')) {
    return Scissors;
  }
  if (categoryLower.includes('cílio') || categoryLower.includes('eyelash')) {
    return Sparkles;
  }
  if (categoryLower.includes('sobrancelha') || categoryLower.includes('eyebrow')) {
    return Eye;
  }
  if (categoryLower.includes('unha') || categoryLower.includes('nail')) {
    return Hand;
  }
  return Scissors; // Ícone padrão
};

// Cores por categoria
const getCategoryColor = (category: string, index: number) => {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('cabelo') || categoryLower.includes('hair')) {
    return {
      bg: 'bg-pink-100',
      text: 'text-pink-700',
      border: 'border-pink-200',
      icon: 'text-pink-600',
      hover: 'hover:bg-pink-200'
    };
  }
  if (categoryLower.includes('cílio') || categoryLower.includes('eyelash')) {
    return {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200',
      icon: 'text-purple-600',
      hover: 'hover:bg-purple-200'
    };
  }
  if (categoryLower.includes('sobrancelha') || categoryLower.includes('eyebrow')) {
    return {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      hover: 'hover:bg-blue-200'
    };
  }
  if (categoryLower.includes('unha') || categoryLower.includes('nail')) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200',
      icon: 'text-green-600',
      hover: 'hover:bg-green-200'
    };
  }
  
  // Cores padrão baseadas no índice
  const colors = [
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'text-orange-600', hover: 'hover:bg-orange-200' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', icon: 'text-teal-600', hover: 'hover:bg-teal-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:bg-indigo-200' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', icon: 'text-rose-600', hover: 'hover:bg-rose-200' },
  ];
  return colors[index % colors.length];
};

export const VisualServiceSelector = ({ 
  services, 
  value, 
  onChange, 
  placeholder = "Selecione o serviço",
  onShowCategoriesChange
}: CategoryServiceSelectorProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(!value);

  const selectedService = services.find(service => service.id === value);

  // Sincronizar showCategories com value
  useEffect(() => {
    if (!value) {
      setShowCategories(true);
      setExpandedCategory(null);
    }
  }, [value]);

  // Notificar mudança no estado de mostrar categorias
  useEffect(() => {
    onShowCategoriesChange?.(showCategories);
  }, [showCategories, onShowCategoriesChange]);

  // Agrupar serviços por categoria
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    
    services.forEach(service => {
      const category = service.category || 'Outros';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(service);
    });

    // Ordenar categorias alfabeticamente
    const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    
    return sortedCategories.map(category => ({
      category,
      services: grouped[category].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [services]);

  // Reordenar categorias: expandida no topo
  const orderedCategories = useMemo(() => {
    if (!expandedCategory) return servicesByCategory;
    
    const expanded = servicesByCategory.find(c => c.category === expandedCategory);
    const others = servicesByCategory.filter(c => c.category !== expandedCategory);
    
    return expanded ? [expanded, ...others] : servicesByCategory;
  }, [servicesByCategory, expandedCategory]);

  const handleCategoryClick = (category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    onChange(serviceId);
    setShowCategories(false);
    setExpandedCategory(null);
  };

  const handleChangeService = () => {
    onChange(''); // Limpar o valor selecionado
    setShowCategories(true);
    setExpandedCategory(null);
  };

  // Se um serviço está selecionado e não deve mostrar categorias
  if (value && !showCategories) {
    return (
      <div className="space-y-3">
        {/* Header com nome do serviço e botão Alterar - Fora do card */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Scissors className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-lg text-foreground">
              {selectedService?.name}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleChangeService}
            className="shrink-0"
          >
            <X className="h-4 w-4 mr-2" />
            Alterar
          </Button>
        </div>

        {/* Card com informações do serviço */}
        <Card className="border-2 border-primary/30 shadow-md">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Preço e Duração - Layout horizontal harmonioso */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                  <DollarSign className="h-5 w-5 text-primary" />
                  R$ {Number(selectedService?.price || 0).toFixed(2)}
                </span>
                <span className="flex items-center gap-1.5 text-base text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatDuration(selectedService?.duration || 0)}
                </span>
              </div>

              {/* Descrição - Completa sem cortes */}
              {selectedService?.description && (
                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-normal">
                    {selectedService.description}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de categorias
  return (
    <div className="space-y-4">
      {/* Categoria expandida no topo */}
      {expandedCategory && (() => {
        const expanded = orderedCategories.find(c => c.category === expandedCategory);
        if (!expanded) return null;
        
        const Icon = getCategoryIcon(expanded.category);
        const colors = getCategoryColor(expanded.category, 0);
        
        return (
          <div className="space-y-3 mb-6">
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-auto h-auto p-4 flex items-center justify-center gap-3 transition-all duration-200",
                "hover:shadow-md border-2 bg-primary/10 border-primary",
                colors.border
              )}
              onClick={() => handleCategoryClick(expanded.category)}
            >
              <div className="p-3 rounded-full bg-primary/20">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-primary">
                  {expanded.category}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {expanded.services.length} {expanded.services.length === 1 ? 'serviço' : 'serviços'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-primary" />
            </Button>

            {/* Serviços da categoria expandida - Card grande */}
            <Card className={cn(
              "border-2 shadow-lg animate-in slide-in-from-top-2 duration-300 overflow-hidden",
              colors.border
            )}>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {expanded.services.map((service) => {
                    const isSelected = value === service.id;
                    return (
                      <Button
                        key={service.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start p-4 h-auto rounded-xl transition-all text-left",
                          "hover:shadow-md border",
                          isSelected
                            ? "bg-primary/15 text-primary ring-2 ring-primary/30 border-primary/50"
                            : "border-border bg-white"
                        )}
                        onClick={() => handleServiceSelect(service.id)}
                      >
                        <div className="flex flex-col items-start gap-2 flex-1 text-left min-w-0 w-full">
                          <span className={cn(
                            "font-semibold text-base",
                            isSelected && "text-primary"
                          )}>
                            {service.name}
                          </span>
                          {service.description && (
                            <p className="text-sm text-muted-foreground break-words w-full whitespace-normal">
                              {service.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1 flex-wrap w-full">
                            <span className={cn(
                              "text-base font-bold whitespace-nowrap",
                              isSelected ? "text-primary" : "text-foreground"
                            )}>
                              R$ {Number(service.price).toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                              <Clock className="h-4 w-4" />
                              {formatDuration(service.duration)}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-6 w-6 text-primary shrink-0 ml-2" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Grid de categorias */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {orderedCategories
          .filter(({ category }) => category !== expandedCategory)
          .map(({ category, services: categoryServices }, index) => {
            const Icon = getCategoryIcon(category);
            const colors = getCategoryColor(category, index);
            
            return (
              <Button
                key={category}
                variant="outline"
                className={cn(
                  "w-full h-auto p-4 flex flex-col items-center justify-center gap-3 transition-all duration-200",
                  "hover:shadow-md border-2 bg-white",
                  colors.border,
                  colors.hover
                )}
                onClick={() => handleCategoryClick(category)}
              >
                <div className={cn("p-3 rounded-full", colors.bg)}>
                  <Icon className={cn("h-6 w-6", colors.icon)} />
                </div>
                <div className="text-center">
                  <p className={cn("font-semibold text-sm", colors.text)}>
                    {category}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {categoryServices.length} {categoryServices.length === 1 ? 'serviço' : 'serviços'}
                  </p>
                </div>
              </Button>
            );
          })}
      </div>

    </div>
  );
};

