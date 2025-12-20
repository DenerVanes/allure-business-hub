import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const downsellSchema = z.object({
  main_service_id: z.string().min(1, 'Serviço principal é obrigatório'),
  linked_service_id: z.string().min(1, 'Serviço alternativo é obrigatório'),
  custom_duration_minutes: z.string().optional(),
  promotional_price: z.string().min(1, 'Valor promocional é obrigatório'),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres'),
});

type DownsellFormData = z.infer<typeof downsellSchema>;

interface DownsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCampaign?: any;
}

export function DownsellModal({ open, onOpenChange, editingCampaign }: DownsellModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linkedServicePrice, setLinkedServicePrice] = useState<number>(0);

  const { data: services = [] } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<DownsellFormData>({
    resolver: zodResolver(downsellSchema),
    defaultValues: {
      main_service_id: '',
      linked_service_id: '',
      custom_duration_minutes: '',
      promotional_price: '',
      message: '',
    }
  });

  const mainServiceId = watch('main_service_id');
  const linkedServiceId = watch('linked_service_id');

  // Atualizar preço do serviço vinculado quando selecionado
  useEffect(() => {
    if (linkedServiceId) {
      const service = services.find(s => s.id === linkedServiceId);
      if (service) {
        setLinkedServicePrice(service.price);
        // Preencher valor promocional com o preço original se não estiver editando
        if (!editingCampaign && !watch('promotional_price')) {
          setValue('promotional_price', service.price.toString());
        }
      }
    }
  }, [linkedServiceId, services, setValue, watch, editingCampaign]);

  // Preencher formulário quando editando
  useEffect(() => {
    if (editingCampaign && open) {
      reset({
        main_service_id: editingCampaign.main_service_id,
        linked_service_id: editingCampaign.linked_service_id,
        custom_duration_minutes: editingCampaign.custom_duration_minutes 
          ? formatMinutesToTime(editingCampaign.custom_duration_minutes) 
          : '',
        promotional_price: editingCampaign.extra_price.toString(), // Downsell usa extra_price como valor promocional
        message: editingCampaign.message,
      });
      const service = services.find(s => s.id === editingCampaign.linked_service_id);
      if (service) {
        setLinkedServicePrice(service.price);
      }
    } else if (!editingCampaign && open) {
      reset({
        main_service_id: '',
        linked_service_id: '',
        custom_duration_minutes: '',
        promotional_price: '',
        message: '',
      });
      setLinkedServicePrice(0);
    }
  }, [editingCampaign, open, services, reset, watch, setValue]);

  // Gerar mensagem padrão quando serviços são selecionados
  useEffect(() => {
    if (mainServiceId && linkedServiceId && !editingCampaign) {
      const linkedService = services.find(s => s.id === linkedServiceId);
      const promotionalPrice = watch('promotional_price');
      
      if (linkedService && promotionalPrice) {
        const price = parseFloat(promotionalPrice.replace(',', '.')) || 0;
        const defaultMessage = `Sem problemas 😊 Que tal então um ${linkedService.name} por apenas R$ ${price.toFixed(2)}?`;
        setValue('message', defaultMessage);
      }
    }
  }, [mainServiceId, linkedServiceId, watch, setValue, services, editingCampaign]);

  // Função para converter formato HH:MM ou minutos para minutos
  const parseDurationToMinutes = (value: string): number | null => {
    if (!value || value.trim() === '') return null;
    
    // Verifica se está no formato HH:MM
    const timeFormat = /^(\d{1,2}):(\d{2})$/;
    const match = value.match(timeFormat);
    
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (minutes >= 60) return null; // Validação: minutos não podem ser >= 60
      return hours * 60 + minutes;
    }
    
    // Caso contrário, trata como minutos
    const minutes = parseInt(value, 10);
    return isNaN(minutes) ? null : minutes;
  };

  // Função para formatar minutos para HH:MM
  const formatMinutesToTime = (minutes: number | null): string => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const createMutation = useMutation({
    mutationFn: async (data: DownsellFormData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const durationMinutes = data.custom_duration_minutes 
        ? parseDurationToMinutes(data.custom_duration_minutes) 
        : null;

      const payload = {
        user_id: user.id,
        type: 'downsell' as const,
        main_service_id: data.main_service_id,
        linked_service_id: data.linked_service_id,
        custom_duration_minutes: durationMinutes,
        extra_price: parseFloat(data.promotional_price.replace(',', '.')) || 0, // Para downsell, extra_price é o valor promocional
        message: data.message,
        active: true,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('upsell_downsell_campaigns')
          .update(payload)
          .eq('id', editingCampaign.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('upsell_downsell_campaigns')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-downsell-campaigns'] });
      toast({
        title: editingCampaign ? 'Downsell atualizado' : 'Downsell criado',
        description: 'Campanha salva com sucesso!',
      });
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar campanha.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: DownsellFormData) => {
    // Validar que serviços são diferentes
    if (data.main_service_id === data.linked_service_id) {
      toast({
        title: 'Erro',
        description: 'O serviço principal e o serviço alternativo devem ser diferentes.',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCampaign ? 'Editar Downsell' : 'Criar Downsell'}
          </DialogTitle>
          <DialogDescription>
            Configure uma oferta alternativa que será exibida quando o cliente recusar o Upsell.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="main_service_id">Serviço Principal *</Label>
            <Select
              value={watch('main_service_id')}
              onValueChange={(value) => setValue('main_service_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço principal" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - R$ {service.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.main_service_id && (
              <p className="text-sm text-destructive">{errors.main_service_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="linked_service_id">Serviço Alternativo / Benefício *</Label>
            <Select
              value={watch('linked_service_id')}
              onValueChange={(value) => setValue('linked_service_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço alternativo" />
              </SelectTrigger>
              <SelectContent>
                {services
                  .filter(s => s.id !== mainServiceId)
                  .map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - R$ {service.price.toFixed(2)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.linked_service_id && (
              <p className="text-sm text-destructive">{errors.linked_service_id.message}</p>
            )}
            {linkedServicePrice > 0 && (
              <p className="text-sm text-muted-foreground">
                Valor original do serviço: R$ {linkedServicePrice.toFixed(2)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_duration_minutes">Tempo Total</Label>
            <Input
              id="custom_duration_minutes"
              type="text"
              maxLength={5}
              value={watch('custom_duration_minutes') || ''}
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
                
                // Limita a 4 dígitos (para HH:MM)
                if (value.length > 4) {
                  value = value.slice(0, 4);
                }
                
                // Formata automaticamente para HH:MM
                if (value.length >= 2) {
                  // Se já tem 2 dígitos ou mais, adiciona os ":"
                  const hours = value.slice(0, 2);
                  const minutes = value.slice(2, 4);
                  value = `${hours}:${minutes}`;
                }
                
                setValue('custom_duration_minutes', value, { shouldValidate: false });
              }}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value) {
                  const minutes = parseDurationToMinutes(value);
                  if (minutes !== null && minutes > 0) {
                    // Garante que está no formato HH:MM
                    const formatted = formatMinutesToTime(minutes);
                    if (formatted) {
                      setValue('custom_duration_minutes', formatted);
                    }
                  } else if (value.length > 0) {
                    // Se não conseguir parsear mas tem valor, limpa o campo
                    setValue('custom_duration_minutes', '');
                  }
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotional_price">Valor Promocional (R$) *</Label>
            <Input
              id="promotional_price"
              type="text"
              placeholder="Ex: 15,00"
              {...register('promotional_price')}
            />
            {errors.promotional_price && (
              <p className="text-sm text-destructive">{errors.promotional_price.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Este será o valor promocional oferecido ao cliente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem Personalizada *</Label>
            <Textarea
              id="message"
              placeholder="Ex: Sem problemas 😊 Que tal então um Spa Express por apenas R$ 15?"
              rows={4}
              {...register('message')}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Esta mensagem será exibida ao cliente quando ele recusar o Upsell.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : editingCampaign ? 'Atualizar' : 'Criar Downsell'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


