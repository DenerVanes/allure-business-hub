
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, User, Building, Save, Share2, Copy, Check, Clock } from 'lucide-react';
import { BusinessHoursConfig } from '@/components/BusinessHoursConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  business_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  full_name: z.string().min(1, 'Nome completo é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  address: z.string().optional(),
  about: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Extend the profile type to include the new fields
interface ExtendedProfile {
  id: string;
  user_id: string;
  business_name: string;
  phone?: string;
  address?: string;
  full_name?: string;
  about?: string;
  instagram?: string;
  business_hours?: any;
  slug?: string;
  agendamento_online_ativo?: boolean;
  created_at: string;
  updated_at: string;
}

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [publicLink, setPublicLink] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ExtendedProfile;
    },
    enabled: !!user?.id
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      business_name: profile?.business_name || '',
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      about: profile?.about || '',
    },
  });

  // Update form values when profile data loads
  React.useEffect(() => {
    if (profile) {
      setValue('business_name', profile.business_name || '');
      setValue('full_name', profile.full_name || '');
      setValue('phone', profile.phone || '');
      setValue('address', profile.address || '');
      setValue('about', profile.about || '');
    }
  }, [profile, setValue]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      // Primeiro, verificar se o perfil já existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingProfile) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('profiles')
          .update({
            business_name: data.business_name,
            full_name: data.full_name,
            phone: data.phone,
            address: data.address || null,
            about: data.about || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao atualizar perfil:', error);
          throw error;
        }
      } else {
        // Criar novo perfil se não existir
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            business_name: data.business_name,
            full_name: data.full_name,
            phone: data.phone,
            address: data.address || null,
            about: data.about || null,
          });

        if (error) {
          console.error('Erro ao criar perfil:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      console.error('Erro detalhado:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  // Monta e mantém o link público de agendamento de forma estável
  React.useEffect(() => {
    if (profile?.slug && typeof window !== 'undefined') {
      const link = `${window.location.origin}/agendar/${profile.slug}`;
      console.log('Link público de agendamento montado:', link);
      setPublicLink(link);
    }
  }, [profile?.slug]);

  const handleCopyPublicLink = async () => {
    if (!publicLink) {
      toast({
        title: 'Erro',
        description: 'Link não disponível. Aguarde o carregamento.',
        variant: 'destructive',
      });
      return;
    }

    // Método 1: Tentar usar a API moderna do clipboard
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(publicLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast({
          title: 'Link copiado!',
          description: 'O link foi copiado para a área de transferência.',
        });
        return;
      } catch (error) {
        console.warn('Clipboard API falhou, tentando método alternativo:', error);
      }
    }

    // Método 2: Fallback - criar elemento temporário e copiar
    try {
      const textArea = document.createElement('textarea');
      textArea.value = publicLink;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast({
          title: 'Link copiado!',
          description: 'O link foi copiado para a área de transferência.',
        });
      } else {
        throw new Error('Falha ao executar comando de cópia');
      }
    } catch (error) {
      console.error('Erro ao copiar link público:', error);
      // Selecionar o texto no input para facilitar cópia manual
      const input = document.querySelector('input[readonly]') as HTMLInputElement;
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'O texto foi selecionado. Use Ctrl+C (ou Cmd+C) para copiar.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e da empresa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informações da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="business_name">Nome da Empresa</Label>
                <Input
                  id="business_name"
                  {...register('business_name')}
                  placeholder="Ex: Salão de Beleza XYZ"
                />
                {errors.business_name && (
                  <p className="text-sm text-red-500">{errors.business_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  {...register('address')}
                  placeholder="Endereço completo da empresa"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="about">Sobre a Empresa</Label>
                <Textarea
                  id="about"
                  {...register('about')}
                  placeholder="Descrição sobre sua empresa"
                  rows={4}
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O email não pode ser alterado
              </p>
            </div>

            <div>
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                {...register('full_name')}
                placeholder="Seu nome completo"
              />
              {errors.full_name && (
                <p className="text-sm text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="(11) 99999-9999"
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Link de Agendamento Público */}
      {profile?.slug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Link de Agendamento Público
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compartilhe este link com seus clientes para que eles possam agendar diretamente online.
            </p>
            <div className="flex gap-2">
              <Input
                value={publicLink}
                readOnly
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="flex-1 cursor-text"
              />
              <Button
                type="button"
                variant={copiedLink ? "default" : "outline"}
                onClick={handleCopyPublicLink}
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {profile.agendamento_online_ativo ? (
                <span className="text-green-600 font-medium">Ativo</span>
              ) : (
                <span className="text-red-600 font-medium">Desativado</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Horários de Atendimento */}
      <BusinessHoursConfig />

      <div className="flex justify-between">
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={updateProfileMutation.isPending}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>

        <Button
          variant="destructive"
          onClick={signOut}
        >
          Sair da Conta
        </Button>
      </div>
    </div>
  );
};

export default Configuracoes;
