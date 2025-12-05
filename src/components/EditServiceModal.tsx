
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Edit, DollarSign, Clock, Tag, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const serviceSchema = z.object({
  name: z.string().min(1, 'Nome do serviço é obrigatório'),
  description: z.string().optional(),
  price: z.string().min(1, 'Preço é obrigatório'),
  duration: z.string().min(1, 'Duração é obrigatória'),
  category: z.string().optional(),
  category_id: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: any;
}

export const EditServiceModal = ({ open, onOpenChange, service }: EditServiceModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
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

  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name || '',
      description: service?.description || '',
      price: service?.price?.toString() || '',
      duration: service?.duration?.toString() || '',
      category: service?.category || '',
      category_id: service?.category_id || '',
    },
  });

  useEffect(() => {
    if (service) {
      // Formatar preço com vírgula
      const formattedPrice = service.price 
        ? service.price.toString().replace('.', ',')
        : '';
      
      form.reset({
        name: service.name || '',
        description: service.description || '',
        price: formattedPrice,
        duration: service.duration?.toString() || '',
        category: service.category || '',
        category_id: service.category_id || '',
      });
    }
  }, [service, form]);

  const updateServiceMutation = useMutation({
    mutationFn: async (data: ServiceForm) => {
      if (!user?.id || !service?.id) throw new Error('Dados insuficientes');

      // Converter preço de string para número (aceita vírgula)
      const price = parseFloat(data.price.replace(',', '.'));
      const duration = parseInt(data.duration);

      const { error } = await supabase
        .from('services')
        .update({
          name: data.name,
          description: data.description,
          price: price,
          duration: duration,
          category: data.category_id ? undefined : data.category,
          category_id: data.category_id || null,
        })
        .eq('id', service.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: 'Serviço atualizado',
        description: 'Serviço foi atualizado com sucesso.',
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar serviço',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ServiceForm) => {
    updateServiceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Edit className="h-5 w-5 text-primary" />
            Editar Serviço
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do serviço. Os campos marcados são obrigatórios.
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
                      placeholder="Ex: Corte + Escova, Manicure Completa..." 
                      {...field} 
                      className="text-base"
                    />
                  </FormControl>
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
                    <Textarea 
                      placeholder="Ex: Corte com tesoura, escova progressiva e finalização..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                          className="pl-9 text-base"
                          {...field}
                          onChange={(e) => {
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
                      Duração (min)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="90"
                          className="pl-9 text-base"
                          {...field}
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
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateServiceMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateServiceMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
                size="lg"
              >
                {updateServiceMutation.isPending ? (
                  'Salvando...'
                ) : (
                  <>
                    <Edit className="h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
