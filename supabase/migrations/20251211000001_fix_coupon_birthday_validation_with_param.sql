-- Corrigir validação de cupom para aceitar data de nascimento como parâmetro
-- Isso permite validar mesmo quando o cliente ainda não existe no banco

-- Atualizar função validate_coupon_only para aceitar data de nascimento
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
  v_ja_usou BOOLEAN;
  v_desconto DECIMAL;
  v_valor_final DECIMAL;
  v_telefone_normalizado TEXT;
  v_cliente_id UUID;
  v_cliente_birth_date DATE;
  v_cliente_aniversariante BOOLEAN;
  v_mes_atual INTEGER;
  v_birth_date_to_check DATE;
BEGIN
  -- Normalizar telefone (remover caracteres não numéricos)
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');

  -- Buscar cliente pelo telefone (se existir)
  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  -- Usar data de nascimento do parâmetro se cliente não existir, senão usar do banco
  IF v_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := v_cliente_birth_date;
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := p_cliente_birth_date;
  ELSE
    -- Se não tem data de nascimento nem no banco nem no parâmetro, não pode validar aniversário
    v_birth_date_to_check := NULL;
  END IF;

  -- Buscar promoção do usuário (sem filtrar por ativa primeiro para verificar status)
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

  -- Verificar se promoção existe
  IF v_promotion IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  -- VERIFICAR SE PROMOÇÃO ESTÁ ATIVA (validação crítica)
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

  -- Verificar mês (se valido_apenas_no_mes)
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

  -- VALIDAÇÃO PRINCIPAL: Verificar se cliente é aniversariante do mês
  IF v_birth_date_to_check IS NOT NULL THEN
    v_mes_atual := EXTRACT(MONTH FROM now());
    
    -- Verificar se o mês de nascimento do cliente corresponde ao mês atual
    -- E se está dentro do período da promoção
    v_cliente_aniversariante := (
      EXTRACT(MONTH FROM v_birth_date_to_check) = v_mes_atual
      AND (
        -- Se a promoção cobre o mês atual, permitir
        (EXTRACT(MONTH FROM v_promotion.data_inicio) <= v_mes_atual 
         AND EXTRACT(MONTH FROM v_promotion.data_fim) >= v_mes_atual)
        OR
        -- Se a promoção é para um mês específico e estamos nele
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
    -- Se não tem data de nascimento, não pode validar se é aniversariante
    RETURN json_build_object(
      'valid', false,
      'error', 'Data de nascimento é necessária para validar cupom de aniversário'
    );
  END IF;

  -- Verificar se já usou (um_uso_por_cliente) - NORMALIZANDO TELEFONE
  -- IMPORTANTE: Verifica se ESTE cliente específico já usou, não se o cupom foi usado por qualquer um
  IF v_promotion.um_uso_por_cliente THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.coupon_uses
      WHERE promotion_id = v_promotion.id
        AND regexp_replace(cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
        AND usado_em::date >= v_promotion.data_inicio
        AND usado_em::date <= v_promotion.data_fim
    ) INTO v_ja_usou;

    IF v_ja_usou THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom já foi utilizado por este cliente no período vigente'
      );
    END IF;
  END IF;

  -- Calcular desconto
  v_desconto := (p_valor_original * v_promotion.percentual_desconto / 100);
  v_valor_final := p_valor_original - v_desconto;

  -- Retornar sucesso (SEM registrar uso - apenas validação)
  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto
  );
END;
$$;

-- Atualizar função validate_and_use_coupon também
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
  v_ja_usou BOOLEAN;
  v_desconto DECIMAL;
  v_valor_final DECIMAL;
  v_use_id UUID;
  v_cliente_id UUID;
  v_telefone_normalizado TEXT;
  v_cliente_birth_date DATE;
  v_cliente_aniversariante BOOLEAN;
  v_mes_atual INTEGER;
  v_birth_date_to_check DATE;
BEGIN
  -- Normalizar telefone para comparação (remover caracteres não numéricos)
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');

  -- Buscar cliente pelo telefone (se existir)
  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  -- Usar data de nascimento do parâmetro se cliente não existir, senão usar do banco
  IF v_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := v_cliente_birth_date;
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := p_cliente_birth_date;
  ELSE
    v_birth_date_to_check := NULL;
  END IF;

  -- Buscar promoção ativa do usuário
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE user_id = p_user_id
    AND ativa = true
    AND (
      (gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom))
      OR 
      (gerar_cupom_automatico = true AND prefixo_cupom IS NOT NULL 
        AND UPPER(p_codigo_cupom) LIKE UPPER(prefixo_cupom || '%'))
    )
    AND now()::date >= data_inicio
    AND now()::date <= data_fim
  ORDER BY 
    CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_promotion IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
    );
  END IF;

  -- Verificar período (só se estiver ativa)
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
        'error', 'Cupom válido apenas no período especificado'
      );
    END IF;
  END IF;

  -- VALIDAÇÃO PRINCIPAL: Verificar se cliente é aniversariante do mês
  IF v_birth_date_to_check IS NOT NULL THEN
    v_mes_atual := EXTRACT(MONTH FROM now());
    
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

  -- Verificar se já usou (um_uso_por_cliente) - comparando telefones normalizados
  -- IMPORTANTE: Verifica se ESTE cliente específico já usou
  IF v_promotion.um_uso_por_cliente THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.coupon_uses
      WHERE promotion_id = v_promotion.id
        AND regexp_replace(cliente_telefone, '[^0-9]', '', 'g') = v_telefone_normalizado
        AND usado_em::date >= v_promotion.data_inicio
        AND usado_em::date <= v_promotion.data_fim
    ) INTO v_ja_usou;

    IF v_ja_usou THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom já foi utilizado por este cliente no período vigente'
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

  RETURN json_build_object(
    'valid', true,
    'desconto', v_desconto,
    'valor_final', v_valor_final,
    'percentual', v_promotion.percentual_desconto,
    'use_id', v_use_id
  );
END;
$$;

