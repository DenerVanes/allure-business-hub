import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, Phone, Mail, MapPin, Instagram, Calendar as CalendarIcon, User } from 'lucide-react';
import { Lead } from '@/pages/FunilLeads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeadsListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  title: string;
  onLeadClick: (lead: Lead) => void;
}

export function LeadsListModal({ open, onOpenChange, leads, title, onLeadClick }: LeadsListModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLeads = leads.filter(lead => {
    const query = searchQuery.toLowerCase();
    return (
      lead.salon_name.toLowerCase().includes(query) ||
      lead.contact_name?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.city?.toLowerCase().includes(query) ||
      lead.instagram?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh]" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="text-xl" style={{ color: '#5A2E98' }}>
            {title} ({leads.length})
          </DialogTitle>
        </DialogHeader>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5A4A5E]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, cidade..."
            className="pl-10"
            style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
          />
        </div>

        {/* Lista de leads */}
        <ScrollArea className="h-[calc(90vh-200px)]">
          <div className="space-y-2">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#5A4A5E]">
                  {searchQuery ? 'Nenhum lead encontrado' : 'Nenhum lead nesta categoria'}
                </p>
              </div>
            ) : (
              filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => {
                    onLeadClick(lead);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                    "hover:border-[#8E44EC] border-[#F7D5E8] bg-white"
                  )}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-[#5A2E98] mb-1">
                        {lead.salon_name}
                      </h4>
                      {lead.contact_name && (
                        <p className="text-xs text-[#5A4A5E] mb-2">
                          {lead.contact_name}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-xs text-[#5A4A5E]">
                        {lead.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span className="truncate max-w-[200px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.city && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span>{lead.city}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}</span>
                          </div>
                        )}
                        {lead.instagram && (
                          <div className="flex items-center gap-1">
                            <Instagram className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span className="truncate">@{lead.instagram.replace('@', '')}</span>
                          </div>
                        )}
                        {lead.first_contact_date && (
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span>1º contato: {format(new Date(lead.first_contact_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          </div>
                        )}
                        {lead.seller && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" style={{ color: '#8E44EC' }} />
                            <span>{lead.seller}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

