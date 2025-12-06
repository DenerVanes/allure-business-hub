
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import { WorkScheduleConfig } from './WorkScheduleConfig';
import { 
  WorkScheduleDay, 
  CollaboratorSchedule,
  validateWorkSchedule,
  convertSchedulesToWorkSchedule,
  convertWorkScheduleToSchedules
} from '@/utils/collaboratorSchedule';

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
  const [workSchedule, setWorkSchedule] = useState<WorkScheduleDay[]>(() => {
    const days: WorkScheduleDay[] = [
      { day: 'monday', enabled: false, startTime: '', endTime: '' },
      { day: 'tuesday', enabled: false, startTime: '', endTime: '' },
      { day: 'wednesday', enabled: false, startTime: '', endTime: '' },
      { day: 'thursday', enabled: false, startTime: '', endTime: '' },
      { day: 'friday', enabled: false, startTime: '', endTime: '' },
      { day: 'saturday', enabled: false, startTime: '', endTime: '' },
      { day: 'sunday', enabled: false, startTime: '', endTime: '' }
    ];
    return days;
  });
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});

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

  // Carregar horários existentes quando estiver editando
  const { data: existingSchedules = [] } = useQuery({
    queryKey: ['collaborator-schedules', collaborator?.id],
    queryFn: async () => {
      if (!collaborator?.id) return [];
      
      try {
        const { data, error } = await (supabase
          .from('collaborator_schedules' as any)
          .select('*')
          .eq('collaborator_id', collaborator.id)
          .order('day_of_week'));
        
        if (error) {
          console.error('Erro ao buscar horários:', error);
          return [];
        }
        return (data as unknown as CollaboratorSchedule[]) || [];
      } catch (err) {
        console.error('Erro ao buscar horários:', err);
        return [];
      }
    },
    enabled: !!collaborator?.id && open,
    retry: 1
  });

  // Usar ref para rastrear se já inicializamos os horários
  const hasInitializedSchedule = useRef(false);
  const lastSchedulesRef = useRef<string>('');

  // Atualizar workSchedule quando schedules forem carregados
  useEffect(() => {
    // Só processar se o modal estiver aberto
    if (!open) {
      hasInitializedSchedule.current = false;
      lastSchedulesRef.current = '';
      return;
    }

    // Se não há colaborador, resetar para valores padrão
    if (!collaborator) {
      if (!hasInitializedSchedule.current) {
        const days: WorkScheduleDay[] = [
          { day: 'monday', enabled: false, startTime: '', endTime: '' },
          { day: 'tuesday', enabled: false, startTime: '', endTime: '' },
          { day: 'wednesday', enabled: false, startTime: '', endTime: '' },
          { day: 'thursday', enabled: false, startTime: '', endTime: '' },
          { day: 'friday', enabled: false, startTime: '', endTime: '' },
          { day: 'saturday', enabled: false, startTime: '', endTime: '' },
          { day: 'sunday', enabled: false, startTime: '', endTime: '' }
        ];
        setWorkSchedule(days);
        hasInitializedSchedule.current = true;
      }
      return;
    }

    // Se há colaborador e schedules, converter apenas se os dados mudaram
    if (existingSchedules.length > 0) {
      const schedulesKey = JSON.stringify(existingSchedules);
      
      // Só atualizar se os schedules realmente mudaram
      if (schedulesKey !== lastSchedulesRef.current) {
        const converted = convertSchedulesToWorkSchedule(existingSchedules as CollaboratorSchedule[]);
        setWorkSchedule(converted);
        lastSchedulesRef.current = schedulesKey;
        hasInitializedSchedule.current = true;
      }
    } else if (hasInitializedSchedule.current === false) {
      // Se não há schedules mas ainda não inicializamos, usar valores padrão
      const days: WorkScheduleDay[] = [
        { day: 'monday', enabled: false, startTime: '', endTime: '' },
        { day: 'tuesday', enabled: false, startTime: '', endTime: '' },
        { day: 'wednesday', enabled: false, startTime: '', endTime: '' },
        { day: 'thursday', enabled: false, startTime: '', endTime: '' },
        { day: 'friday', enabled: false, startTime: '', endTime: '' },
        { day: 'saturday', enabled: false, startTime: '', endTime: '' },
        { day: 'sunday', enabled: false, startTime: '', endTime: '' }
      ];
      setWorkSchedule(days);
      hasInitializedSchedule.current = true;
    }
  }, [existingSchedules, collaborator, open]);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.');
      }

      // Validar tamanho do arquivo (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Tamanho máximo: 5MB.');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `collaborators/${user.id}/${fileName}`;

      // Upload do novo arquivo
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          upsert: true, // Permite substituir arquivos existentes
          cacheControl: '3600',
          contentType: file.type
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        // Se o erro for de política RLS, fornecer mensagem mais clara
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
          throw new Error('Erro de permissão. Verifique se você está autenticado e tente novamente.');
        }
        throw uploadError;
      }

      // Obter URL pública
      const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error('Não foi possível obter a URL da imagem.');
      }

      return data.publicUrl;
    } catch (error: any) {
      console.error('Erro detalhado no upload:', error);
      throw error; // Re-throw para que o erro seja tratado no componente
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      // Validar horários
      const validation = validateWorkSchedule(workSchedule);
      if (!validation.valid) {
        const errorMessage = validation.error || 'Erro na validação de horários';
        setScheduleErrors({ general: errorMessage });
        console.error('Erro de validação de horários:', errorMessage);
        throw new Error(errorMessage);
      }
      setScheduleErrors({});

      let photoUrl = collaborator?.photo_url || null;

      // Upload da foto se houver
      if (photoFile) {
        try {
          const uploadedUrl = await uploadPhoto(photoFile);
          if (!uploadedUrl) {
            throw new Error('Erro no upload da foto: URL não retornada');
          }
          photoUrl = uploadedUrl;
        } catch (error: any) {
          console.error('Erro ao fazer upload da foto:', error);
          const errorMessage = error?.message || 'Erro no upload da foto';
          throw new Error(errorMessage);
        }
      }

      let collaboratorId: string;

      if (isEditing) {
        const { error, data: updateData } = await supabase
          .from('collaborators')
          .update({
            name: data.name,
            phone: data.phone || null,
            specialty: specialties.length > 0 ? specialties : null,
            photo_url: photoUrl,
          })
          .eq('id', collaborator.id)
          .select();

        if (error) {
          console.error('Erro ao atualizar colaborador:', error);
          throw new Error(`Erro ao atualizar colaborador: ${error.message}`);
        }
        
        if (!updateData || updateData.length === 0) {
          throw new Error('Nenhum registro foi atualizado. Verifique se o colaborador existe.');
        }
        
        collaboratorId = collaborator.id;
      } else {
        const { data: newCollaborator, error } = await supabase
          .from('collaborators')
          .insert({
            user_id: user.id,
            name: data.name,
            phone: data.phone || null,
            specialty: specialties.length > 0 ? specialties : null,
            photo_url: photoUrl,
          })
          .select()
          .single();

        if (error) throw error;
        collaboratorId = newCollaborator.id;
      }

      // Salvar/atualizar horários
      // Primeiro, deletar todos os horários existentes
      const { error: deleteError } = await (supabase
        .from('collaborator_schedules' as any)
        .delete()
        .eq('collaborator_id', collaboratorId));

      if (deleteError) {
        console.error('Erro ao deletar horários existentes:', deleteError);
        // Se a tabela não existir, dar uma mensagem mais clara
        if (deleteError.code === '42P01' || deleteError.message?.includes('does not exist')) {
          throw new Error('A tabela de horários não existe no banco de dados. Execute a migration ou o script SQL fornecido no arquivo CREATE_COLLABORATOR_SCHEDULES_TABLE.sql');
        }
        throw new Error(`Erro ao atualizar horários: ${deleteError.message}`);
      }

      // Depois, inserir os novos horários
      const schedulesToInsert = convertWorkScheduleToSchedules(workSchedule, collaboratorId);
      console.log('Horários a serem inseridos:', schedulesToInsert);
      
      if (schedulesToInsert.length > 0) {
        const { error: scheduleError, data: insertedSchedules } = await (supabase
          .from('collaborator_schedules' as any)
          .insert(schedulesToInsert as any))
          .select();

        if (scheduleError) {
          console.error('Erro ao inserir horários:', scheduleError);
          console.error('Dados que tentaram ser inseridos:', schedulesToInsert);
          // Se a tabela não existir, dar uma mensagem mais clara
          if (scheduleError.code === '42P01' || scheduleError.message?.includes('does not exist')) {
            throw new Error('A tabela de horários não existe no banco de dados. Execute a migration ou o script SQL fornecido no arquivo CREATE_COLLABORATOR_SCHEDULES_TABLE.sql');
          }
          throw new Error(`Erro ao salvar horários: ${scheduleError.message}`);
        }
        console.log('Horários inseridos com sucesso:', insertedSchedules);
      } else {
        console.log('Nenhum horário para inserir (todos os dias desabilitados)');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      queryClient.invalidateQueries({ queryKey: ['collaborator-schedules'] });
      toast({
        title: isEditing ? 'Colaborador atualizado' : 'Colaborador cadastrado',
        description: `Colaborador foi ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso.`,
      });
      reset();
      setSpecialties([]);
      setPhotoFile(null);
      setPhotoPreview('');
      setScheduleErrors({});
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Erro ao salvar colaborador:', error);
      const errorMessage = error?.message || error?.error?.message || 'Erro desconhecido';
      toast({
        title: 'Erro',
        description: `Não foi possível ${isEditing ? 'atualizar' : 'cadastrar'} o colaborador. ${errorMessage}`,
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" style={{ borderRadius: '20px' }}>
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ color: '#5A2E98' }}>
              {isEditing ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Foto do Colaborador */}
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-2"
                    style={{ borderColor: '#F7D5E8' }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: '#F7D5E8', borderColor: '#F7D5E8' }}>
                    <Upload className="h-8 w-8" style={{ color: '#8E44EC' }} />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="photo" className="cursor-pointer">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full"
                    style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
                    asChild
                  >
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

            {/* Nome */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                Nome
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Nome do colaborador"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Telefone */}
            <div>
              <Label htmlFor="phone" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                Telefone
              </Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="(11) 99999-9999"
                className="mt-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
            </div>

            {/* Especialidades */}
            <SpecialtySelector
              specialties={specialties}
              onSpecialtiesChange={setSpecialties}
            />

            {/* Horários de Trabalho */}
            <WorkScheduleConfig
              workSchedule={workSchedule}
              onChange={setWorkSchedule}
              errors={scheduleErrors}
            />

            {/* Bloqueios de Agenda (apenas ao editar) */}
            {isEditing && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBlockModal(true)}
                  className="w-full gap-2 rounded-full"
                  style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
                >
                  <Shield className="h-4 w-4" />
                  Gerenciar Bloqueios de Agenda
                </Button>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: '#F7D5E8' }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-full"
                style={{ borderColor: '#F7D5E8', color: '#5A4A5E' }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-full px-6"
                style={{ backgroundColor: '#8E44EC', color: 'white' }}
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
