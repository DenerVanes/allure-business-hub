-- Cria tabela para a Vitrine (Tela de Apresentação do Salão)
CREATE TABLE IF NOT EXISTS public.salon_presentation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_image_url TEXT,
  title TEXT,
  description TEXT,
  primary_color TEXT,
  buttons JSONB,
  social_links JSONB,
  whatsapp_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT salon_presentation_user_unique UNIQUE(user_id)
);

-- Habilita RLS
ALTER TABLE public.salon_presentation ENABLE ROW LEVEL SECURITY;

-- Políticas: dono gerencia sua vitrine
CREATE POLICY "Users can manage their own presentation"
ON public.salon_presentation
FOR ALL
USING (auth.uid() = user_id);

-- Política: leitura pública apenas quando ativa e perfil com agendamento online ativo
CREATE POLICY "Public can view active presentations"
ON public.salon_presentation
FOR SELECT
USING (
  is_active = true
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = salon_presentation.user_id
        AND profiles.agendamento_online_ativo = true
    )
    OR auth.uid() = salon_presentation.user_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_salon_presentation_updated_at
  BEFORE UPDATE ON public.salon_presentation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_salon_presentation_user_id ON public.salon_presentation(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_presentation_active ON public.salon_presentation(is_active);

