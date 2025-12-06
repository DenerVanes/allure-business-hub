import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const leadSchema = z.object({
  salon_name: z.string().min(1, 'Nome do salão é obrigatório'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  instagram: z.string().optional(),
  origin: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewLeadModal({ open, onOpenChange }: NewLeadModalProps) {
  const queryClient = useQueryClient();
  const [firstContactDate, setFirstContactDate] = useState<Date | undefined>(new Date());

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      origin: '',
    },
  });

  const origin = watch('origin');

  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const { error } = await (supabase
        .from('leads' as any)
        .insert({
          salon_name: data.salon_name,
          contact_name: data.contact_name || null,
          phone: data.phone || null,
          email: data.email || null,
          city: data.city || null,
          neighborhood: data.neighborhood || null,
          instagram: data.instagram || null,
          origin: data.origin || null,
          first_contact_date: firstContactDate ? format(firstContactDate, 'yyyy-MM-dd') : null,
          status: 'novo_lead',
          heat_score: 0,
        }));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead cadastrado',
        description: 'O lead foi adicionado ao funil com sucesso.',
      });
      reset();
      setFirstContactDate(new Date());
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível cadastrar o lead.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: LeadFormData) => {
    createLeadMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
            <UserPlus className="h-5 w-5" style={{ color: '#8E44EC' }} />
            Novo Lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome do Salão */}
          <div>
            <Label htmlFor="salon_name" className="text-sm font-medium text-[#5A4A5E]">
              Nome do Salão / Profissional *
            </Label>
            <Input
              id="salon_name"
              {...register('salon_name')}
              placeholder="Ex: Salão da Ana"
              className="mt-1"
              style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
            />
            {errors.salon_name && (
              <p className="text-sm text-red-500 mt-1">{errors.salon_name.message}</p>
            )}
          </div>

          {/* Nome do Contato */}
          <div>
            <Label htmlFor="contact_name" className="text-sm font-medium text-[#5A4A5E]">
              Nome do Contato
            </Label>
            <Input
              id="contact_name"
              {...register('contact_name')}
              placeholder="Nome da pessoa responsável"
              className="mt-1"
              style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
            />
          </div>

          {/* Telefone e Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-[#5A4A5E]">
                Telefone
              </Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="(43) 99999-9999"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#5A4A5E]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="email@exemplo.com"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Cidade e Bairro */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city" className="text-sm font-medium text-[#5A4A5E]">
                Cidade
              </Label>
              <Input
                id="city"
                {...register('city')}
                placeholder="Ex: Londrina"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>
            <div>
              <Label htmlFor="neighborhood" className="text-sm font-medium text-[#5A4A5E]">
                Bairro
              </Label>
              <Input
                id="neighborhood"
                {...register('neighborhood')}
                placeholder="Ex: Centro"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>
          </div>

          {/* Instagram */}
          <div>
            <Label htmlFor="instagram" className="text-sm font-medium text-[#5A4A5E]">
              Instagram
            </Label>
            <Input
              id="instagram"
              {...register('instagram')}
              placeholder="@seuinstagram"
              className="mt-1"
              style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
            />
          </div>

          {/* Origem e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-[#5A4A5E]">
                Origem
              </Label>
              <Select value={origin} onValueChange={(value) => setValue('origin', value)}>
                <SelectTrigger className="mt-1" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-[#5A4A5E]">
                Data do 1º Contato
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1 justify-start text-left font-normal"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {firstContactDate ? format(firstContactDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={firstContactDate}
                    onSelect={setFirstContactDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
              style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="rounded-full"
              style={{ backgroundColor: '#8E44EC', color: 'white' }}
            >
              {createLeadMutation.isPending ? 'Salvando...' : 'Cadastrar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
