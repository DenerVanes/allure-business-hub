-- ============================================
-- Migração: Ajustar independência de cupons e validação por período
-- ============================================
-- 
-- OBJETIVO:
-- 1. Cada cupom deve ter suas próprias regras (limite, percentual, etc.)
-- 2. Um cliente pode usar apenas 1 cupom de aniversário por período (mês/ano)
-- 3. Se Larissa usou NIVER10OFF em dezembro 2024, ela não pode usar NIVER5 no mesmo período
-- 4. Mas em dezembro 2026, se a promoção for reativada, ela pode usar novamente
-- ============================================

-- Atualizar função validate_coupon_only para verificar uso em QUALQUER cupom do período
CREATE OR REPLACE FUNCTION public.validate_coupon_only(
  p_user_id UUID,
  p_codigo_cupom TEXT,
  p_cliente_telefone TEXT,
  p_valor_original DECIMAL,
  p_cliente_birth_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion RECORD;
  v_periodo_valido BOOLEAN;
  v_mes_valido BOOLEAN;
  v_ja_usou_qualquer_cupom BOOLEAN;
  v_desconto DECIMAL;
  v_valor_final DECIMAL;
  v_cliente_id UUID;
  v_telefone_normalizado TEXT;
  v_cliente_birth_date DATE;
  v_cliente_aniversariante BOOLEAN;
  v_mes_atual INTEGER;
  v_ano_atual INTEGER;
  v_birth_date_to_check DATE;
  v_cupons_utilizados INTEGER;
  v_mes_aniversario INTEGER;
  v_debug_log TEXT := '';
BEGIN
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');
  v_mes_atual := EXTRACT(MONTH FROM now());
  v_ano_atual := EXTRACT(YEAR FROM now());

  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  IF v_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := v_cliente_birth_date;
    v_mes_aniversario := EXTRACT(MONTH FROM v_cliente_birth_date);
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := p_cliente_birth_date;
    v_mes_aniversario := EXTRACT(MONTH FROM p_cliente_birth_date);
  ELSE
    v_birth_date_to_check := NULL;
    v_mes_aniversario := NULL;
  END IF;

  -- Buscar promoção SEM filtrar por ativa primeiro
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE user_id = p_user_id
    AND (
      (gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom))
      OR 
      (gerar_cupom_automatico = true AND prefixo_cupom IS NOT NULL 
        AND UPPER(p_codigo_cupom) LIKE UPPER(prefixo_cupom || '%'))
    )
  ORDER BY 
    CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_promotion IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  -- VERIFICAR SE PROMOÇÃO ESTÁ ATIVA (validação crítica - fazer ANTES de verificar período)
  IF NOT v_promotion.ativa THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Promoção expirada ou desativada'
    );
  END IF;

  -- Agora verificar período (só se estiver ativa)
  v_periodo_valido := (now()::date >= v_promotion.data_inicio AND now()::date <= v_promotion.data_fim);
  IF NOT v_periodo_valido THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  IF v_promotion.valido_apenas_no_mes THEN
    v_mes_valido := (
      EXTRACT(MONTH FROM now()) >= EXTRACT(MONTH FROM v_promotion.data_inicio)
      AND EXTRACT(MONTH FROM now()) <= EXTRACT(MONTH FROM v_promotion.data_fim)
      AND EXTRACT(YEAR FROM now()) >= EXTRACT(YEAR FROM v_promotion.data_inicio)
      AND EXTRACT(YEAR FROM now()) <= EXTRACT(YEAR FROM v_promotion.data_fim)
    );
    IF NOT v_mes_valido THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom inválido ou expirado'
      );
    END IF;
  END IF;

  IF v_birth_date_to_check IS NOT NULL THEN
    v_cliente_aniversariante := (
      EXTRACT(MONTH FROM v_birth_date_to_check) = v_mes_atual
      AND (
        (EXTRACT(MONTH FROM v_promotion.data_inicio) <= v_mes_atual 
         AND EXTRACT(MONTH FROM v_promotion.data_fim) >= v_mes_atual)
        OR
        (EXTRACT(MONTH FROM v_promotion.data_inicio) = v_mes_atual)
      )
    );

    IF NOT v_cliente_aniversariante THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom disponível apenas para aniversariantes do mês'
      );
    END IF;
  ELSE
    RETURN json_build_object(
      'valid', false,
      'error', 'Data de nascimento é necessária para validar cupom de aniversário'
    );
  END IF;

  -- NOVA REGRA: Verificar se o cliente já usou QUALQUER cupom de aniversário no mês/ano atual
  -- Isso garante que um cliente só pode usar 1 cupom por período (mês/ano)
  IF v_mes_aniversario IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.coupon_uses cu
      INNER JOIN public.promotions p ON cu.promotion_id = p.id
      WHERE cu.user_id = p_user_id
        AND regexp_replace(cu.cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
        AND p.valido_apenas_no_mes = true
        AND EXTRACT(MONTH FROM cu.usado_em) = v_mes_aniversario
        AND EXTRACT(YEAR FROM cu.usado_em) = v_ano_atual
        -- Garantir que foi usado no período de uma promoção de aniversário válida
        AND cu.usado_em::date >= p.data_inicio
        AND cu.usado_em::date <= p.data_fim
    ) INTO v_ja_usou_qualquer_cupom;

    IF v_ja_usou_qualquer_cupom THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Você já utilizou um cupom de aniversário neste período. Cada cliente pode usar apenas 1 cupom por mês/ano.'
      );
    END IF;
  END IF;

  -- Verificar limite de cupons (se ativado) para este cupom específico
  IF v_promotion.limite_cupons_ativo AND v_promotion.limite_cupons > 0 THEN
    SELECT COUNT(*) INTO v_cupons_utilizados
    FROM public.coupon_uses
    WHERE promotion_id = v_promotion.id
      AND usado_em::date >= v_promotion.data_inicio
      AND usado_em::date <= v_promotion.data_fim;
    
    IF v_cupons_utilizados >= v_promotion.limite_cupons THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Limite de cupons atingido para este código'
      );
    END IF;
  END IF;

  v_desconto := (p_valor_original * v_promotion.percentual_desconto / 100);
  v_valor_final := p_valor_original - v_desconto;

  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto,
    'debug', 'Validação OK. ' || v_debug_log
  );
