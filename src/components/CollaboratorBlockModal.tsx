
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const blockSchema = z.object({
  startDate: z.date({ required_error: 'Data inicial é obrigatória' }),
  endDate: z.date({ required_error: 'Data final é obrigatória' }),
  reason: z.string().min(1, 'Motivo é obrigatório'),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'Data final deve ser maior ou igual à data inicial',
  path: ['endDate'],
});

type BlockFormData = z.infer<typeof blockSchema>;

interface CollaboratorBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorId: string;
  collaboratorName: string;
}

export function CollaboratorBlockModal({ 
  open, 
  onOpenChange, 
  collaboratorId, 
  collaboratorName 
}: CollaboratorBlockModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BlockFormData>({
    resolver: zodResolver(blockSchema),
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Buscar bloqueios existentes
  const { data: blocks = [] } = useQuery({
    queryKey: ['collaborator-blocks', collaboratorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_blocks')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .order('start_date');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!collaboratorId && open,
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: BlockFormData) => {
      const { error } = await supabase
        .from('collaborator_blocks')
        .insert({
          collaborator_id: collaboratorId,
          start_date: format(data.startDate, 'yyyy-MM-dd'),
          end_date: format(data.endDate, 'yyyy-MM-dd'),
          reason: data.reason,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborator-blocks'] });
      toast({
        title: 'Bloqueio criado',
        description: 'Período de bloqueio foi criado com sucesso.',
      });
      reset();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o bloqueio.',
        variant: 'destructive',
      });
    }
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collaborator_blocks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborator-blocks'] });
      toast({
        title: 'Bloqueio removido',
        description: 'Período de bloqueio foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o bloqueio.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: BlockFormData) => {
    createBlockMutation.mutate(data);
  };

  const getTodayInBrazil = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloqueios de Agenda - {collaboratorName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    {startDate ? (
                      format(startDate, "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        // Garantir que a data seja no timezone local às 12:00
                        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
                        setValue('startDate', localDate);
                      }
                    }}
                    disabled={(date) => date < getTodayInBrazil()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && (
                <p className="text-sm text-red-500">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    {endDate ? (
                      format(endDate, "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        // Garantir que a data seja no timezone local às 12:00
                        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
                        setValue('endDate', localDate);
                      }
                    }}
                    disabled={(date) => date < (startDate || getTodayInBrazil())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && (
                <p className="text-sm text-red-500">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              {...register('reason')}
              placeholder="Ex: Férias, Licença médica, etc."
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={createBlockMutation.isPending}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            {createBlockMutation.isPending ? 'Criando...' : 'Criar Bloqueio'}
          </Button>
        </form>

        {blocks.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-3">Bloqueios Existentes</h3>
            <div className="space-y-2">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {format(parseISO(block.start_date), 'dd/MM/yyyy')} até{' '}
                      {format(parseISO(block.end_date), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">{block.reason}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBlockMutation.mutate(block.id)}
                    disabled={deleteBlockMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
