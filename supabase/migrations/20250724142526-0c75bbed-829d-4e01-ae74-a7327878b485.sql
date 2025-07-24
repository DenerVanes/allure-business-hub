
-- Adicionar novas colunas na tabela collaborators
ALTER TABLE public.collaborators 
ADD COLUMN photo_url text,
ADD COLUMN specialty text[];

-- Criar tabela para períodos de bloqueio de agenda
CREATE TABLE public.collaborator_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Adicionar RLS para a tabela de bloqueios
ALTER TABLE public.collaborator_blocks ENABLE ROW LEVEL SECURITY;

-- Política para que usuários vejam apenas bloqueios de seus colaboradores
CREATE POLICY "Users can manage blocks of their own collaborators" 
  ON public.collaborator_blocks 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborators 
      WHERE collaborators.id = collaborator_blocks.collaborator_id 
      AND collaborators.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_collaborator_blocks_updated_at
  BEFORE UPDATE ON public.collaborator_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
