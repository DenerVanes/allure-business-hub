-- ============================================
-- Migração: Sistema de Gestão de Planos e Pagamentos
-- ============================================

-- 1. Adicionar campos de plano na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'none' CHECK (plan_status IN ('active', 'expired', 'none'));

-- 2. Criar tabela customer_subscriptions
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  days_added INTEGER NOT NULL CHECK (days_added > 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  admin_id TEXT NOT NULL,
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- 3. Habilitar RLS na tabela customer_subscriptions
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS para customer_subscriptions
-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Only admins can insert subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Only admins can update subscriptions" ON public.customer_subscriptions;

-- Admins podem ver todas as assinaturas
CREATE POLICY "Admins can view all subscriptions"
ON public.customer_subscriptions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Usuários podem ver apenas suas próprias assinaturas
CREATE POLICY "Users can view own subscriptions"
ON public.customer_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Apenas admins podem inserir assinaturas
CREATE POLICY "Only admins can insert subscriptions"
ON public.customer_subscriptions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Apenas admins podem atualizar assinaturas
CREATE POLICY "Only admins can update subscriptions"
ON public.customer_subscriptions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_user_id ON public.customer_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_end_date ON public.customer_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires_at ON public.profiles(plan_expires_at);

-- 6. Criar função RPC para admin buscar usuários com informações de plano
CREATE OR REPLACE FUNCTION public.admin_get_users_with_plans()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  business_name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  plan_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar esta função';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.business_name,
    p.full_name,
    p.phone,
    u.email::TEXT,
    p.created_at,
    p.plan_expires_at,
    COALESCE(p.plan_status, 'none') as plan_status
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- 7. Criar função RPC para adicionar dias ao plano (com lógica de renovação)
CREATE OR REPLACE FUNCTION public.admin_add_subscription_days(
  _user_id UUID,
  _paid_at TIMESTAMPTZ,
  _days_added INTEGER,
  _admin_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription_id UUID;
  _start_date TIMESTAMPTZ;
  _end_date TIMESTAMPTZ;
  _current_end_date TIMESTAMPTZ;
  _current_plan_status TEXT;
  _current_plan_expires_at TIMESTAMPTZ;
  _now TIMESTAMPTZ := now();
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar esta função';
  END IF;

  -- Verificar se o usuário existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Buscar o status atual do plano do usuário
  SELECT plan_status, plan_expires_at 
  INTO _current_plan_status, _current_plan_expires_at
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Verificar se o plano está realmente ativo (não cancelado/expirado)
  -- Se o status é 'expired' ou 'none', ou se a data já passou, ignorar registros antigos
  IF _current_plan_status = 'active' 
     AND _current_plan_expires_at IS NOT NULL 
     AND _current_plan_expires_at >= _now THEN
    -- Plano está ativo: buscar a data de término atual
    _current_end_date := _current_plan_expires_at;
  ELSE
    -- Plano está expirado, cancelado ou nunca teve plano: ignorar registros antigos
    _current_end_date := NULL;
  END IF;

  -- Calcular start_date e end_date baseado nas regras de negócio
  IF _current_end_date IS NOT NULL AND _current_end_date >= _now THEN
    -- Plano ativo: começar no dia seguinte ao término atual
    _start_date := _current_end_date + interval '1 day';
  ELSE
    -- Plano expirado, cancelado ou nunca teve plano: começar na data do pagamento
    _start_date := _paid_at;
  END IF;

  -- Calcular end_date
  _end_date := _start_date + (_days_added || ' days')::interval;

  -- Inserir nova assinatura
  INSERT INTO public.customer_subscriptions (
    user_id,
    paid_at,
    days_added,
    start_date,
    end_date,
    admin_id
  ) VALUES (
    _user_id,
    _paid_at,
    _days_added,
    _start_date,
    _end_date,
    _admin_email
  ) RETURNING id INTO _subscription_id;

  -- Atualizar plan_expires_at e plan_status na tabela profiles
  UPDATE public.profiles
  SET 
    plan_expires_at = _end_date,
    plan_status = 'active'
  WHERE user_id = _user_id;

  RETURN _subscription_id;
END;
$$;

-- 8. Criar função para atualizar automaticamente plan_status quando expira
CREATE OR REPLACE FUNCTION public.update_expired_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET plan_status = 'expired'
  WHERE plan_status = 'active'
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at < now();
END;
$$;

-- 8.1. Criar função RPC para cancelar plano do usuário
CREATE OR REPLACE FUNCTION public.admin_cancel_user_plan(
  _user_id UUID,
  _admin_email TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar esta função';
  END IF;

  -- Verificar se o usuário existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Atualizar plan_status para 'expired' e limpar plan_expires_at
  UPDATE public.profiles
  SET 
    plan_status = 'expired',
    plan_expires_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- 9. Criar trigger para atualizar plan_status periodicamente (opcional - pode ser chamado via cron)
-- Nota: Para produção, configure um cron job no Supabase para chamar update_expired_plans() periodicamente

-- 10. Garantir que o admin tenha acesso permanente (não expira)
UPDATE public.profiles 
SET plan_status = 'active', plan_expires_at = NULL
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'dennervanes@hotmail.com'
);

