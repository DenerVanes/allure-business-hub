import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import { Lead } from '@/pages/FunilLeads';
import { LucideIcon, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadKanbanColumnProps {
  status: string;
  config: {
    label: string;
    color: string;
    icon: LucideIcon;
  };
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onViewAll?: () => void;
}

export function LeadKanbanColumn({ status, config, leads, onLeadClick, onViewAll }: LeadKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const Icon = config.icon;
  const isClosedOrLost = status === 'fechado' || status === 'perdido';

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[280px] border-0 shadow-md transition-all",
        isOver && "ring-2 ring-offset-2"
      )}
      style={{ 
        borderRadius: '20px',
        borderTop: `4px solid ${config.color}`,
        ...(isOver && { ringColor: config.color })
      }}
    >
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: config.color }}>
              {config.label}
            </span>
          </div>
          <Badge 
            className="text-xs px-2 py-0.5"
            style={{ 
              backgroundColor: `${config.color}20`,
              color: config.color 
            }}
          >
            {leads.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-2 pb-4">
        {isClosedOrLost ? (
          // Para Fechado e Perdido: mostrar botão "Ver tudo"
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {leads.length === 0 ? (
              <div 
                className="text-center py-8 px-4 rounded-lg border-2 border-dashed w-full"
                style={{ borderColor: `${config.color}40` }}
              >
                <p className="text-xs text-[#5A4A5E]">
                  Arraste um lead para cá
                </p>
              </div>
            ) : (
              <>
                <div 
                  className="text-center py-6 px-4 rounded-lg border-2 border-dashed w-full mb-4"
                  style={{ borderColor: `${config.color}40` }}
                >
                  <p className="text-xs text-[#5A4A5E] mb-2">
                    {leads.length} {leads.length === 1 ? 'lead' : 'leads'} {status === 'fechado' ? 'fechado' : 'perdido'}
                  </p>
                  <p className="text-xs text-[#5A4A5E]">
                    Clique em "Ver tudo" para visualizar
                  </p>
                </div>
                <Button
                  onClick={onViewAll}
                  className="w-full rounded-full"
                  style={{ 
                    backgroundColor: config.color, 
                    color: 'white'
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver tudo ({leads.length})
                </Button>
              </>
            )}
          </div>
        ) : (
          // Para outras colunas: mostrar cards normalmente
          <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
            <div className="space-y-2 px-2">
              {leads.length === 0 ? (
                <div 
                  className="text-center py-8 px-4 rounded-lg border-2 border-dashed"
                  style={{ borderColor: `${config.color}40` }}
                >
                  <p className="text-xs text-[#5A4A5E]">
                    Arraste um lead para cá
                  </p>
                </div>
              ) : (
                leads.map(lead => (
                  <LeadCard 
                    key={lead.id} 
                    lead={lead} 
                    onClick={onLeadClick}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
