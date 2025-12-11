-- ============================================
-- Migração: Corrigir políticas RLS e segurança para cupons
-- ============================================
-- 
-- OBJETIVO:
-- 1. Adicionar validação de segurança nas funções RPC (garantir que p_user_id = auth.uid())
-- 2. Adicionar políticas RLS faltantes para UPDATE e DELETE em coupon_uses
-- 3. Garantir isolamento total entre salões
-- ============================================

-- 1. Adicionar políticas RLS faltantes para coupon_uses (UPDATE e DELETE)
-- Remover políticas existentes se houver (para evitar duplicatas)
DROP POLICY IF EXISTS "Users can update their own coupon uses" ON public.coupon_uses;
DROP POLICY IF EXISTS "Users can delete their own coupon uses" ON public.coupon_uses;

-- Criar políticas para UPDATE
CREATE POLICY "Users can update their own coupon uses"
ON public.coupon_uses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Criar políticas para DELETE
CREATE POLICY "Users can delete their own coupon uses"
ON public.coupon_uses
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Atualizar função validate_coupon_only para validar que p_user_id = auth.uid()
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
  -- VALIDAÇÃO CRÍTICA DE SEGURANÇA: garantir que o user_id passado corresponde ao usuário autenticado
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Acesso negado: user_id inválido'
    );
  END IF;

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

  -- Verificar se está no mês de aniversário (se valido_apenas_no_mes)
  IF v_promotion.valido_apenas_no_mes THEN
    IF v_birth_date_to_check IS NULL THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Data de nascimento necessária para validar cupom de aniversário'
      );
    END IF;

    -- Verificar se o cliente está no mês de aniversário
    IF v_mes_aniversario != v_mes_atual THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom válido apenas no mês de aniversário'
      );
    END IF;
  END IF;

  -- Verificar se cliente já usou QUALQUER cupom de aniversário no período (mês/ano atual)
  SELECT EXISTS(
    SELECT 1
    FROM public.coupon_uses cu
    JOIN public.promotions p ON p.id = cu.promotion_id
    WHERE cu.user_id = p_user_id
      AND regexp_replace(cu.cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
      AND p.valido_apenas_no_mes = true
      AND EXTRACT(MONTH FROM cu.usado_em) = v_mes_atual
      AND EXTRACT(YEAR FROM cu.usado_em) = v_ano_atual
  ) INTO v_ja_usou_qualquer_cupom;

  IF v_ja_usou_qualquer_cupom THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Você já utilizou um cupom de aniversário neste período. Cada cliente pode usar apenas 1 cupom por mês/ano.'
    );
  END IF;

  -- Verificar limite de cupons (se ativo)
  IF v_promotion.limite_cupons_ativo AND v_promotion.limite_cupons > 0 THEN
    SELECT COUNT(*) INTO v_cupons_utilizados
    FROM public.coupon_uses
    WHERE promotion_id = v_promotion.id
      AND usado_em::date >= v_promotion.data_inicio
      AND usado_em::date <= v_promotion.data_fim;

    IF v_cupons_utilizados >= v_promotion.limite_cupons THEN
      -- Desativar promoção automaticamente quando limite é atingido
      UPDATE public.promotions
      SET ativa = false
      WHERE id = v_promotion.id;
      
      RETURN json_build_object(
        'valid', false,
        'error', 'Promoção expirada ou desativada'
      );
    END IF;
  END IF;

  -- Calcular desconto
  v_desconto := (p_valor_original * v_promotion.percentual_desconto / 100);
  v_valor_final := p_valor_original - v_desconto;

  -- Retornar sucesso (sem registrar uso - isso será feito na função validate_and_use_coupon)
  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto
  );
END;
$$;

-- 3. Atualizar função validate_and_use_coupon para validar que p_user_id = auth.uid()
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
  v_promotion_status TEXT;
BEGIN
  -- VALIDAÇÃO CRÍTICA DE SEGURANÇA: garantir que o user_id passado corresponde ao usuário autenticado
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Acesso negado: user_id inválido'
    );
  END IF;

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

  -- Buscar promoção SEM filtrar por ativa primeiro (para verificar status)
  SELECT *, COALESCE(status, 'ativo') as promotion_status INTO v_promotion
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

  v_promotion_status := COALESCE(v_promotion.promotion_status, 'ativo');

  -- Verificar status da promoção primeiro
  IF v_promotion_status = 'cancelado' OR v_promotion_status = 'pausado' THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'A promoção finalizou'
    );
  END IF;

  -- VERIFICAR SE PROMOÇÃO ESTÁ ATIVA
  IF NOT v_promotion.ativa THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Promoção expirada ou desativada'
    );
  END IF;

  -- Verificar período
  v_periodo_valido := (now()::date >= v_promotion.data_inicio AND now()::date <= v_promotion.data_fim);
  IF NOT v_periodo_valido THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  -- Verificar se está no mês de aniversário (se valido_apenas_no_mes)
  IF v_promotion.valido_apenas_no_mes THEN
    IF v_birth_date_to_check IS NULL THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Data de nascimento necessária para validar cupom de aniversário'
      );
    END IF;

    -- Verificar se o cliente está no mês de aniversário
    IF v_mes_aniversario != v_mes_atual THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom válido apenas no mês de aniversário'
      );
    END IF;
  END IF;

  -- Verificar se cliente já usou QUALQUER cupom de aniversário no período (mês/ano atual)
  SELECT EXISTS(
    SELECT 1
    FROM public.coupon_uses cu
    JOIN public.promotions p ON p.id = cu.promotion_id
    WHERE cu.user_id = p_user_id
      AND regexp_replace(cu.cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
      AND p.valido_apenas_no_mes = true
      AND EXTRACT(MONTH FROM cu.usado_em) = v_mes_atual
      AND EXTRACT(YEAR FROM cu.usado_em) = v_ano_atual
  ) INTO v_ja_usou_qualquer_cupom;

  IF v_ja_usou_qualquer_cupom THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Você já utilizou um cupom de aniversário neste período. Cada cliente pode usar apenas 1 cupom por mês/ano.'
    );
  END IF;

  -- Verificar limite de cupons (se ativo)
  IF v_promotion.limite_cupons_ativo AND v_promotion.limite_cupons > 0 THEN
    SELECT COUNT(*) INTO v_cupons_utilizados
    FROM public.coupon_uses
    WHERE promotion_id = v_promotion.id
      AND usado_em::date >= v_promotion.data_inicio
      AND usado_em::date <= v_promotion.data_fim;

    IF v_cupons_utilizados >= v_promotion.limite_cupons THEN
      -- Desativar promoção automaticamente quando limite é atingido
      UPDATE public.promotions
      SET ativa = false
      WHERE id = v_promotion.id;
      
      RETURN json_build_object(
        'valid', false,
        'error', 'Promoção expirada ou desativada'
      );
    END IF;
  END IF;

  -- Calcular desconto
  v_desconto := (p_valor_original * v_promotion.percentual_desconto / 100);
  v_valor_final := p_valor_original - v_desconto;

  -- Registrar uso (salvar telefone normalizado)
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

  -- Retornar sucesso
  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto,
    'use_id', v_use_id
  );
END;
$$;