END;
$$;

-- Atualizar função validate_and_use_coupon para verificar uso em QUALQUER cupom do período
CREATE OR REPLACE FUNCTION public.validate_and_use_coupon(
  p_user_id UUID,
  p_codigo_cupom TEXT,
  p_cliente_telefone TEXT,
  p_valor_original DECIMAL,
  p_cliente_birth_date DATE DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion RECORD;
  v_periodo_valido BOOLEAN;
  v_mes_valido BOOLEAN;
  v_ja_usou_qualquer_cupom BOOLEAN;
  v_desconto DECIMAL;
  v_valor_final DECIMAL;
  v_use_id UUID;
  v_cliente_id UUID;
  v_telefone_normalizado TEXT;
  v_cliente_birth_date DATE;
  v_cliente_aniversariante BOOLEAN;
  v_mes_atual INTEGER;
  v_ano_atual INTEGER;
  v_birth_date_to_check DATE;
  v_cupons_utilizados INTEGER;
  v_mes_aniversario INTEGER;
BEGIN
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');
  v_mes_atual := EXTRACT(MONTH FROM now());
  v_ano_atual := EXTRACT(YEAR FROM now());

  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  IF v_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := v_cliente_birth_date;
    v_mes_aniversario := EXTRACT(MONTH FROM v_cliente_birth_date);
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := p_cliente_birth_date;
    v_mes_aniversario := EXTRACT(MONTH FROM p_cliente_birth_date);
  ELSE
    v_birth_date_to_check := NULL;
    v_mes_aniversario := NULL;
  END IF;

  -- Buscar promoção SEM filtrar por ativa primeiro
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE user_id = p_user_id
    AND (
      (gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom))
      OR 
      (gerar_cupom_automatico = true AND prefixo_cupom IS NOT NULL 
        AND UPPER(p_codigo_cupom) LIKE UPPER(prefixo_cupom || '%'))
    )
  ORDER BY 
    CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_promotion IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  -- VERIFICAR SE PROMOÇÃO ESTÁ ATIVA (validação crítica - fazer ANTES de verificar período)
  IF NOT v_promotion.ativa THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Promoção expirada ou desativada'
    );
  END IF;

  -- VERIFICAR LIMITE DE CUPONS (se ativado) - ANTES de registrar o uso
  IF v_promotion.limite_cupons_ativo AND v_promotion.limite_cupons > 0 THEN
    -- Contar cupons já utilizados nesta promoção
    SELECT COUNT(*) INTO v_cupons_utilizados
    FROM public.coupon_uses
    WHERE promotion_id = v_promotion.id
      AND usado_em::date >= v_promotion.data_inicio
      AND usado_em::date <= v_promotion.data_fim;
    
    -- Se já atingiu o limite, desativar e rejeitar
    IF v_cupons_utilizados >= v_promotion.limite_cupons THEN
      UPDATE public.promotions
      SET ativa = false
      WHERE id = v_promotion.id;
      
      RETURN json_build_object(
        'valid', false,
        'error', 'Promoção expirada ou desativada'
      );
    END IF;
  END IF;

  -- Agora verificar período (só se estiver ativa)
  v_periodo_valido := (now()::date >= v_promotion.data_inicio AND now()::date <= v_promotion.data_fim);
  IF NOT v_periodo_valido THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  IF v_promotion.valido_apenas_no_mes THEN
    v_mes_valido := (
      EXTRACT(MONTH FROM now()) >= EXTRACT(MONTH FROM v_promotion.data_inicio)
      AND EXTRACT(MONTH FROM now()) <= EXTRACT(MONTH FROM v_promotion.data_fim)
      AND EXTRACT(YEAR FROM now()) >= EXTRACT(YEAR FROM v_promotion.data_inicio)
      AND EXTRACT(YEAR FROM now()) <= EXTRACT(YEAR FROM v_promotion.data_fim)
    );
    IF NOT v_mes_valido THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom inválido ou expirado'
      );
    END IF;
  END IF;

  IF v_birth_date_to_check IS NOT NULL THEN
    v_cliente_aniversariante := (
      EXTRACT(MONTH FROM v_birth_date_to_check) = v_mes_atual
      AND (
        (EXTRACT(MONTH FROM v_promotion.data_inicio) <= v_mes_atual 
         AND EXTRACT(MONTH FROM v_promotion.data_fim) >= v_mes_atual)
        OR
        (EXTRACT(MONTH FROM v_promotion.data_inicio) = v_mes_atual)
      )
    );

    IF NOT v_cliente_aniversariante THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom disponível apenas para aniversariantes do mês'
      );
    END IF;
  ELSE
    RETURN json_build_object(
      'valid', false,
      'error', 'Data de nascimento é necessária para validar cupom de aniversário'
    );
  END IF;

  -- NOVA REGRA: Verificar se o cliente já usou QUALQUER cupom de aniversário no mês/ano atual
  -- Isso garante que um cliente só pode usar 1 cupom por período (mês/ano)
  IF v_mes_aniversario IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.coupon_uses cu
      INNER JOIN public.promotions p ON cu.promotion_id = p.id
      WHERE cu.user_id = p_user_id
        AND regexp_replace(cu.cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
        AND p.valido_apenas_no_mes = true
        AND EXTRACT(MONTH FROM cu.usado_em) = v_mes_aniversario
        AND EXTRACT(YEAR FROM cu.usado_em) = v_ano_atual
        -- Garantir que foi usado no período de uma promoção de aniversário válida
        AND cu.usado_em::date >= p.data_inicio
        AND cu.usado_em::date <= p.data_fim
    ) INTO v_ja_usou_qualquer_cupom;

    IF v_ja_usou_qualquer_cupom THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Você já utilizou um cupom de aniversário neste período. Cada cliente pode usar apenas 1 cupom por mês/ano.'
      );
    END IF;
  END IF;

  v_desconto := (p_valor_original * v_promotion.percentual_desconto / 100);
  v_valor_final := p_valor_original - v_desconto;

  -- Registrar uso do cupom
  INSERT INTO public.coupon_uses (
    promotion_id,
    user_id,
    codigo_cupom,
    cliente_telefone,
    cliente_id,
    appointment_id,
    percentual_desconto,
    valor_desconto,
    valor_original,
    valor_final
  ) VALUES (
    v_promotion.id,
    p_user_id,
    UPPER(p_codigo_cupom),
    v_telefone_normalizado,
    v_cliente_id,
    p_appointment_id,
    v_promotion.percentual_desconto,
    v_desconto,
    p_valor_original,
    v_valor_final
  ) RETURNING id INTO v_use_id;

  -- Verificar novamente se atingiu o limite após registrar o uso
  IF v_promotion.limite_cupons_ativo AND v_promotion.limite_cupons > 0 THEN
    SELECT COUNT(*) INTO v_cupons_utilizados
    FROM public.coupon_uses
    WHERE promotion_id = v_promotion.id
      AND usado_em::date >= v_promotion.data_inicio
      AND usado_em::date <= v_promotion.data_fim;
    
    -- Se atingiu o limite após este uso, desativar promoção
    IF v_cupons_utilizados >= v_promotion.limite_cupons THEN
      UPDATE public.promotions
      SET ativa = false
      WHERE id = v_promotion.id;
    END IF;
  END IF;

  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto,
    'use_id', v_use_id
  );
END;
$$;

