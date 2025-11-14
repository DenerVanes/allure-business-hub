
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatPhone, normalizePhone } from '@/utils/phone';
import type { Database } from '@/integrations/supabase/types';

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Data inválida'
    ),
  observations: z.string().optional(),
}).refine((data) => normalizePhone(data.phone).length >= 10, {
  path: ['phone'],
  message: 'Telefone deve conter DDD e pelo menos 10 dígitos',
});

type ClientFormData = z.infer<typeof clientSchema>;

type ClientRecord = Database['public']['Tables']['clients']['Row'];

interface NewClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRecord | null;
  onClientCreated?: (client: any) => void;
}

export const NewClientModal = ({ open, onOpenChange, client, onClientCreated }: NewClientModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      birthDate: '',
      observations: '',
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: '',
        phone: '',
        email: '',
        birthDate: '',
        observations: '',
      });
      return;
    }

    form.reset({
      name: client?.name ?? '',
      phone: formatPhone(client?.phone ?? ''),
      email: client?.email ?? '',
      birthDate: client?.birth_date
        ? client.birth_date.split('T')[0]
        : '',
      observations: client?.notes ?? '',
    });
  }, [open, client, form]);

  const handleDialogChange = (modalOpen: boolean) => {
    if (!modalOpen) {
      form.reset({
        name: '',
        phone: '',
        email: '',
        birthDate: '',
        observations: '',
      });
    }
    onOpenChange(modalOpen);
  };

  const onSubmit = async (data: ClientFormData) => {
    if (!user?.id) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para gerenciar clientes.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedName = data.name.trim();
      const normalizedPhone = normalizePhone(data.phone);

      if (!normalizedPhone || normalizedPhone.length < 10) {
        form.setError('phone', { message: 'Telefone deve conter pelo menos 10 dígitos.' });
        return;
      }

      const basePayload = {
        name: trimmedName,
        phone: normalizedPhone,
        email: data.email?.trim() ? data.email.trim() : null,
        notes: data.observations?.trim() ? data.observations.trim() : null,
        birth_date: data.birthDate ? data.birthDate : null,
        updated_at: new Date().toISOString(),
      };

      if (client?.id) {
        const { data: existing, error: findErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (findErr && findErr.code !== 'PGRST116') {
          throw findErr;
        }

        if (existing && existing.id !== client.id) {
          toast({
            title: 'Telefone já cadastrado',
            description: 'Esse telefone já está associado a outro cliente.',
            variant: 'destructive',
          });
          return;
        }

        const { error: updateErr } = await supabase
          .from('clients')
          .update(basePayload)
          .eq('id', client.id)
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        toast({
          title: 'Cliente atualizado',
          description: 'Os dados do cliente foram atualizados com sucesso.',
        });

        queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
        onClientCreated?.({ ...client, ...basePayload });
      } else {
        const { data: existing, error: findErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (findErr && findErr.code !== 'PGRST116') {
          throw findErr;
        }

        if (existing?.id) {
          toast({
            title: 'Telefone já cadastrado',
            description: 'Esse telefone já está associado a outro cliente.',
            variant: 'destructive',
          });
          return;
        }

        const { data: inserted, error: insertErr } = await supabase
          .from('clients')
          .insert({
            ...basePayload,
            created_at: new Date().toISOString(),
            user_id: user.id,
          })
          .select('*')
          .single();

        if (insertErr) throw insertErr;

        toast({
          title: 'Cliente cadastrado',
          description: 'O cliente foi cadastrado com sucesso.',
        });

        queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
        onClientCreated?.(inserted);
      }

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o cliente. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(client?.id);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Cliente' : 'Cadastrar Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do cliente selecionado.'
              : 'Adicione um novo cliente ao seu cadastro.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        inputMode="numeric"
                        {...field}
                        value={formatPhone(field.value)}
                        onChange={(e) => {
                          const digits = normalizePhone(e.target.value).slice(0, 11);
                          field.onChange(formatPhone(digits));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="cliente@email.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre o cliente..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  'Salvando...'
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    {isEditing ? 'Salvar alterações' : 'Cadastrar Cliente'}
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
