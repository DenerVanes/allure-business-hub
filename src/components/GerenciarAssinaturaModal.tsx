import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Loader2, CreditCard, XCircle, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface UserWithPlan {
  id: string;
  user_id: string;
  business_name: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  created_at: string;
  plan_expires_at: string | null;
  plan_status: 'active' | 'expired' | 'none';
}

interface GerenciarAssinaturaModalProps {
  user: UserWithPlan;
  open: boolean;
  onClose: () => void;
}

export function GerenciarAssinaturaModal({ user, open, onClose }: GerenciarAssinaturaModalProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [paidAt, setPaidAt] = useState<Date>(new Date());
  const [daysAdded, setDaysAdded] = useState<string>('30');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    try {
      return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return 'Nunca';
    }
  };

  const getStatusText = () => {
    const now = new Date();
    const expiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
    
    if (user.plan_status === 'active' && expiresAt && expiresAt > now) {
      return 'Ativo';
    } else if (user.plan_status === 'expired' || (expiresAt && expiresAt <= now)) {
      return 'Expirado';
    } else {
      return 'Nunca ativado';
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.email) {
        throw new Error('Usuário não autenticado');
      }

      const days = parseInt(daysAdded);
      if (isNaN(days) || days <= 0) {
        throw new Error('Quantidade de dias deve ser um número positivo');
      }

      const { data, error } = await (supabase.rpc as any)('admin_add_subscription_days', {
        _user_id: user.user_id,
        _paid_at: paidAt.toISOString(),
        _days_added: days,
        _admin_email: currentUser.email
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso!',
        description: 'Dias adicionados ao plano com sucesso.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar dias ao plano.',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.email) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await (supabase.rpc as any)('admin_cancel_user_plan', {
        _user_id: user.user_id,
        _admin_email: currentUser.email
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Plano cancelado!',
        description: 'O plano do usuário foi cancelado com sucesso.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar o plano.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Gerenciar Assinatura
          </DialogTitle>
          <DialogDescription>
            Adicione dias ao plano do cliente após recebimento do pagamento via PIX
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Cliente */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-sm">Dados do Cliente</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p className="font-medium">{user.business_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">E-mail</Label>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Última Renovação</Label>
                <p className="font-medium">{formatDate(user.plan_expires_at)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Data de Expiração Atual</Label>
                <p className="font-medium">
                  {user.plan_expires_at ? formatDate(user.plan_expires_at) : 'Nunca'}
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground">Status do Plano</Label>
                <p className="font-medium">{getStatusText()}</p>
              </div>
            </div>
          </div>

          {/* Campos Editáveis */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paid_at">Data do Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paidAt && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {paidAt ? format(paidAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={paidAt}
                    onSelect={(date) => date && setPaidAt(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days_added">Quantidade de Dias Liberados</Label>
              <Input
                id="days_added"
                type="number"
                min="1"
                value={daysAdded}
                onChange={(e) => setDaysAdded(e.target.value)}
                placeholder="Ex: 30, 60, 90..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Digite a quantidade de dias que serão adicionados ao plano
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-between items-center">
            {/* Botão de Cancelar Plano */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={mutation.isPending || cancelMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Plano
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Cancelar Plano do Usuário
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar o plano de <strong>{user.business_name}</strong>? 
                    O usuário perderá o acesso imediatamente após o cancelamento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending || cancelMutation.isPending}>
                Fechar
              </Button>
              <Button type="submit" disabled={mutation.isPending || cancelMutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar Dias ao Plano
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

