import { useState, useEffect } from 'react';
import { Gift, X, Save, Calendar, Percent, Tag, CheckCircle, AlertCircle, Plus, MoreVertical, Pause, Play, Trash2, Ban, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  getPromocao,
  savePromocao,
  getCupons,
  saveCupons,
  type PromocaoAniversario,
  type CupomMes
} from '@/utils/promotionStorage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { useBirthdays } from '@/hooks/useBirthdays';
import { useAuth } from '@/hooks/useAuth';
import { syncPromotionToBackend } from '@/utils/promotionApi';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface PromotionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PromotionManager = ({ open, onOpenChange }: PromotionManagerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { aniversariantes } = useBirthdays();
  const [promocao, setPromocao] = useState<PromocaoAniversario>(getPromocao(user?.id));
  // Removido: cupons agora vêm do banco de dados via useQuery
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [selectedCupom, setSelectedCupom] = useState<CupomMes | null>(null);
  const [showCupomDetails, setShowCupomDetails] = useState(false);

  // Buscar usos de cupons do backend
  // Query para buscar cupons utilizados (finalizados) - para card "Utilizados"
  const { data: cuponsUsos = {} } = useQuery({
    queryKey: ['coupon-uses', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      
      // Buscar usos de cupons com informações dos agendamentos
      const { data: couponUses, error } = await supabase
        .from('coupon_uses')
        .select('codigo_cupom, appointment_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Erro ao buscar usos de cupons:', error);
        return {};
      }
      
      if (!couponUses || couponUses.length === 0) return {};
      
      // Buscar agendamentos relacionados para verificar status
      const appointmentIds = couponUses
        .map(uso => uso.appointment_id)
        .filter(Boolean);
      
      let appointmentsMap: Record<string, any> = {};
      
      if (appointmentIds.length > 0) {
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select('id, status')
          .in('id', appointmentIds)
          .eq('user_id', user.id);
        
        if (!appointmentsError && appointments) {
          appointmentsMap = appointments.reduce((acc: Record<string, any>, apt: any) => {
            acc[apt.id] = apt;
            return acc;
          }, {});
        }
      }
      
      // Contar apenas cupons onde o agendamento foi finalizado (atendido)
      const usos: Record<string, number> = {};
      couponUses.forEach(uso => {
        // Verificar se o agendamento existe e está finalizado
        if (uso.appointment_id) {
          const appointment = appointmentsMap[uso.appointment_id];
          // Contar apenas se o agendamento foi finalizado
          if (appointment && appointment.status === 'finalizado') {
            const codigo = uso.codigo_cupom.toUpperCase();
            usos[codigo] = (usos[codigo] || 0) + 1;
          }
        }
      });
      
      return usos;
    },
    enabled: !!user?.id && open,
  });

  // Query para buscar total de cupons utilizados (incluindo pendentes) - para card "Atendimento Pendente"
  const { data: cuponsUsosTotal = {} } = useQuery({
    queryKey: ['coupon-uses-total', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      
      // Buscar todos os usos de cupons com informações dos agendamentos
      const { data: couponUses, error } = await supabase
        .from('coupon_uses')
        .select('codigo_cupom, appointment_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Erro ao buscar total de usos de cupons:', error);
        return {};
      }
      
      if (!couponUses || couponUses.length === 0) return {};
      
      // Buscar agendamentos relacionados para verificar status
      const appointmentIds = couponUses
        .map(uso => uso.appointment_id)
        .filter(Boolean);
      
      let appointmentsMap: Record<string, any> = {};
      
      if (appointmentIds.length > 0) {
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select('id, status')
          .in('id', appointmentIds)
          .eq('user_id', user.id);
        
        if (!appointmentsError && appointments) {
          appointmentsMap = appointments.reduce((acc: Record<string, any>, apt: any) => {
            acc[apt.id] = apt;
            return acc;
          }, {});
        }
      }
      
      // Contar TODOS os cupons utilizados (finalizados e pendentes)
      const usos: Record<string, number> = {};
      couponUses.forEach(uso => {
        const codigo = uso.codigo_cupom.toUpperCase();
        usos[codigo] = (usos[codigo] || 0) + 1;
      });
      
      return usos;
    },
    enabled: !!user?.id && open,
  });

  // Buscar promoções do backend para obter limites específicos de cada cupom
  // Buscar cupons do banco de dados (tabela promotions)
  const { data: cuponsFromBackend = [], refetch: refetchCupons } = useQuery({
    queryKey: ['cupons-backend', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('promotions')
        .select('id, nome_cupom, percentual_desconto, data_inicio, data_fim, status, ativa, limite_cupons_ativo, limite_cupons, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar cupons:', error);
        return [];
      }
      
      // Converter dados do banco para formato CupomMes
      return (data || []).map((promo: any) => ({
        codigo: promo.nome_cupom,
        clienteId: '',
        clienteNome: 'Todos os clientes',
        clienteTelefone: '',
        percentualDesconto: promo.percentual_desconto,
        dataGeracao: promo.created_at || new Date().toISOString(),
        utilizado: false, // Não usado mais, mantido para compatibilidade
        dataUtilizacao: null,
        agendamentoId: null,
        status: promo.status || (promo.ativa ? 'ativo' : 'pausado'),
        usosPorTelefone: [],
        promotionId: promo.id // ID do banco para operações
      }));
    },
    enabled: !!user?.id && open,
  });

  // Usar cupons do banco como fonte principal
  const cupons = cuponsFromBackend;

  // Criar mapa de limites por código de cupom (dos dados do banco)
  const limitesPorCupom: Record<string, { ativo: boolean; limite: number }> = {};
  // Buscar dados completos das promotions para pegar limites
  const { data: promotionsData = [] } = useQuery({
    queryKey: ['promotions-limits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('promotions')
        .select('nome_cupom, limite_cupons_ativo, limite_cupons')
        .eq('user_id', user.id);
      
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id && open,
  });
  
  promotionsData.forEach((promo: any) => {
    if (promo.nome_cupom) {
      limitesPorCupom[promo.nome_cupom.toUpperCase()] = {
        ativo: promo.limite_cupons_ativo || false,
        limite: promo.limite_cupons || 0
      };
    }
  });

  useEffect(() => {
    if (open && user?.id) {
      // Quando abrir o modal, limpar campos de criação de cupom
      const promocaoAtual = getPromocao(user.id);
      setPromocao({
        ...promocaoAtual,
        nomeCupom: '', // Limpar código do cupom
        percentualDesconto: 0, // Resetar percentual (sem seleção)
        dataInicio: '', // Limpar data início
        dataFim: '' // Limpar data fim
      });
      setTouched(false);
      // Cupons são carregados automaticamente via useQuery quando o modal abre
    }
  }, [open, user?.id]);

  const handleSave = async () => {
    // Salvar no localStorage sempre (com user_id para isolamento)
    if (user?.id) {
      savePromocao(promocao, user.id);
    }

    // Só exigir datas se não houver cupons criados e se a promoção estiver ativa
    // Se já existem cupons, não precisa das datas (os cupons já foram criados)
    if (promocao.ativa && cupons.length === 0 && (!promocao.dataInicio || !promocao.dataFim)) {
      toast({
        title: 'Erro',
        description: 'Defina as datas de início e fim da promoção.',
        variant: 'destructive',
      });
      return;
    }

    // Validar datas apenas se estiverem preenchidas
    if (promocao.dataInicio && promocao.dataFim && new Date(promocao.dataFim) <= new Date(promocao.dataInicio)) {
      toast({
        title: 'Erro',
        description: 'Data de fim deve ser maior que data de início.',
        variant: 'destructive',
      });
      return;
    }

    // Só validar percentual e código se não houver cupons criados
    // Se já existem cupons, não precisa validar (os cupons já foram criados)
    if (cupons.length === 0) {
      if (promocao.percentualDesconto < 5 || promocao.percentualDesconto > 50) {
        toast({
          title: 'Erro',
          description: 'Desconto deve estar entre 5% e 50%.',
          variant: 'destructive',
        });
        return;
      }

      if (!promocao.nomeCupom.trim()) {
        toast({
          title: 'Erro',
          description: 'Defina um código para o cupom.',
          variant: 'destructive',
        });
        return;
      }
    }

        // Salvar no localStorage (para compatibilidade, com user_id para isolamento)
        if (user?.id) {
          savePromocao(promocao, user.id);
        }

    // Sincronizar com backend se usuário estiver logado
    // Só sincronizar se tiver dados suficientes OU se houver cupons criados
    // Se há cupons mas os campos estão vazios, não precisa sincronizar (cupons já foram salvos individualmente)
    if (user?.id && (promocao.nomeCupom || cupons.length > 0)) {
      try {
        // Se não tem nome de cupom mas tem cupons, não precisa sincronizar aqui
        // Os cupons individuais já foram salvos quando criados
        if (promocao.nomeCupom) {
          await syncPromotionToBackend(user.id, {
            ativa: promocao.ativa,
            percentual_desconto: promocao.percentualDesconto || 15,
            nome_cupom: promocao.nomeCupom,
            data_inicio: promocao.dataInicio || new Date().toISOString().split('T')[0],
            data_fim: promocao.dataFim || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
            gerar_cupom_automatico: false,
            prefixo_cupom: '',
            valido_apenas_no_mes: true, // Sempre true, pois é exclusivo para aniversariantes
            um_uso_por_cliente: promocao.umUsoPorCliente,
            enviar_por_whatsapp: promocao.enviarPorWhatsApp,
            limite_cupons_ativo: promocao.limiteCuponsAtivo || false,
            limite_cupons: promocao.limiteCupons || 0
          });
        }
      } catch (error: any) {
        console.error('Erro ao sincronizar promoção:', error);
        toast({
          title: 'Aviso',
          description: 'Promoção salva localmente. Alguns erros podem ocorrer na validação de cupons.',
          variant: 'destructive',
        });
      }
    }

    // Não criar cupom automaticamente - cupons devem ser criados manualmente pelo botão "Criar Cupom"

    toast({
      title: 'Promoção salva',
      description: 'Configurações da promoção foram salvas com sucesso.',
    });
    setTouched(false);
    // Fechar modal após salvar
    onOpenChange(false);
  };

  const handleToggleAtiva = (ativa: boolean) => {
    if (promocao.ativa && !ativa) {
      setShowDeactivateConfirm(true);
    } else {
      setPromocao({ ...promocao, ativa });
      setTouched(true);
    }
  };

  const confirmDeactivate = () => {
    setPromocao({ ...promocao, ativa: false });
    setTouched(true);
    setShowDeactivateConfirm(false);
  };


  const handleCopyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast({
      title: 'Código copiado',
      description: `Código ${codigo} copiado para a área de transferência.`,
    });
  };

  const handleCreateCupom = async () => {
    if (!promocao.nomeCupom.trim()) {
      toast({
        title: 'Erro',
        description: 'Configure o código do cupom acima antes de criar.',
        variant: 'destructive',
      });
      return;
    }

    if (promocao.percentualDesconto < 5 || promocao.percentualDesconto > 50) {
      toast({
        title: 'Erro',
        description: 'Percentual deve estar entre 5% e 50%.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se código já existe no banco (já está sendo verificado pelo banco também)
    if (cupons.some(c => c.codigo.toUpperCase() === promocao.nomeCupom.toUpperCase())) {
      toast({
        title: 'Erro',
        description: 'Este código de cupom já existe.',
        variant: 'destructive',
      });
      return;
    }

    const codigoCupom = promocao.nomeCupom.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Salvar promoção no backend para este cupom específico
    if (user?.id) {
      try {
        // Buscar promoção existente ou criar nova para este cupom
        const { data: existingPromotion } = await supabase
          .from('promotions')
          .select('id')
          .eq('user_id', user.id)
          .eq('nome_cupom', codigoCupom)
          .maybeSingle();

        // Usar datas da promoção atual ou datas padrão se não tiver
        const dataInicio = promocao.dataInicio || new Date().toISOString().split('T')[0];
        const dataFim = promocao.dataFim || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0];

        const promotionData = {
          ativa: promocao.ativa,
          status: 'ativo', // Sempre criar como ativo
          percentual_desconto: promocao.percentualDesconto,
          nome_cupom: codigoCupom,
          data_inicio: dataInicio,
          data_fim: dataFim,
          gerar_cupom_automatico: false,
          prefixo_cupom: '',
          valido_apenas_no_mes: true,
          um_uso_por_cliente: promocao.umUsoPorCliente,
          enviar_por_whatsapp: promocao.enviarPorWhatsApp,
          limite_cupons_ativo: promocao.limiteCuponsAtivo || false,
          limite_cupons: promocao.limiteCupons || 0
        };

        if (existingPromotion) {
          // Atualizar promoção existente
          await supabase
            .from('promotions')
            .update(promotionData)
            .eq('id', existingPromotion.id);
        } else {
          // Criar nova promoção para este cupom
          await supabase
            .from('promotions')
            .insert({
              user_id: user.id,
              ...promotionData
            });
        }
      } catch (error: any) {
        console.error('Erro ao salvar cupom no backend:', error);
        toast({
          title: 'Aviso',
          description: 'Cupom criado localmente, mas houve erro ao salvar no servidor.',
          variant: 'destructive',
        });
      }
    }

    // Cupom já foi salvo no banco acima, agora invalidar query para recarregar
    await queryClient.invalidateQueries({ queryKey: ['cupons-backend', user?.id] });
    
    setTouched(true);
    
    // Limpar campos para permitir criar novo cupom
    setPromocao({
      ...promocao,
      nomeCupom: '', // Limpar código do cupom
      percentualDesconto: 0, // Resetar percentual (sem seleção)
      dataInicio: '', // Limpar data início
      dataFim: '' // Limpar data fim
    });
    
    toast({
      title: 'Cupom criado',
      description: `Cupom ${novoCupom.codigo} criado com sucesso e salvo no banco de dados.`,
    });
  };

  const handlePausarCupom = async (codigo: string) => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Faça login para pausar cupons.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Atualizar status no banco de dados
      const { error } = await supabase
        .from('promotions')
        .update({ status: 'pausado', ativa: false })
        .eq('user_id', user.id)
        .eq('nome_cupom', codigo);

      if (error) throw error;

      // Invalidar query para recarregar cupons do banco
      await queryClient.invalidateQueries({ queryKey: ['cupons-backend', user?.id] });
      setTouched(true);
      
      toast({
        title: 'Cupom pausado',
        description: `Cupom ${codigo} foi pausado e não pode ser utilizado até ser ativado novamente.`,
      });
    } catch (error: any) {
      console.error('Erro ao pausar cupom:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível pausar o cupom.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelarCupom = async (codigo: string) => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Faça login para cancelar cupons.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Atualizar status no banco de dados
      const { error } = await supabase
        .from('promotions')
        .update({ status: 'cancelado', ativa: false })
        .eq('user_id', user.id)
        .eq('nome_cupom', codigo);

      if (error) throw error;

      // Invalidar query para recarregar cupons do banco
      await queryClient.invalidateQueries({ queryKey: ['cupons-backend', user?.id] });
      setTouched(true);
      
      toast({
        title: 'Cupom cancelado',
        description: `Cupom ${codigo} foi cancelado e não pode ser utilizado novamente.`,
      });
    } catch (error: any) {
      console.error('Erro ao cancelar cupom:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o cupom.',
        variant: 'destructive',
      });
    }
  };

  const handleExcluirCupom = async (codigo: string) => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Faça login para excluir cupons.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Normalizar código para garantir exclusão completa
      const codigoNormalizado = codigo.toUpperCase().trim();
      
      // 1. Primeiro, excluir todos os registros de uso do cupom (coupon_uses)
      // Buscar todos os usos do cupom para garantir exclusão completa
      const { data: todosUsos, error: usosError } = await supabase
        .from('coupon_uses')
        .select('id, codigo_cupom')
        .eq('user_id', user.id);
      
      if (usosError) throw usosError;
      
      // Filtrar usos que correspondem ao código (case-insensitive)
      const usosParaExcluir = (todosUsos || []).filter((uso: any) => 
        uso.codigo_cupom && uso.codigo_cupom.toUpperCase().trim() === codigoNormalizado
      );
      
      // Excluir cada uso encontrado
      if (usosParaExcluir.length > 0) {
        const idsParaExcluir = usosParaExcluir.map((uso: any) => uso.id);
        const { error: deleteUsosError } = await supabase
          .from('coupon_uses')
          .delete()
          .in('id', idsParaExcluir);
        
        if (deleteUsosError) throw deleteUsosError;
      }
      
      // 2. Excluir todas as promoções com o mesmo código (promotions)
      // Buscar todas as promoções do usuário
      const { data: todasPromocoes, error: promocoesError } = await supabase
        .from('promotions')
        .select('id, nome_cupom')
        .eq('user_id', user.id);
      
      if (promocoesError) throw promocoesError;
      
      // Encontrar todas as promoções que correspondem ao código (case-insensitive)
      const promocoesParaExcluir = (todasPromocoes || []).filter((promo: any) => 
        promo.nome_cupom && promo.nome_cupom.toUpperCase().trim() === codigoNormalizado
      );
      
      // Excluir todas as promoções encontradas
      if (promocoesParaExcluir.length > 0) {
        const idsParaExcluir = promocoesParaExcluir.map((promo: any) => promo.id);
        const { error: deletePromocaoError } = await supabase
          .from('promotions')
          .delete()
          .in('id', idsParaExcluir);
        
        if (deletePromocaoError) throw deletePromocaoError;
      }

      // Invalidar query para recarregar cupons do banco (cupom já foi deletado)
      await queryClient.invalidateQueries({ queryKey: ['cupons-backend', user?.id] });
      setTouched(true);
      
      // 4. Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['coupon-uses'] });
      queryClient.invalidateQueries({ queryKey: ['promotions-backend'] });
      queryClient.invalidateQueries({ queryKey: ['coupon-details'] });
      
      toast({
        title: 'Cupom excluído',
        description: `Cupom ${codigoNormalizado} foi completamente excluído do banco de dados. Todos os registros de uso foram removidos.`,
      });
    } catch (error: any) {
      console.error('Erro ao excluir cupom:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir o cupom completamente.',
        variant: 'destructive',
      });
    }
  };

  const handleAtivarCupom = async (codigo: string) => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Faça login para ativar cupons.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Atualizar status no banco de dados
      const { error } = await supabase
        .from('promotions')
        .update({ status: 'ativo', ativa: true })
        .eq('user_id', user.id)
        .eq('nome_cupom', codigo);

      if (error) throw error;

      // Invalidar query para recarregar cupons do banco
      await queryClient.invalidateQueries({ queryKey: ['cupons-backend', user?.id] });
      setCupons(novosCupons);
      setTouched(true);
      
      toast({
        title: 'Cupom ativado',
        description: `Cupom ${codigo} foi ativado e pode ser utilizado novamente.`,
      });
    } catch (error: any) {
      console.error('Erro ao ativar cupom:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível ativar o cupom.',
        variant: 'destructive',
      });
    }
  };

  // Calcular total de cupons utilizados (onde agendamento foi finalizado) somando todos os cupons
  const cuponsUtilizados = Object.values(cuponsUsos).reduce((total, count) => total + count, 0);
  // Calcular total de cupons utilizados (todos, incluindo pendentes)
  const cuponsUtilizadosTotal = Object.values(cuponsUsosTotal).reduce((total, count) => total + count, 0);
  // Calcular atendimento pendente: total utilizados - finalizados
  const atendimentoPendente = cuponsUtilizadosTotal - cuponsUtilizados;
  const diasRestantes = promocao.ativa && promocao.dataFim
    ? Math.ceil((new Date(promocao.dataFim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const getCupomStatus = (cupom: CupomMes): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    // Verificar status do cupom primeiro
    if (cupom.status === 'cancelado') {
      return { label: 'Cancelado', variant: 'destructive' };
    }
    if (cupom.status === 'pausado') {
      return { label: 'Pausado', variant: 'secondary' };
    }
    
    if (cupom.utilizado) {
      return { label: 'Utilizado', variant: 'default' };
    }
    const hoje = new Date();
    const fim = new Date(promocao.dataFim);
    if (hoje > fim) {
      return { label: 'Expirado', variant: 'destructive' };
    }
    // Se não tem status definido, considerar como ativo/disponível
    return { label: 'Disponível', variant: 'outline' };
  };

  const setQuickPeriod = (days: number) => {
    const inicio = new Date();
    const fim = new Date();
    fim.setDate(fim.getDate() + days);
    setPromocao({
      ...promocao,
      dataInicio: inicio.toISOString().split('T')[0],
      dataFim: fim.toISOString().split('T')[0]
    });
    setTouched(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Gerenciar Promoções de Aniversário
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Toggle Principal */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold">Ativar Promoção de Aniversário</Label>
                    <p className="text-sm text-muted-foreground">
                      Ative a promoção para gerar cupons de desconto para aniversariantes
                    </p>
                  </div>
                  <Switch
                    checked={promocao.ativa}
                    onCheckedChange={handleToggleAtiva}
                  />
                </div>
              </CardContent>
            </Card>

            {promocao.ativa && (
              <>
                {/* Percentual de Desconto */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Percentual de Desconto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Desconto (%)</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min="5"
                          max="50"
                          value={promocao.percentualDesconto || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPromocao({ ...promocao, percentualDesconto: value > 0 ? Math.min(50, Math.max(5, value)) : 0 });
                            setTouched(true);
                          }}
                          className="w-32"
                          placeholder=""
                        />
                        <div className="flex gap-2">
                          {[5, 10, 15, 20, 25, 30, 50].map(p => (
                            <Button
                              key={p}
                              type="button"
                              variant={promocao.percentualDesconto === p && promocao.percentualDesconto > 0 ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setPromocao({ ...promocao, percentualDesconto: p });
                                setTouched(true);
                              }}
                            >
                              {p}%
                            </Button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: 5% | Máximo: 50%
                      </p>
                    </div>
                    {promocao.percentualDesconto > 0 && (
                      <div className="bg-primary/10 p-4 rounded-lg">
                        <p className="text-sm">
                          <strong>Preview:</strong> Desconto de {promocao.percentualDesconto}% será aplicado no valor do serviço
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Código do Cupom */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Código do Cupom
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Código do Cupom</Label>
                      <Input
                        value={promocao.nomeCupom}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          setPromocao({ ...promocao, nomeCupom: value });
                          setTouched(true);
                        }}
                        placeholder=""
                        maxLength={20}
                      />
                      <p className="text-xs text-muted-foreground">
                        Apenas letras maiúsculas e números (sem espaços ou caracteres especiais)
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Período de Validade */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Período de Validade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                          type="date"
                          value={promocao.dataInicio || ''}
                          onChange={(e) => {
                            setPromocao({ ...promocao, dataInicio: e.target.value });
                            setTouched(true);
                          }}
                          placeholder=""
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Fim</Label>
                        <Input
                          type="date"
                          value={promocao.dataFim || ''}
                          onChange={(e) => {
                            setPromocao({ ...promocao, dataFim: e.target.value });
                            setTouched(true);
                          }}
                          placeholder=""
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickPeriod(15)}
                      >
                        15 dias
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickPeriod(30)}
                      >
                        30 dias
                      </Button>
                    </div>
                    {diasRestantes > 0 && promocao.ativa && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Regras de Uso */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Regras de Uso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Um uso por cliente</Label>
                        <p className="text-xs text-muted-foreground">
                          Cada cupom pode ser usado apenas uma vez
                        </p>
                      </div>
                      <Switch
                        checked={promocao.umUsoPorCliente}
                        onCheckedChange={(checked) => {
                          setPromocao({ ...promocao, umUsoPorCliente: checked });
                          setTouched(true);
                        }}
                      />
                    </div>
                    <div className="border-t pt-4 mt-4" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Definir quantidade de cupons</Label>
                          <p className="text-xs text-muted-foreground">
                            Limitar quantidade total de cupons que podem ser utilizados no período
                          </p>
                        </div>
                        <Switch
                          checked={promocao.limiteCuponsAtivo || false}
                          onCheckedChange={(checked) => {
                            setPromocao({ 
                              ...promocao, 
                              limiteCuponsAtivo: checked,
                              limiteCupons: checked ? (promocao.limiteCupons || 10) : 0
                            });
                            setTouched(true);
                          }}
                        />
                      </div>
                      {promocao.limiteCuponsAtivo && (
                        <div className="space-y-2">
                          <Label>Quantidade máxima de cupons</Label>
                          <Input
                            type="number"
                            min="1"
                            value={promocao.limiteCupons || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setPromocao({ ...promocao, limiteCupons: value > 0 ? value : 0 });
                              setTouched(true);
                            }}
                            placeholder="10"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <p className="text-xs text-muted-foreground">
                            Quando atingir este limite, a promoção será desativada automaticamente
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-4 mt-4" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Enviar cupom automaticamente por WhatsApp</Label>
                          <p className="text-xs text-muted-foreground">
                            Enviar mensagem com o cupom quando gerado
                          </p>
                        </div>
                        <Switch
                          checked={false}
                          disabled={true}
                          onCheckedChange={() => {}}
                        />
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-800">
                            Esta funcionalidade será implementada no futuro. Por enquanto, os cupons devem ser enviados manualmente.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Resumo Visual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo da Promoção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-primary/10 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{aniversariantes.length}</p>
                        <p className="text-sm text-muted-foreground">Clientes Elegíveis</p>
                      </div>
                      <div className="text-center p-4 bg-primary/10 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{cupons.length}</p>
                        <p className="text-sm text-muted-foreground">Cupons Gerados</p>
                      </div>
                      <div className="text-center p-4 bg-green-500/10 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{cuponsUtilizados}</p>
                        <p className="text-sm text-muted-foreground">Utilizados</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">{atendimentoPendente}</p>
                        <p className="text-sm text-muted-foreground">Atendimento Pendente</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Cupons */}
                {cupons.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cupons Gerados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto max-h-[300px]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Código</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Total de Cupons</th>
                              <th className="text-left p-2">Utilizados</th>
                              <th className="text-left p-2">Restante</th>
                              <th className="text-right p-2">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cupons.map((cupom) => {
                              const status = getCupomStatus(cupom);
                              const utilizados = cuponsUsos[cupom.codigo] || 0;
                              // Buscar limite específico deste cupom do banco
                              const limiteCupom = limitesPorCupom[cupom.codigo];
                              const totalCupons = limiteCupom?.ativo && limiteCupom.limite > 0 
                                ? limiteCupom.limite 
                                : null;
                              const restante = totalCupons !== null 
                                ? Math.max(0, totalCupons - utilizados)
                                : null;
                              
                              return (
                                <tr 
                                  key={cupom.codigo} 
                                  className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedCupom(cupom);
                                    setShowCupomDetails(true);
                                  }}
                                >
                                  <td className="p-2 font-mono text-xs">{cupom.codigo}</td>
                                  <td className="p-2">
                                    <Badge variant={status.variant}>{status.label}</Badge>
                                  </td>
                                  <td className="p-2 text-sm">
                                    {totalCupons !== null ? totalCupons : 'Indefinido'}
                                  </td>
                                  <td className="p-2 text-sm">{utilizados}</td>
                                  <td className="p-2 text-sm">
                                    {restante !== null ? restante : '-'}
                                  </td>
                                  <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {(cupom.status === 'ativo' || !cupom.status) && (
                                          <DropdownMenuItem onClick={() => handlePausarCupom(cupom.codigo)}>
                                            <Pause className="h-4 w-4 mr-2" />
                                            Pausar promoção
                                          </DropdownMenuItem>
                                        )}
                                        {cupom.status === 'pausado' && (
                                          <DropdownMenuItem onClick={() => handleAtivarCupom(cupom.codigo)}>
                                            <Play className="h-4 w-4 mr-2" />
                                            Ativar novamente
                                          </DropdownMenuItem>
                                        )}
                                        {(cupom.status !== 'cancelado' && cupom.status !== 'pausado') && (
                                          <DropdownMenuItem 
                                            onClick={() => handleCancelarCupom(cupom.codigo)}
                                            className="text-red-600"
                                          >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Cancelar promoção
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem 
                                          onClick={() => handleExcluirCupom(cupom.codigo)}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end items-center pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateCupom}
                className="gap-2 bg-green-500 hover:bg-green-600 text-white"
              >
                <Plus className="h-4 w-4" />
                Criar Cupom
              </Button>
              <Button onClick={handleSave} className="gap-2" disabled={!touched && promocao.ativa}>
                <Save className="h-4 w-4" />
                Salvar Configurações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar a promoção? Os cupons já gerados permanecerão, mas novos cupons não serão criados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Detalhes do Cupom */}
      {selectedCupom && (
        <CouponDetailsModal
          open={showCupomDetails}
          onOpenChange={setShowCupomDetails}
          cupom={selectedCupom}
          userId={user?.id}
        />
      )}

    </>
  );
};

// Componente Modal de Detalhes do Cupom
interface CouponDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cupom: CupomMes;
  userId?: string;
}

const CouponDetailsModal = ({ open, onOpenChange, cupom, userId }: CouponDetailsModalProps) => {
  // Buscar usos do cupom com informações dos clientes e agendamentos
  const { data: cupomUsages = [], isLoading } = useQuery({
    queryKey: ['coupon-details', cupom.codigo, userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Buscar usos do cupom - normalizar o código para garantir match correto
      const codigoNormalizado = cupom.codigo.toUpperCase().trim();
      
      // Buscar todos os usos do usuário e filtrar pelo código (case-insensitive)
      const { data: todosUsos, error: usosError } = await supabase
        .from('coupon_uses')
        .select('*')
        .eq('user_id', userId);
      
      if (usosError) {
        console.error('Erro ao buscar usos do cupom:', usosError);
        throw usosError;
      }
      
      // Filtrar pelo código normalizado (case-insensitive)
      const usos = (todosUsos || []).filter((uso: any) => {
        if (!uso.codigo_cupom) return false;
        const codigoUso = uso.codigo_cupom.toUpperCase().trim();
        return codigoUso === codigoNormalizado;
      });
      
      // Ordenar por usado_em (se existir) ou manter ordem natural
      if (usos.length > 0 && usos[0].usado_em) {
        usos.sort((a: any, b: any) => {
          const dateA = new Date(a.usado_em || 0).getTime();
          const dateB = new Date(b.usado_em || 0).getTime();
          return dateB - dateA; // Mais recente primeiro
        });
      }
      
      // Buscar agendamentos relacionados
      const appointmentIds = (usos || [])
        .map((uso: any) => uso.appointment_id)
        .filter(Boolean);
      
      let appointmentsMap: Record<string, any> = {};
      
      if (appointmentIds.length > 0) {
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select('id, client_name, client_phone, appointment_date, appointment_time, status, total_amount, updated_at')
          .in('id', appointmentIds)
          .eq('user_id', userId);
        
        if (appointmentsError) throw appointmentsError;
        
        // Criar mapa de agendamentos por ID
        appointmentsMap = (appointments || []).reduce((acc: Record<string, any>, apt: any) => {
          acc[apt.id] = apt;
          return acc;
        }, {});
      }
      
      // Buscar clientes pelo telefone para casos onde não há appointment_id
      const telefones = (usos || [])
        .filter((uso: any) => !uso.appointment_id && uso.cliente_telefone)
        .map((uso: any) => uso.cliente_telefone.replace(/\D/g, ''))
        .filter(Boolean);
      
      let clientsMap: Record<string, any> = {};
      
      if (telefones.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('phone, name')
          .eq('user_id', userId)
          .in('phone', telefones);
        
        if (!clientsError && clients) {
          // Criar mapa de clientes por telefone normalizado
          clientsMap = clients.reduce((acc: Record<string, any>, client: any) => {
            const telNormalizado = client.phone.replace(/\D/g, '');
            acc[telNormalizado] = client;
            return acc;
          }, {});
        }
      }
      
      // Combinar dados - usar dados do appointment se existir, senão buscar cliente pelo telefone
      const data = (usos || []).map((uso: any) => {
        let appointment = null;
        
        // Se tem appointment_id, buscar no mapa
        if (uso.appointment_id) {
          appointment = appointmentsMap[uso.appointment_id] || null;
        }
        
        // Se não tem appointment mas tem telefone, buscar cliente
        if (!appointment && uso.cliente_telefone) {
          const telNormalizado = uso.cliente_telefone.replace(/\D/g, '');
          const client = clientsMap[telNormalizado];
          
          if (client) {
            appointment = {
              id: null,
              client_name: client.name,
              client_phone: client.phone,
              appointment_date: null,
              appointment_time: null,
              status: null,
              total_amount: uso.valor_final || null,
              updated_at: null
            };
          } else {
            // Usar dados do coupon_uses como fallback
            appointment = {
              id: null,
              client_name: null,
              client_phone: uso.cliente_telefone || null,
              appointment_date: null,
              appointment_time: null,
              status: null,
              total_amount: uso.valor_final || null,
              updated_at: null
            };
          }
        }
        
        return {
          ...uso,
          appointments: appointment
        };
      });
      
      return data || [];
    },
    enabled: !!userId && open,
  });

  // Buscar informações da promoção do backend
  const { data: promotionData } = useQuery({
    queryKey: ['promotion-details', cupom.codigo, userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // Normalizar código para busca case-insensitive
      const codigoNormalizado = cupom.codigo.toUpperCase().trim();
      
      // Buscar todas as promoções do usuário e filtrar pelo código normalizado
      const { data: todasPromocoes, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Erro ao buscar promoção:', error);
        return null;
      }
      
      // Filtrar pelo código normalizado (case-insensitive)
      const data = (todasPromocoes || []).find((promo: any) => 
        promo.nome_cupom && promo.nome_cupom.toUpperCase().trim() === codigoNormalizado
      ) || null;
      
      return data;
    },
    enabled: !!userId && open,
  });

  const utilizados = cupomUsages.length;
  const atendidos = cupomUsages.filter((uso: any) => uso.appointments?.status === 'finalizado').length;

  // Buscar limite específico deste cupom
  const totalCupons = promotionData?.limite_cupons_ativo && promotionData.limite_cupons > 0
    ? promotionData.limite_cupons
    : null;
  const restante = totalCupons !== null
    ? Math.max(0, totalCupons - utilizados)
    : null;

  const getStatus = () => {
    if (cupom.status === 'cancelado') return { label: 'Cancelado', variant: 'destructive' as const };
    if (cupom.status === 'pausado') return { label: 'Pausado', variant: 'secondary' as const };
    return { label: 'Disponível', variant: 'outline' as const };
  };

  const status = getStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Detalhes do Cupom: {cupom.codigo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Informações do Cupom */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Cupom</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Código</p>
                  <p className="font-mono font-semibold">{cupom.codigo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Desconto</p>
                  <p className="font-semibold">{cupom.percentualDesconto}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total de Cupons</p>
                  <p className="font-semibold">{totalCupons !== null ? totalCupons : 'Indefinido'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Utilizados</p>
                  <p className="font-semibold text-blue-600">{utilizados}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Atendidos</p>
                  <p className="font-semibold text-green-600">{atendidos}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Restante</p>
                  <p className="font-semibold">{restante !== null ? restante : '-'}</p>
                </div>
                {promotionData?.data_inicio && promotionData?.data_fim && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Período</p>
                    <p className="text-xs">
                      {(() => {
                        // Parse manual da data para evitar problemas de timezone
                        const parseDate = (dateStr: string) => {
                          const [year, month, day] = dateStr.split('-');
                          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
                        };
                        return `${parseDate(promotionData.data_inicio)} - ${parseDate(promotionData.data_fim)}`;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Clientes que Utilizaram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes que Utilizaram o Cupom
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : cupomUsages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cliente utilizou este cupom ainda.</p>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Cliente</th>
                        <th className="text-left p-2">Telefone</th>
                        <th className="text-left p-2">Data do Agendamento</th>
                        <th className="text-left p-2">Valor</th>
                        <th className="text-left p-2">Data do Atendimento</th>
                        <th className="text-left p-2">Cliente Atendida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cupomUsages.map((uso: any, index: number) => {
                        const appointment = uso.appointments;
                        const foiAtendido = appointment?.status === 'finalizado';
                        
                        return (
                          <tr key={index} className="border-b hover:bg-accent/50">
                            <td className="p-2 font-medium">
                              {appointment?.client_name || 'N/A'}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {appointment?.client_phone || uso.cliente_telefone || 'N/A'}
                            </td>
                            <td className="p-2">
                              {appointment?.appointment_date
                                ? (() => {
                                    // Parse manual da data para evitar problemas de timezone
                                    const parseDate = (dateStr: string) => {
                                      const [year, month, day] = dateStr.split('-');
                                      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
                                    };
                                    const dateFormatted = parseDate(appointment.appointment_date);
                                    return appointment?.appointment_time 
                                      ? `${dateFormatted} ${appointment.appointment_time}` 
                                      : dateFormatted;
                                  })()
                                : uso.usado_em
                                  ? format(new Date(uso.usado_em), 'dd/MM/yyyy', { locale: ptBR })
                                  : 'N/A'}
                            </td>
                            <td className="p-2">
                              {appointment?.total_amount
                                ? `R$ ${Number(appointment.total_amount).toFixed(2)}`
                                : uso.valor_final
                                  ? `R$ ${Number(uso.valor_final).toFixed(2)}`
                                  : 'N/A'}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {foiAtendido && appointment?.updated_at ? (
                                (() => {
                                  // Parse manual da data para evitar problemas de timezone
                                  const dateStr = appointment.updated_at;
                                  const date = new Date(dateStr);
                                  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
                                })()
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-2">
                              {foiAtendido ? (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Sim
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Não
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

