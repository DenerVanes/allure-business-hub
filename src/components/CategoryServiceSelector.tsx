
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
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Resetar scroll quando o Popover abrir
  useEffect(() => {
    if (scrollContainerRef.current && open) {
      // Resetar scroll para o topo quando abrir
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [open]);

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
                R$ {Number(selectedService.price).toFixed(2)} • {formatDuration(selectedService.duration)}
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
          maxHeight: isMobile ? '70vh' : '600px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div 
          ref={scrollContainerRef}
          className="custom-scrollbar flex-1"
          style={{ 
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            backgroundColor: 'white',
            minHeight: 0
          }}
        >
          <div className="p-2 space-y-1" style={{ paddingBottom: '20px' }}>
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
                  <CollapsibleContent className="mt-1 space-y-0.5 pl-2">
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
                            R$ {Number(service.price).toFixed(2)} • {formatDuration(service.duration)}
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
