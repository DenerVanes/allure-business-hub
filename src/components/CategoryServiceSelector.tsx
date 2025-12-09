
import { useState, useMemo, useEffect, useRef } from 'react';
import { Check, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

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
}

export const CategoryServiceSelector = ({ 
  services, 
  value, 
  onChange, 
  placeholder = "Selecione o serviço" 
}: CategoryServiceSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const selectedService = services.find(service => service.id === value);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const toggleCategory = (category: string) => {
    const wasOpen = openCategories.includes(category);
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
    
    // Se está abrindo a categoria, fazer scroll para mostrar o conteúdo expandido abaixo
    if (!wasOpen && scrollContainerRef.current) {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        if (container) {
          // Encontrar o elemento da categoria que foi expandida
          const categoryElement = container.querySelector(`[data-category="${category}"]`) as HTMLElement;
          if (categoryElement) {
            // Calcular a posição do elemento e fazer scroll para mostrar o conteúdo abaixo
            const elementTop = categoryElement.offsetTop;
            const elementHeight = categoryElement.offsetHeight;
            const containerHeight = container.clientHeight;
            
            // Se o elemento está muito acima ou o conteúdo expandido não está visível
            // Fazer scroll para mostrar o conteúdo abaixo do botão da categoria
            const scrollPosition = elementTop - 20; // 20px de margem no topo
            
            container.scrollTo({
              top: Math.max(0, scrollPosition),
              behavior: 'smooth'
            });
          }
        }
      }, 150); // Delay para aguardar a animação do Collapsible
    }
  };

  // Resetar scroll quando o Popover abrir
  useEffect(() => {
    if (scrollContainerRef.current && open) {
      // Resetar scroll para o topo quando abrir
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [open]);

  // Garantir que o scroll funcione corretamente quando categorias são expandidas
  useEffect(() => {
    if (scrollContainerRef.current && open) {
      // Forçar recálculo do scrollHeight após expansão de categorias
      const container = scrollContainerRef.current;
      // Delay maior para garantir que a animação do Collapsible termine completamente
      const timeoutId = setTimeout(() => {
        // Força o navegador a recalcular o scrollHeight
        const currentScroll = container.scrollTop;
        container.scrollTop = currentScroll + 1;
        container.scrollTop = currentScroll;
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [openCategories, open]);

  const handleSelectService = (serviceId: string) => {
    onChange(serviceId);
    setOpen(false);
  };

  // Cores diferentes para cada categoria (usando classes do design system)
  const getCategoryColor = (index: number): string => {
    const colors = [
      'bg-pink-100 text-pink-700 border-pink-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-green-100 text-green-700 border-green-200',
      'bg-orange-100 text-orange-700 border-orange-200',
      'bg-teal-100 text-teal-700 border-teal-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-rose-100 text-rose-700 border-rose-200',
    ];
    return colors[index % colors.length];
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-12 justify-between text-base hover:bg-accent/50 transition-colors"
        >
          {selectedService ? (
            <div className="flex justify-between items-center w-full gap-2 overflow-hidden">
              <span className="truncate font-medium">{selectedService.name}</span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                R$ {Number(selectedService.price).toFixed(2)} • {selectedService.duration}min
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border shadow-lg z-50" 
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        side="bottom"
        avoidCollisions={false}
        collisionPadding={8}
        style={{ 
          maxWidth: 'calc(100vw - 32px)',
          width: 'var(--radix-popover-trigger-width)',
          maxHeight: isMobile ? '70vh' : '600px'
        }}
      >
        <div 
          ref={scrollContainerRef}
          className="custom-scrollbar"
          style={{ 
            maxHeight: isMobile ? '70vh' : '600px',
            minHeight: isMobile ? '200px' : '300px',
            height: 'auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            backgroundColor: 'white'
          }}
        >
          <div className="p-2 space-y-1" style={{ paddingBottom: '40px', backgroundColor: 'transparent' }}>
            {servicesByCategory.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Nenhum serviço disponível
              </div>
            ) : (
              servicesByCategory.map(({ category, services: categoryServices }, categoryIndex) => (
                <Collapsible
                  key={category}
                  open={openCategories.includes(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      data-category={category}
                      className={cn(
                        "w-full justify-between px-3 py-2.5 h-auto font-medium rounded-lg",
                        "hover:bg-accent/70 transition-all duration-200",
                        openCategories.includes(category) && "bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-medium px-2 py-0.5",
                            getCategoryColor(categoryIndex)
                          )}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({categoryServices.length} {categoryServices.length === 1 ? 'serviço' : 'serviços'})
                        </span>
                      </div>
                      <ChevronRight 
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          openCategories.includes(category) && "rotate-90"
                        )} 
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent 
                    className="mt-1 space-y-0.5 pl-2"
                    style={{ display: 'block' }}
                  >
                    {categoryServices.map((service) => (
                      <Button
                        key={service.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-between px-3 py-3 h-auto rounded-lg",
                          "hover:bg-primary/10 hover:text-primary transition-all duration-200",
                          value === service.id && "bg-primary/15 text-primary ring-1 ring-primary/30"
                        )}
                        onClick={() => handleSelectService(service.id)}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={cn(
                            "font-medium text-sm",
                            value === service.id && "text-primary"
                          )}>
                            {service.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            R$ {Number(service.price).toFixed(2)} • {service.duration}min
                          </span>
                          {value === service.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
