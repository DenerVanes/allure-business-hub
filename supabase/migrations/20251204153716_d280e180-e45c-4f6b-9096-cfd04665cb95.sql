-- Tabela para configuração de horários de atendimento
CREATE TABLE public.working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_open BOOLEAN NOT NULL DEFAULT false,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own working hours
CREATE POLICY "Users can manage their own working hours"
ON public.working_hours FOR ALL
USING (auth.uid() = user_id);

-- Policy: Public booking can view working hours for enabled profiles
CREATE POLICY "Public booking can view working hours"
ON public.working_hours FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = working_hours.user_id 
    AND profiles.agendamento_online_ativo = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_working_hours_updated_at
BEFORE UPDATE ON public.working_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default working hours for existing users (Mon-Fri 08:00-18:00, Sat 08:00-12:00)
INSERT INTO public.working_hours (user_id, day_of_week, is_open, start_time, end_time, breaks)
SELECT 
  p.user_id,
  day.day_of_week,
  CASE 
    WHEN day.day_of_week = 0 THEN false  -- Domingo fechado
    WHEN day.day_of_week = 6 THEN true   -- Sábado aberto
    ELSE true                             -- Seg-Sex aberto
  END as is_open,
  CASE 
    WHEN day.day_of_week = 6 THEN '08:00'::TIME
    ELSE '08:00'::TIME
  END as start_time,
  CASE 
    WHEN day.day_of_week = 6 THEN '12:00'::TIME
    ELSE '18:00'::TIME
  END as end_time,
  '[]'::jsonb as breaks
FROM public.profiles p
CROSS JOIN (SELECT generate_series(0, 6) as day_of_week) day
ON CONFLICT (user_id, day_of_week) DO NOTHING;