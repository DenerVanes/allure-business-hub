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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md border-0",
        isDragging && "shadow-lg opacity-90 rotate-2"
      )}
      onClick={() => onClick(lead)}
      role="button"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-[#5A2E98] truncate">
            {lead.salon_name}
          </h4>
          {lead.contact_name && (
            <p className="text-xs text-[#5A4A5E] truncate">
              {lead.contact_name}
            </p>
          )}
        </div>
        
        {/* Heat Score Badge */}
        <div 
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: heatInfo.bg, color: heatInfo.color }}
        >
          <HeatIcon className="h-3 w-3" />
          <span>{lead.heat_score}%</span>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 text-xs text-[#5A4A5E]">
        {lead.city && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{lead.city}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}</span>
          </div>
        )}
        
        {lead.phone && (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            <span>{lead.phone}</span>
          </div>
        )}

        {lead.instagram && (
          <div className="flex items-center gap-1">
            <Instagram className="h-3 w-3" />
            <span className="truncate">@{lead.instagram.replace('@', '')}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F7D5E8]">
        {lead.origin && (
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-0"
            style={{ backgroundColor: '#F7D5E8', color: '#8E44EC' }}
          >
            {lead.origin === 'trafego_pago' ? 'Tráfego Pago' : 
             lead.origin.charAt(0).toUpperCase() + lead.origin.slice(1)}
          </Badge>
        )}
        
        {daysSinceContact !== null && (
          <span 
            className="text-xs"
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
