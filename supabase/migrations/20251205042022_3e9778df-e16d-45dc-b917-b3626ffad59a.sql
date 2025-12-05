-- Create table for time-based blocks (separate from full-day blocks)
CREATE TABLE public.collaborator_time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Enable RLS
ALTER TABLE public.collaborator_time_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage time blocks of their own collaborators
CREATE POLICY "Users can manage time blocks of their own collaborators"
ON public.collaborator_time_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.collaborators 
    WHERE collaborators.id = collaborator_time_blocks.collaborator_id 
    AND collaborators.user_id = auth.uid()
  )
);

-- Policy: Public booking can view time blocks for enabled profiles
CREATE POLICY "Public booking can view time blocks for enabled profiles"
ON public.collaborator_time_blocks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.collaborators
    JOIN public.profiles ON profiles.user_id = collaborators.user_id
    WHERE collaborators.id = collaborator_time_blocks.collaborator_id
    AND profiles.agendamento_online_ativo = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_collaborator_time_blocks_updated_at
BEFORE UPDATE ON public.collaborator_time_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_collaborator_time_blocks_date ON public.collaborator_time_blocks(collaborator_id, block_date);