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
import { Checkbox } from '@/components/ui/checkbox';
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
  seller: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewLeadModal({ open, onOpenChange }: NewLeadModalProps) {
  const queryClient = useQueryClient();
  const [firstContactDate, setFirstContactDate] = useState<Date | undefined>(new Date());
  const [hasNotContacted, setHasNotContacted] = useState(false);

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
      seller: 'sem_vendedor',
    },
  });

  const origin = watch('origin');
  const seller = watch('seller');

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
          seller: data.seller === 'sem_vendedor' || !data.seller ? null : data.seller,
          first_contact_date: hasNotContacted ? null : (firstContactDate ? format(firstContactDate, 'yyyy-MM-dd') : null),
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
      setHasNotContacted(false);
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
            <UserPlus className="h-5 w-5" style={{ color: '#8E44EC' }} />
            Novo Lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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

          {/* Cidade e Estado */}
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
                Estado
              </Label>
              <Input
                id="neighborhood"
                {...register('neighborhood')}
                placeholder="Ex: Paraná"
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

          {/* Vendedor */}
          <div>
            <Label className="text-sm font-medium text-[#5A4A5E]">
              Vendedor
            </Label>
            <Select value={seller} onValueChange={(value) => setValue('seller', value)}>
              <SelectTrigger className="mt-1" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                <SelectValue placeholder="Selecione o vendedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
                <SelectItem value="Dener Vanes">Dener Vanes</SelectItem>
                <SelectItem value="Larissa Botelho">Larissa Botelho</SelectItem>
              </SelectContent>
            </Select>
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
                    disabled={hasNotContacted}
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

          {/* Checkbox Ainda não teve contato */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasNotContacted"
              checked={hasNotContacted}
              onCheckedChange={(checked) => {
                setHasNotContacted(checked as boolean);
                if (checked) {
                  setFirstContactDate(undefined);
                } else {
                  setFirstContactDate(new Date());
                }
              }}
            />
            <Label
              htmlFor="hasNotContacted"
              className="text-sm font-medium text-[#5A4A5E] cursor-pointer"
            >
              Ainda não teve contato
            </Label>
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
