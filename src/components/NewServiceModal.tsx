
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, DollarSign, Clock, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Função para formatar durante a digitação (apenas adiciona : no meio)
const formatTimeOnChange = (value: string): string => {
  // Remove tudo que não é número ou dois pontos
  const cleaned = value.replace(/[^\d:]/g, '');
  
  // Se já tem dois pontos, permite editar livremente (apenas números)
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      // Limita a 2 dígitos para horas e 2 para minutos
      const firstPart = parts[0].slice(0, 2);
      const secondPart = parts[1].slice(0, 2);
      return `${firstPart}:${secondPart}`;
    }
    return cleaned;
  }
  
  // Se não tem dois pontos, remove caracteres não numéricos
  const numbers = cleaned.replace(/\D/g, '');
  
  // Se tem mais de 2 dígitos, adiciona os dois pontos automaticamente após os 2 primeiros
  if (numbers.length > 2) {
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  }
  
  // Se tem 2 dígitos ou menos, deixa como está (sem preencher)
  return numbers;
};

// Função para formatar quando sair do campo (completa a formatação)
const formatTimeOnBlur = (value: string): string => {
  if (!value || value.trim() === '') {
    return '';
  }
  
  // Remove caracteres não numéricos exceto dois pontos
  const cleaned = value.replace(/[^\d:]/g, '');
  
  // Se já está no formato com dois pontos, apenas garante formato HH:MM válido
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      const hours = Math.min(23, Math.max(0, parseInt(parts[0] || '0', 10) || 0));
      const minutes = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10) || 0));
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      return `${h}:${m}`;
    }
  }
  
  // Se não tem dois pontos, interpreta como minutos e converte
  const numbers = cleaned.replace(/\D/g, '');
  if (numbers.length === 0) {
    return '';
  }
  
  const totalMinutes = parseInt(numbers, 10);
  
  // Se for maior que 59, converte para horas e minutos
  if (totalMinutes > 59) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const h = Math.min(23, hours).toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m}`;
  } else {
    // Se for <= 59, formata como 00:XX
    return `00:${totalMinutes.toString().padStart(2, '0')}`;
  }
};

// Função para converter HH:MM para minutos
const timeToMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return 0;
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
};

// Função para validar formato HH:MM
const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

const serviceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  price: z.string().min(1, 'Preço é obrigatório'),
  duration: z.string().min(1, 'Duração é obrigatória').refine(
    (val) => {
      // Formata o valor antes de validar
      const formatted = formatTimeOnBlur(val);
      return isValidTimeFormat(formatted) && timeToMinutes(formatted) > 0;
    },
    { message: 'Duração deve estar no formato HH:MM (ex: 01:30)' }
  ),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface NewServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceCreated?: () => void;
}


export const NewServiceModal = ({ open, onOpenChange, onServiceCreated }: NewServiceModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar categorias personalizadas do usuário
  const { data: customCategories = [] } = useQuery({
    queryKey: ['service-categories', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Categorias padrão
  const defaultCategories = [
    'Cabelo',
    'Unha',
    'Sobrancelha',
    'Depilação',
    'Massagem',
    'Estética',
    'Outros'
  ];

  // Combinar categorias padrão com as personalizadas
  const allCategories = [
    ...defaultCategories,
    ...customCategories.map(cat => cat.name)
  ];

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: '',
      duration: '',
      category: '',
      description: '',
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Converter preço de string para número
      const price = parseFloat(data.price.replace(',', '.'));
      // Converter formato HH:MM para minutos
      const duration = timeToMinutes(data.duration);

      const { error } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
          name: data.name,
          price: price,
          duration: duration,
          category: data.category,
          description: data.description || null,
          active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: 'Serviço criado!',
        description: 'O serviço foi criado com sucesso.',
      });
      form.reset();
      onServiceCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao criar serviço:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o serviço. Tente novamente.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = async (data: ServiceFormData) => {
    createServiceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Novo Serviço
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo serviço para oferecer aos seus clientes. Preencha os campos obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Nome do Serviço
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Corte + Escova, Manicure Completa, Depilação..." 
                      {...field} 
                      className="text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Preço (R$)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="129,90" 
                          {...field}
                          className="pl-9 text-base"
                          onChange={(e) => {
                            // Formatação básica do preço
                            let value = e.target.value.replace(/[^\d,]/g, '');
                            field.onChange(value);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Duração
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="01:30"
                          className="pl-9 text-base"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatTimeOnChange(e.target.value);
                            field.onChange(formatted);
                          }}
                          onBlur={(e) => {
                            // Garantir que sempre tenha o formato completo HH:MM
                            const value = e.target.value.trim();
                            if (!value) {
                              field.onBlur();
                              return;
                            }
                            
                            // Usa a função formatTimeOnBlur para completar a formatação
                            const formatted = formatTimeOnBlur(value);
                            if (formatted) {
                              field.onChange(formatted);
                            }
                            field.onBlur();
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descrição (opcional)
                  </FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Ex: Corte com tesoura, escova progressiva e finalização com secador..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createServiceMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
                size="lg"
              >
                {createServiceMutation.isPending ? (
                  "Salvando..."
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Criar Serviço
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
