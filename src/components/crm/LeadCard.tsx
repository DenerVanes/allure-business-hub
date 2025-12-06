import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Instagram, Flame, Thermometer, Snowflake } from 'lucide-react';
import { Lead } from '@/pages/FunilLeads';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  isDragging?: boolean;
}

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Calcular temperatura visual
  const getHeatInfo = (score: number) => {
    if (score >= 70) return { icon: Flame, color: '#EF4444', bg: '#FECDD3', label: 'Quente' };
    if (score >= 30) return { icon: Thermometer, color: '#F59E0B', bg: '#FDE68A', label: 'Morno' };
    return { icon: Snowflake, color: '#9CA3AF', bg: '#E5E7EB', label: 'Frio' };
  };

  const heatInfo = getHeatInfo(lead.heat_score);
  const HeatIcon = heatInfo.icon;

  // Dias desde último contato
  const daysSinceContact = lead.last_contact_at 
    ? differenceInDays(new Date(), new Date(lead.last_contact_at))
    : null;

  // O sensor do DndContext já requer 8px de movimento antes de iniciar drag
  // Isso permite que cliques simples funcionem enquanto arrastos também funcionam
  const handleClick = (e: React.MouseEvent) => {
    // Pequeno delay para garantir que não foi um drag
    // O sensor do DndContext já filtra drags com menos de 8px
    setTimeout(() => {
      onClick(lead);
    }, 100);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-2 transition-all hover:shadow-md border-0 relative cursor-grab active:cursor-grabbing w-full overflow-hidden",
        isDragging && "shadow-lg opacity-90 rotate-2"
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* Header com temperatura */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex-1 min-w-0 pr-1 overflow-hidden">
          <h4 className="font-semibold text-xs leading-tight text-[#5A2E98] truncate">
            {lead.salon_name}
          </h4>
          {lead.contact_name && (
            <p className="text-[10px] text-[#5A4A5E] truncate mt-0.5 leading-tight">
              {lead.contact_name}
            </p>
          )}
        </div>
        
        {/* Heat Score - apenas ícone e porcentagem */}
        <div 
          className="flex items-center gap-0.5 text-[10px] font-semibold flex-shrink-0"
          style={{ color: heatInfo.color }}
          title={`Temperatura: ${lead.heat_score}%`}
        >
          <HeatIcon className="h-3 w-3 flex-shrink-0" />
          <span className="whitespace-nowrap leading-none">{lead.heat_score}%</span>
        </div>
      </div>

      {/* Info - mais compacto */}
      <div className="space-y-0.5 text-[10px] text-[#5A4A5E] mb-1">
        {lead.city && (
          <div className="flex items-center gap-0.5 min-w-0">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate leading-tight">{lead.city}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}</span>
          </div>
        )}
        
        {lead.phone && (
          <div className="flex items-center gap-0.5 min-w-0">
            <Phone className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate leading-tight">{lead.phone}</span>
          </div>
        )}

        {lead.instagram && (
          <div className="flex items-center gap-0.5 min-w-0">
            <Instagram className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate leading-tight">@{lead.instagram.replace('@', '')}</span>
          </div>
        )}
      </div>

      {/* Footer - mais compacto */}
      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#F7D5E8] gap-1">
        {lead.origin && (
          <Badge 
            variant="secondary" 
            className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
            style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
          >
            <span className="truncate max-w-[80px] block">
              {lead.origin === 'trafego_pago' ? 'Tráfego Pago' : 
               lead.origin.charAt(0).toUpperCase() + lead.origin.slice(1)}
            </span>
          </Badge>
        )}
        
        {daysSinceContact !== null && (
          <span 
            className="text-[10px] whitespace-nowrap flex-shrink-0"
            style={{ 
              color: daysSinceContact > 7 ? '#EF4444' : 
                     daysSinceContact > 3 ? '#F59E0B' : '#5A4A5E' 
            }}
          >
            {daysSinceContact === 0 ? 'Hoje' : 
             daysSinceContact === 1 ? 'Ontem' : 
             `${daysSinceContact}d atrás`}
          </span>
        )}
      </div>
    </Card>
  );
}
