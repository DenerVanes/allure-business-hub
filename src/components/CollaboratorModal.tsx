
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
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
  contractType: z.enum(['Proprietário', 'CLT', 'PJ'], {
    errorMap: () => ({ message: 'Tipo de vínculo é obrigatório' })
  }).optional(),
  // Campos CLT
  cltContractType: z.enum(['CLT', 'Estágio', 'Outro']).optional(),
  salary: z.string().optional(),
  workHours: z.string().optional(),
  startDate: z.string().optional(),
  internalNotes: z.string().optional(),
  // Campos PJ
  companyName: z.string().optional(),
  cnpj: z.string().optional(),
  legalName: z.string().optional(),
  pixKey: z.string().optional(),
  contractNotes: z.string().optional(),
  // Comissão (PJ)
  commissionModel: z.enum(['percentage', 'fixed']).optional(),
  commissionValue: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validar tipo de vínculo
  if (!data.contractType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tipo de vínculo é obrigatório',
      path: ['contractType'],
    });
  }

  // Validações para CLT
  if (data.contractType === 'CLT') {
    if (!data.cltContractType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tipo de contrato é obrigatório para CLT',
        path: ['cltContractType'],
      });
    }
  }

  // Proprietário não precisa de validações adicionais
  // Validações para PJ
  if (data.contractType === 'PJ') {
    if (!data.commissionModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Modelo de comissão é obrigatório para PJ',
        path: ['commissionModel'],
      });
    }
    if (!data.commissionValue || data.commissionValue.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor da comissão é obrigatório',
        path: ['commissionValue'],
      });
    } else {
      const numValue = parseFloat(data.commissionValue);
      if (isNaN(numValue) || numValue < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valor da comissão deve ser um número válido',
          path: ['commissionValue'],
        });
      }
      if (data.commissionModel === 'percentage' && (numValue < 0 || numValue > 100)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Percentual deve estar entre 0 e 100',
          path: ['commissionValue'],
        });
      }
    }
  }
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<CollaboratorFormData>({
    resolver: zodResolver(collaboratorSchema),
    defaultValues: {
      name: collaborator?.name || '',
      phone: collaborator?.phone || '',
      contractType: collaborator?.contract_type || undefined,
      cltContractType: collaborator?.clt_contract_type || undefined,
      salary: collaborator?.salary ? collaborator.salary.toString() : '',
      workHours: collaborator?.work_hours || '',
      startDate: collaborator?.start_date || '',
      internalNotes: collaborator?.internal_notes || '',
      companyName: collaborator?.company_name || '',
      cnpj: collaborator?.cnpj || '',
      legalName: collaborator?.legal_name || '',
      pixKey: collaborator?.pix_key || '',
      contractNotes: collaborator?.contract_notes || '',
      commissionModel: collaborator?.commission_model || undefined,
      commissionValue: collaborator?.commission_value?.toString() || '',
    },
  });

  const contractType = watch('contractType');
  const commissionModel = watch('commissionModel');
  const [salaryDisplay, setSalaryDisplay] = useState<string>('');

  // Sincronizar salaryDisplay com o valor do formulário ao carregar/criar
  useEffect(() => {
    if (collaborator?.salary) {
      const formatted = parseFloat(collaborator.salary.toString()).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setSalaryDisplay(formatted);
    } else {
      setSalaryDisplay('');
    }
  }, [collaborator?.salary, open]);

  // Handler para mudança no campo de salário
  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo exceto números
    const rawValue = e.target.value.replace(/\D/g, '');
    
    if (!rawValue) {
      setSalaryDisplay('');
      setValue('salary', '', { shouldValidate: true });
      return;
    }
    
    // Converte para número e divide por 100 para ter centavos
    const amount = parseFloat(rawValue) / 100;
    
    // Formata para exibição
    const formatted = amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    setSalaryDisplay(formatted);
    // Salva o valor numérico como string (para o schema)
    setValue('salary', amount.toString(), { shouldValidate: true });
  };

  // Função para formatar CNPJ: XX.XXX.XXX/XXXX-XX
  const formatCNPJ = (value: string): string => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 14 dígitos
    const limitedNumbers = numbers.slice(0, 14);
    
    // Aplica a máscara progressivamente
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 5) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2)}`;
    } else if (limitedNumbers.length <= 8) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5)}`;
    } else if (limitedNumbers.length <= 12) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8)}`;
    } else {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8, 12)}-${limitedNumbers.slice(12, 14)}`;
    }
  };

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

      // Preparar dados para salvamento
      const collaboratorData: any = {
        name: data.name,
        phone: data.phone || null,
        specialty: specialties.length > 0 ? specialties : null,
        photo_url: photoUrl,
        contract_type: data.contractType || null,
      };

      // Campos CLT
      if (data.contractType === 'CLT') {
        collaboratorData.clt_contract_type = data.cltContractType || null;
        collaboratorData.salary = data.salary ? parseFloat(data.salary) : null;
        collaboratorData.work_hours = data.workHours || null;
        collaboratorData.start_date = data.startDate || null;
        collaboratorData.internal_notes = data.internalNotes || null;
        // Limpar campos PJ se existirem
        collaboratorData.company_name = null;
        collaboratorData.cnpj = null;
        collaboratorData.legal_name = null;
        collaboratorData.pix_key = null;
        collaboratorData.contract_notes = null;
        collaboratorData.commission_model = null;
        collaboratorData.commission_value = null;
      }

      // Proprietário - limpar todos os campos específicos de CLT e PJ
      if (data.contractType === 'Proprietário') {
        collaboratorData.clt_contract_type = null;
        collaboratorData.salary = null;
        collaboratorData.work_hours = null;
        collaboratorData.start_date = null;
        collaboratorData.internal_notes = null;
        collaboratorData.company_name = null;
        collaboratorData.cnpj = null;
        collaboratorData.legal_name = null;
        collaboratorData.pix_key = null;
        collaboratorData.contract_notes = null;
        collaboratorData.commission_model = null;
        collaboratorData.commission_value = null;
      }

      // Campos PJ
      if (data.contractType === 'PJ') {
        collaboratorData.company_name = data.companyName || null;
        collaboratorData.cnpj = data.cnpj || null;
        collaboratorData.legal_name = data.legalName || null;
        collaboratorData.pix_key = data.pixKey || null;
        collaboratorData.contract_notes = data.contractNotes || null;
        collaboratorData.commission_model = data.commissionModel || null;
        collaboratorData.commission_value = data.commissionValue ? parseFloat(data.commissionValue) : null;
        // Limpar campos CLT se existirem
        collaboratorData.clt_contract_type = null;
        collaboratorData.salary = null;
        collaboratorData.work_hours = null;
        collaboratorData.start_date = null;
        collaboratorData.internal_notes = null;
      }

      if (isEditing) {
        const { error, data: updateData } = await supabase
          .from('collaborators')
          .update(collaboratorData)
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
        collaboratorData.user_id = user.id;
        const { data: newCollaborator, error } = await supabase
          .from('collaborators')
          .insert(collaboratorData)
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
      reset({
        name: '',
        phone: '',
        contractType: undefined,
        cltContractType: undefined,
        salary: '',
        workHours: '',
        startDate: '',
        internalNotes: '',
        companyName: '',
        cnpj: '',
        legalName: '',
        pixKey: '',
        contractNotes: '',
        commissionModel: undefined,
        commissionValue: '',
      });
      setSalaryDisplay('');
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
      reset({
        name: '',
        phone: '',
        contractType: undefined,
        cltContractType: undefined,
        salary: '',
        workHours: '',
        startDate: '',
        internalNotes: '',
        companyName: '',
        cnpj: '',
        legalName: '',
        pixKey: '',
        contractNotes: '',
        commissionModel: undefined,
        commissionValue: '',
      });
      setSalaryDisplay('');
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

            {/* Tipo de Vínculo */}
            <div>
              <Label className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                Tipo de Vínculo *
              </Label>
              <RadioGroup
                value={contractType || ''}
                onValueChange={(value: 'Proprietário' | 'CLT' | 'PJ') => setValue('contractType', value)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Proprietário" id="contract-proprietario" />
                  <Label htmlFor="contract-proprietario" className="cursor-pointer font-normal">
                    Proprietário
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CLT" id="contract-clt" />
                  <Label htmlFor="contract-clt" className="cursor-pointer font-normal">
                    CLT (Funcionário registrado)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="contract-pj" />
                  <Label htmlFor="contract-pj" className="cursor-pointer font-normal">
                    PJ / Parceiro (Comissionado)
                  </Label>
                </div>
              </RadioGroup>
              {errors.contractType && (
                <p className="text-sm text-red-500 mt-1">{errors.contractType.message}</p>
              )}
            </div>

            {/* Campos CLT */}
            {contractType === 'CLT' && (
              <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: '#FAF5FF', border: '1px solid #F7D5E8' }}>
                <h3 className="text-sm font-semibold" style={{ color: '#5A2E98' }}>Dados CLT</h3>
                
                {/* Tipo de Contrato */}
                <div>
                  <Label htmlFor="cltContractType" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                    Tipo de contrato *
                  </Label>
                  <Select
                    value={watch('cltContractType') || ''}
                    onValueChange={(value) => setValue('cltContractType', value as 'CLT' | 'Estágio' | 'Outro')}
                  >
                    <SelectTrigger className="mt-1" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                      <SelectValue placeholder="Selecione o tipo de contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="Estágio">Estágio</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.cltContractType && (
                    <p className="text-sm text-red-500 mt-1">{errors.cltContractType.message}</p>
                  )}
                </div>

                {/* Salário Fixo Mensal */}
                <div>
                  <Label htmlFor="salary" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                    Salário fixo mensal
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5A4A5E] font-medium">R$</span>
                    <Input
                      id="salary"
                      type="text"
                      value={salaryDisplay}
                      onChange={handleSalaryChange}
                      placeholder="0,00"
                      className="pl-12"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    />
                  </div>
                </div>

                {/* Carga Horária */}
                <div>
                  <Label htmlFor="workHours" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                    Carga horária
                  </Label>
                  <Input
                    id="workHours"
                    {...register('workHours')}
                    placeholder="Ex: 44h semanais"
                    className="mt-1"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  />
                </div>

                {/* Data de Início */}
                <div>
                  <Label htmlFor="startDate" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                    Data de início
                  </Label>
                  <Input
                    id="startDate"
                    {...register('startDate')}
                    type="date"
                    className="mt-1"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  />
                </div>

                {/* Observações Internas */}
                <div>
                  <Label htmlFor="internalNotes" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                    Observações internas
                  </Label>
                  <Textarea
                    id="internalNotes"
                    {...register('internalNotes')}
                    placeholder="Notas internas sobre o colaborador CLT..."
                    className="mt-1"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Colaboradores CLT devem ser tratados como despesa fixa nos relatórios financeiros.
                  </p>
                </div>
              </div>
            )}

            {/* Campos PJ */}
            {contractType === 'PJ' && (
              <div className="space-y-4">
                {/* Dados do Prestador (PJ) */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#FAF5FF', border: '1px solid #F7D5E8' }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: '#5A2E98' }}>📄 Dados do prestador (PJ)</h3>
                  
                  {/* Nome Fantasia / Nome do Prestador */}
                  <div className="mb-4">
                    <Label htmlFor="companyName" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                      Nome fantasia / Nome do prestador
                    </Label>
                    <Input
                      id="companyName"
                      {...register('companyName')}
                      placeholder="Nome da empresa ou prestador"
                      className="mt-1"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    />
                  </div>

                  {/* CNPJ */}
                  <div className="mb-4">
                    <Label htmlFor="cnpj" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                      CNPJ
                    </Label>
                    <Input
                      id="cnpj"
                      {...register('cnpj')}
                      onChange={(e) => {
                        const formatted = formatCNPJ(e.target.value);
                        e.target.value = formatted;
                        setValue('cnpj', formatted, { shouldValidate: true });
                      }}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="mt-1"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    />
                  </div>

                  {/* Razão Social */}
                  <div className="mb-4">
                    <Label htmlFor="legalName" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                      Razão social
                    </Label>
                    <Input
                      id="legalName"
                      {...register('legalName')}
                      placeholder="Razão social da empresa"
                      className="mt-1"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    />
                  </div>

                  {/* Chave Pix */}
                  <div className="mb-4">
                    <Label htmlFor="pixKey" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                      Chave Pix para repasse (opcional)
                    </Label>
                    <Input
                      id="pixKey"
                      {...register('pixKey')}
                      placeholder="Chave Pix para pagamento de comissões"
                      className="mt-1"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    />
                  </div>

                  {/* Observações Contratuais */}
                  <div>
                    <Label htmlFor="contractNotes" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                      Observações contratuais
                    </Label>
                    <Textarea
                      id="contractNotes"
                      {...register('contractNotes')}
                      placeholder="Notas sobre o contrato..."
                      className="mt-1"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Modelo de Comissão */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC' }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: '#5A2E98' }}>💰 Modelo de Comissão *</h3>
                  
                  <RadioGroup
                    value={commissionModel || ''}
                    onValueChange={(value) => setValue('commissionModel', value as 'percentage' | 'fixed')}
                    className="mb-4"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="percentage" id="commission-percentage" />
                      <Label htmlFor="commission-percentage" className="cursor-pointer font-normal">
                        Percentual sobre o serviço
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="commission-fixed" />
                      <Label htmlFor="commission-fixed" className="cursor-pointer font-normal">
                        Valor fixo por serviço
                      </Label>
                    </div>
                  </RadioGroup>

                  {commissionModel === 'percentage' && (
                    <div>
                      <Label htmlFor="commissionValue" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                        Percentual de comissão (%) *
                      </Label>
                      <Input
                        id="commissionValue"
                        {...register('commissionValue')}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Ex: 40"
                        className="mt-1"
                        style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        O percentual será aplicado sobre o valor bruto do serviço realizado.
                      </p>
                      {errors.commissionValue && (
                        <p className="text-sm text-red-500 mt-1">{errors.commissionValue.message}</p>
                      )}
                    </div>
                  )}

                  {commissionModel === 'fixed' && (
                    <div>
                      <Label htmlFor="commissionValue" className="text-sm font-medium" style={{ color: '#5A4A5E' }}>
                        Valor fixo por atendimento *
                      </Label>
                      <Input
                        id="commissionValue"
                        {...register('commissionValue')}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex: 30,00"
                        className="mt-1"
                        style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                      />
                      {errors.commissionValue && (
                        <p className="text-sm text-red-500 mt-1">{errors.commissionValue.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
