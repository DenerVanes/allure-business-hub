-- Adicionar campos de trial e assinatura na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled'));

-- Atualizar perfis existentes para ter trial de 14 dias a partir de agora
UPDATE public.profiles
SET 
  trial_expires_at = created_at + INTERVAL '14 days',
  subscription_status = CASE 
    WHEN created_at + INTERVAL '14 days' < NOW() THEN 'expired'
    ELSE 'trial'
  END
WHERE trial_expires_at IS NULL;

-- Função para atualizar trial_expires_at quando um novo perfil é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, business_name, slug, trial_expires_at, subscription_status)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Meu Negócio'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'business_name', NEW.email), ' ', '-')) || '-' || substr(NEW.id::text, 1, 8),
    NOW() + INTERVAL '14 days',
    'trial'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar status de assinatura expirada automaticamente
CREATE OR REPLACE FUNCTION public.update_expired_subscriptions()
RETURNS void AS $$
BEGIN
  -- Atualizar status para expired se o trial expirou
  UPDATE public.profiles
  SET subscription_status = 'expired'
  WHERE subscription_status = 'trial'
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função que será chamada periodicamente ou antes de verificar o perfil
-- Esta função pode ser chamada manualmente ou via cron job

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.trial_expires_at IS 'Data de expiração do período de trial (14 dias após cadastro)';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Status da assinatura: trial, active, expired, cancelled';

