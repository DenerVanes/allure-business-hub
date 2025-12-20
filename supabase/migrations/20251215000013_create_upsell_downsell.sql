-- Criar tabela de campanhas Upsell/Downsell
CREATE TABLE IF NOT EXISTS public.upsell_downsell_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('upsell', 'downsell')),
  main_service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  linked_service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_duration_minutes INTEGER,
  extra_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.upsell_downsell_campaigns ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage their own upsell/downsell campaigns"
ON public.upsell_downsell_campaigns
FOR ALL
USING (auth.uid() = user_id);

-- Adicionar campos na tabela appointment_services
ALTER TABLE public.appointment_services
ADD COLUMN IF NOT EXISTS is_upsell BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_downsell BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.upsell_downsell_campaigns(id) ON DELETE SET NULL;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_upsell_downsell_campaigns_updated_at
  BEFORE UPDATE ON public.upsell_downsell_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_upsell_downsell_campaigns_user_id ON public.upsell_downsell_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_upsell_downsell_campaigns_main_service_id ON public.upsell_downsell_campaigns(main_service_id);
CREATE INDEX IF NOT EXISTS idx_upsell_downsell_campaigns_active ON public.upsell_downsell_campaigns(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_appointment_services_campaign_id ON public.appointment_services(campaign_id);


