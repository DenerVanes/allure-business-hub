-- Adicionar colunas de trial na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- Atualizar função handle_new_user para definir trial automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    business_name, 
    slug,
    trial_expires_at,
    subscription_status
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Meu Negócio'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'business_name', NEW.email), ' ', '-')) || '-' || substr(NEW.id::text, 1, 8),
    now() + interval '14 days',
    'trial'
  );
  RETURN NEW;
END;
$$;

-- Buscar user_id do admin pelo email e atualizar para acesso permanente
UPDATE public.profiles 
SET subscription_status = 'active', trial_expires_at = NULL
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'dennervanes@hotmail.com'
);

-- Atualizar outros usuários existentes que não têm status definido
UPDATE public.profiles 
SET trial_expires_at = now() + interval '14 days', subscription_status = 'trial'
WHERE (subscription_status IS NULL OR subscription_status = '') 
  AND user_id NOT IN (SELECT id FROM auth.users WHERE email = 'dennervanes@hotmail.com');

-- Dropar policy dependente primeiro
DROP POLICY IF EXISTS "Servicos visiveis em agendamento publico" ON public.services;

-- Recriar view public_booking_profiles
DROP VIEW IF EXISTS public_booking_profiles CASCADE;

CREATE VIEW public_booking_profiles AS
SELECT 
  user_id,
  agendamento_online_ativo,
  slug,
  business_name,
  about,
  address
FROM public.profiles
WHERE agendamento_online_ativo = true;