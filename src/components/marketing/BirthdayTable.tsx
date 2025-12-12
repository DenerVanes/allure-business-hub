import { useState, useEffect } from 'react';
import { MessageCircle, Calendar, ChevronDown, Gift, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatBirthday } from '@/utils/formatBirthday';
import { formatPhoneForWhatsApp } from '@/utils/formatPhone';
import { formatPhone } from '@/utils/phone';
import { getDefaultTemplate, getActiveTemplates, type Template } from '@/utils/templateStorage';
import { replaceVariables } from '@/utils/templateParser';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BirthdayClient {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
}

interface BirthdayTableProps {
  aniversariantes: BirthdayClient[];
  loading: boolean;
  onClose: () => void;
  onAgendar?: (phone: string) => void;
}

export const BirthdayTable = ({ aniversariantes, loading, onClose, onAgendar }: BirthdayTableProps) => {
  const { user } = useAuth();
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCupomDialog, setShowCupomDialog] = useState(false);
  const [selectedCupomCode, setSelectedCupomCode] = useState<string | null>(null);

  // Buscar promoções/cupons ativos do banco de dados (apenas do salão atual)
  const { data: promocaoAtiva } = useQuery({
    queryKey: ['promocao-ativa', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Buscar se há alguma promoção ativa para este salão
      const { data, error } = await supabase
        .from('promotions')
        .select('id, nome_cupom, percentual_desconto, status, ativa')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .eq('status', 'ativo')
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar promoção ativa:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id
  });

  // Buscar todos os cupons ativos deste salão (para verificar disponibilidade)
  const { data: cuponsAtivos = [] } = useQuery({
    queryKey: ['cupons-ativos-birthdays', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('promotions')
        .select('nome_cupom, status, ativa')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .eq('status', 'ativo');
      
      if (error) {
        console.error('Erro ao buscar cupons ativos:', error);
        return [];
      }
      
      return (data || []).map(p => p.nome_cupom);
    },
    enabled: !!user?.id
  });

  // Verificar se um cliente tem cupom disponível (qualquer cupom ativo serve, pois são cupons únicos)
  const clienteTemCupom = (clientId: string): boolean => {
    // Se há promoção ativa, todos os aniversariantes podem usar
    return promocaoAtiva !== null && cuponsAtivos.length > 0;
  };

  // Obter código do cupom disponível (usa o primeiro cupom ativo)
  const getCupomCodeForClient = (): string | null => {
    if (cuponsAtivos.length > 0) {
      return cuponsAtivos[0];
    }
    return null;
  };

  // Buscar perfil para obter o slug e montar o link
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('slug')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    const activeTemplates = getActiveTemplates();
    setTemplates(activeTemplates);
    const defaultTemplate = getDefaultTemplate();
    
    const initialSelections: Record<string, string> = {};
    aniversariantes.forEach(client => {
      initialSelections[client.id] = defaultTemplate?.id || activeTemplates[0]?.id || '';
    });
    setSelectedTemplates(initialSelections);
  }, [aniversariantes]);

  const getTemplateForClient = (clientId: string): Template | null => {
    const templateId = selectedTemplates[clientId];
    const defaultTemplate = getDefaultTemplate();
    return templates.find(t => t.id === templateId) || defaultTemplate || templates[0] || null;
  };

  const handleWhatsApp = (phone: string, client: BirthdayClient) => {
    const template = getTemplateForClient(client.id);
    if (!template) {
      return;
    }

    // Montar link de agendamento se disponível
    let linkAgendamento = '';
    if (profile?.slug && typeof window !== 'undefined') {
      linkAgendamento = `${window.location.origin}/agendar/${profile.slug}`;
    }

    // Processar template e substituir variáveis, incluindo {link}
    const message = replaceVariables(template.texto, client.name, client.birth_date, linkAgendamento);
    const formattedPhone = formatPhoneForWhatsApp(phone);
    
    // encodeURIComponent é necessário para codificar caracteres especiais na URL
    // O WhatsApp reconhece URLs automaticamente mesmo quando codificadas
    // URLs começando com http:// ou https:// serão reconhecidas pelo WhatsApp
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
  };

  const getPreviewMessage = (client: BirthdayClient): string => {
    const template = getTemplateForClient(client.id);
    if (!template) return '';
    return replaceVariables(template.texto, client.name, client.birth_date);
  };

  const handleAgendar = (phone: string) => {
    onClose();
    if (onAgendar) {
      onAgendar(phone);
    } else {
      window.location.href = `/agendamentos?phone=${encodeURIComponent(formatPhone(phone))}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (aniversariantes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">
          Nenhum aniversariante encontrado neste mês.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aniversariantes.map((client) => (
            <TableRow 
              key={client.id}
              className="hover:bg-accent/50 transition-colors"
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (promocaoAtiva) {
                        const cupomCode = getCupomCodeForClient();
                        if (cupomCode) {
                          setSelectedCupomCode(cupomCode);
                          setShowCupomDialog(true);
                        }
                      }
                    }}
                    className="hover:underline"
                  >
                    {client.name}
                  </button>
                  {promocaoAtiva && clienteTemCupom(client.id) && (
                    <Badge variant="outline" className="text-xs">
                      <Gift className="h-3 w-3 mr-1" />
                      Cupom Disponível
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatBirthday(client.birth_date)}</TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-1">
                    {templates.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg gap-1"
                          >
                            <span className="text-xs max-w-[120px] truncate">
                              {getTemplateForClient(client.id)?.nome || 'Selecionar'}
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {templates.map((template) => (
                            <DropdownMenuItem
                              key={template.id}
                              onClick={() => {
                                setSelectedTemplates(prev => ({
                                  ...prev,
                                  [client.id]: template.id
                                }));
                              }}
                              className={selectedTemplates[client.id] === template.id ? 'bg-accent' : ''}
                            >
                              {template.nome}
                              {template.padrao && ' (Padrão)'}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() => handleWhatsApp(client.phone, client)}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="text-sm whitespace-pre-wrap">
                            {getPreviewMessage(client) || 'Selecione um template'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => handleAgendar(client.phone)}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Agendar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

