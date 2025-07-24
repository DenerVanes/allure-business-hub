
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Upload, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { SpecialtySelector } from './SpecialtySelector';
import { CollaboratorBlockModal } from './CollaboratorBlockModal';

const collaboratorSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
});

type CollaboratorFormData = z.infer<typeof collaboratorSchema>;

interface CollaboratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator?: any;
}

export function CollaboratorModal({ open, onOpenChange, collaborator }: CollaboratorModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!collaborator;
  const [specialties, setSpecialties] = useState<string[]>(collaborator?.specialty || []);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(collaborator?.photo_url || '');
  const [showBlockModal, setShowBlockModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CollaboratorFormData>({
    resolver: zodResolver(collaboratorSchema),
    defaultValues: {
      name: collaborator?.name || '',
      phone: collaborator?.phone || '',
    },
  });

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `collaborators/${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      return null;
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      let photoUrl = collaborator?.photo_url || null;

      // Upload da foto se houver
      if (photoFile) {
        const uploadedUrl = await uploadPhoto(photoFile);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        } else {
          throw new Error('Erro no upload da foto');
        }
      }

      if (isEditing) {
        const { error } = await supabase
          .from('collaborators')
          .update({
            name: data.name,
            phone: data.phone || null,
            specialty: specialties.length > 0 ? specialties : null,
            photo_url: photoUrl,
          })
          .eq('id', collaborator.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('collaborators')
          .insert({
            user_id: user.id,
            name: data.name,
            phone: data.phone || null,
            specialty: specialties.length > 0 ? specialties : null,
            photo_url: photoUrl,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast({
        title: isEditing ? 'Colaborador atualizado' : 'Colaborador cadastrado',
        description: `Colaborador foi ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso.`,
      });
      reset();
      setSpecialties([]);
      setPhotoFile(null);
      setPhotoPreview('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: `Não foi possível ${isEditing ? 'atualizar' : 'cadastrar'} o colaborador.`,
        variant: 'destructive',
      });
    }
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: CollaboratorFormData) => {
    mutation.mutate(data);
  };

  const handleClose = () => {
    if (!isEditing) {
      setSpecialties([]);
      setPhotoFile(null);
      setPhotoPreview('');
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="photo" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {photoPreview ? 'Alterar Foto' : 'Adicionar Foto'}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            </div>

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

            <SpecialtySelector
              specialties={specialties}
              onSpecialtiesChange={setSpecialties}
            />

            {isEditing && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBlockModal(true)}
                  className="w-full gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Gerenciar Bloqueios de Agenda
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Cadastrar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isEditing && collaborator && (
        <CollaboratorBlockModal
          open={showBlockModal}
          onOpenChange={setShowBlockModal}
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.name}
        />
      )}
    </>
  );
}
