
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const collaboratorSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type CollaboratorFormData = z.infer<typeof collaboratorSchema>;

interface CollaboratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollaboratorModal({ open, onOpenChange }: CollaboratorModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CollaboratorFormData>({
    resolver: zodResolver(collaboratorSchema),
  });

  const createCollaboratorMutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      const { error } = await supabase
        .from('collaborators')
        .insert({
          user_id: user.id,
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast({
        title: 'Colaborador cadastrado',
        description: 'Colaborador foi cadastrado com sucesso.',
      });
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível cadastrar o colaborador.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: CollaboratorFormData) => {
    createCollaboratorMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Colaborador</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nome do colaborador"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="email@exemplo.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createCollaboratorMutation.isPending}
            >
              {createCollaboratorMutation.isPending ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
