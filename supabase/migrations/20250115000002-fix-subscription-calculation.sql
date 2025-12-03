-- ============================================
-- Correção: Ajustar lógica de cálculo de renovação de planos
-- ============================================
-- Problema: Quando um plano é cancelado e depois reativado, 
-- o sistema estava somando os dias antigos com os novos.
-- Solução: Verificar o status atual do plano antes de calcular,
-- ignorando registros antigos se o plano foi cancelado/expirado.

-- Atualizar função RPC para adicionar dias ao plano
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
    -- Plano está ativo: usar a data de término atual
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

