
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, X, Clock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Schema para bloqueio de dia inteiro
const blockSchema = z.object({
  startDate: z.date({ required_error: 'Data inicial é obrigatória' }),
  endDate: z.date({ required_error: 'Data final é obrigatória' }),
  reason: z.string().min(1, 'Motivo é obrigatório'),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'Data final deve ser maior ou igual à data inicial',
  path: ['endDate'],
});

// Schema para bloqueio por horário
const timeBlockSchema = z.object({
  blockDate: z.date({ required_error: 'Data é obrigatória' }),
  startTime: z.string().min(1, 'Horário de início é obrigatório'),
  endTime: z.string().min(1, 'Horário de término é obrigatório'),
  reason: z.string().optional(),
}).refine((data) => {
  if (!data.startTime || !data.endTime) return true;
  return data.startTime < data.endTime;
}, {
  message: 'Horário de término deve ser maior que o horário de início',
  path: ['endTime'],
});

type BlockFormData = z.infer<typeof blockSchema>;
type TimeBlockFormData = z.infer<typeof timeBlockSchema>;

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

  // Form para bloqueio de dia inteiro
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

  // Form para bloqueio por horário
  const {
    register: registerTimeBlock,
    handleSubmit: handleSubmitTimeBlock,
    reset: resetTimeBlock,
    setValue: setValueTimeBlock,
    watch: watchTimeBlock,
    formState: { errors: errorsTimeBlock },
  } = useForm<TimeBlockFormData>({
    resolver: zodResolver(timeBlockSchema),
    defaultValues: {
      startTime: '',
      endTime: '',
      reason: '',
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const blockDate = watchTimeBlock('blockDate');

  // Buscar bloqueios de dia inteiro existentes
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

  // Buscar bloqueios por horário existentes
  const { data: timeBlocks = [] } = useQuery({
    queryKey: ['collaborator-time-blocks', collaboratorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_time_blocks' as any)
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .order('block_date')
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!collaboratorId && open,
  });

  // Mutation para criar bloqueio de dia inteiro
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

  // Mutation para criar bloqueio por horário
  const createTimeBlockMutation = useMutation({
    mutationFn: async (data: TimeBlockFormData) => {
      const formattedDate = format(data.blockDate, 'yyyy-MM-dd');
      
      // Verificar se há sobreposição com outros bloqueios do mesmo dia
      const existingBlocks = timeBlocks.filter(
        (block: any) => block.block_date === formattedDate
      );

      const [newStartH, newStartM] = data.startTime.split(':').map(Number);
      const [newEndH, newEndM] = data.endTime.split(':').map(Number);
      const newStart = newStartH * 60 + newStartM;
      const newEnd = newEndH * 60 + newEndM;

      for (const block of existingBlocks) {
        const [blockStartH, blockStartM] = (block as any).start_time.split(':').map(Number);
        const [blockEndH, blockEndM] = (block as any).end_time.split(':').map(Number);
        const blockStart = blockStartH * 60 + blockStartM;
        const blockEnd = blockEndH * 60 + blockEndM;

        if (newStart < blockEnd && newEnd > blockStart) {
          throw new Error('Já existe um bloqueio que sobrepõe este horário neste dia.');
        }
      }

      const { error } = await supabase
        .from('collaborator_time_blocks' as any)
        .insert({
          collaborator_id: collaboratorId,
          block_date: formattedDate,
          start_time: data.startTime,
          end_time: data.endTime,
          reason: data.reason || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborator-time-blocks'] });
      toast({
        title: 'Bloqueio de horário criado',
        description: 'Bloqueio por horário foi criado com sucesso.',
      });
      resetTimeBlock();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o bloqueio de horário.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para deletar bloqueio de dia inteiro
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

  // Mutation para deletar bloqueio por horário
  const deleteTimeBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collaborator_time_blocks' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborator-time-blocks'] });
      toast({
        title: 'Bloqueio de horário removido',
        description: 'Bloqueio por horário foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o bloqueio de horário.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: BlockFormData) => {
    createBlockMutation.mutate(data);
  };

  const onSubmitTimeBlock = (data: TimeBlockFormData) => {
    createTimeBlockMutation.mutate(data);
  };

  const getTodayInBrazil = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Gerar opções de horário
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min of ['00', '30']) {
      timeOptions.push(`${hour.toString().padStart(2, '0')}:${min}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloqueios de Agenda - {collaboratorName}</DialogTitle>
        </DialogHeader>

        {/* Seção: Bloqueio de Dia Inteiro */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Bloqueio de Dia Inteiro
          </h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/30">
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
                  <p className="text-sm text-destructive">{errors.startDate.message}</p>
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
                  <p className="text-sm text-destructive">{errors.endDate.message}</p>
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
                <p className="text-sm text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={createBlockMutation.isPending}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              {createBlockMutation.isPending ? 'Criando...' : 'Criar Bloqueio de Dia Inteiro'}
            </Button>
          </form>
        </div>

        <Separator className="my-4" />

        {/* Seção: Bloqueio por Horário */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Bloqueio por Horário (Avançado)
          </h3>
          
          <form onSubmit={handleSubmitTimeBlock(onSubmitTimeBlock)} className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !blockDate && "text-muted-foreground"
                      )}
                    >
                      {blockDate ? (
                        format(blockDate, "dd/MM/yyyy")
                      ) : (
                        <span>Data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={blockDate}
                      onSelect={(date) => {
                        if (date) {
                          const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
                          setValueTimeBlock('blockDate', localDate);
                        }
                      }}
                      disabled={(date) => date < getTodayInBrazil()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errorsTimeBlock.blockDate && (
                  <p className="text-sm text-destructive">{errorsTimeBlock.blockDate.message}</p>
                )}
              </div>

              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  {...registerTimeBlock('startTime')}
                  className="w-full"
                />
                {errorsTimeBlock.startTime && (
                  <p className="text-sm text-destructive">{errorsTimeBlock.startTime.message}</p>
                )}
              </div>

              <div>
                <Label>Término</Label>
                <Input
                  type="time"
                  {...registerTimeBlock('endTime')}
                  className="w-full"
                />
                {errorsTimeBlock.endTime && (
                  <p className="text-sm text-destructive">{errorsTimeBlock.endTime.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="timeBlockReason">Motivo (opcional)</Label>
              <Input
                id="timeBlockReason"
                {...registerTimeBlock('reason')}
                placeholder="Ex: Consulta médica, Compromisso pessoal"
              />
            </div>

            <Button
              type="submit"
              disabled={createTimeBlockMutation.isPending}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              {createTimeBlockMutation.isPending ? 'Criando...' : 'Adicionar Bloqueio de Horário'}
            </Button>
          </form>
        </div>

        <Separator className="my-4" />

        {/* Bloqueios Existentes */}
        <div className="space-y-4">
          <h3 className="font-medium">Bloqueios Existentes</h3>
          
          {/* Bloqueios de Dia Inteiro */}
          {blocks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Dias Completos:</p>
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      📅 {format(parseISO(block.start_date), 'dd/MM/yyyy')} até{' '}
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
          )}

          {/* Bloqueios por Horário */}
          {timeBlocks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Por Horário:</p>
              {timeBlocks.map((block: any) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      📅 {format(parseISO(block.block_date), 'dd/MM/yyyy')} — {block.start_time.slice(0, 5)} às {block.end_time.slice(0, 5)}
                    </p>
                    {block.reason && (
                      <p className="text-sm text-muted-foreground">{block.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTimeBlockMutation.mutate(block.id)}
                    disabled={deleteTimeBlockMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {blocks.length === 0 && timeBlocks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum bloqueio cadastrado
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
