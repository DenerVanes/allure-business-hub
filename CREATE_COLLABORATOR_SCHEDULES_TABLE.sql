-- Script para criar a tabela collaborator_schedules
-- Execute este script no SQL Editor do Supabase Dashboard

-- Criar tabela de horários de trabalho dos colaboradores
CREATE TABLE IF NOT EXISTS public.collaborator_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, day_of_week)
);

-- Habilitar RLS
ALTER TABLE public.collaborator_schedules ENABLE ROW LEVEL SECURITY;

-- Dropar políticas existentes se houver
DROP POLICY IF EXISTS "Users can manage schedules of their own collaborators" ON public.collaborator_schedules;
DROP POLICY IF EXISTS "Public booking can view schedules for active collaborators" ON public.collaborator_schedules;

-- Política: Usuários podem gerenciar horários de seus próprios colaboradores
CREATE POLICY "Users can manage schedules of their own collaborators"
ON public.collaborator_schedules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.collaborators 
    WHERE collaborators.id = collaborator_schedules.collaborator_id 
    AND collaborators.user_id = auth.uid()
  )
);

-- Política: Agendamento público pode visualizar horários de colaboradores ativos
CREATE POLICY "Public booking can view schedules for active collaborators"
ON public.collaborator_schedules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.collaborators
    JOIN public.profiles ON profiles.user_id = collaborators.user_id
    WHERE collaborators.id = collaborator_schedules.collaborator_id
    AND collaborators.active = true
    AND profiles.agendamento_online_ativo = true
  )
);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_collaborator_schedules_collab ON public.collaborator_schedules(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_schedules_day ON public.collaborator_schedules(day_of_week);

-- Dropar trigger se existir
DROP TRIGGER IF EXISTS update_collaborator_schedules_updated_at ON public.collaborator_schedules;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_collaborator_schedules_updated_at
BEFORE UPDATE ON public.collaborator_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Dropar constraint se existir
ALTER TABLE public.collaborator_schedules
DROP CONSTRAINT IF EXISTS check_enabled_has_times;

-- Constraint: Se enabled = true, start_time e end_time devem estar preenchidos
ALTER TABLE public.collaborator_schedules
ADD CONSTRAINT check_enabled_has_times 
CHECK (
  (enabled = false) OR 
  (enabled = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
);

