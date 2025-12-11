-- Adicionar logs de depuração e função de debug para cupons

-- Função de debug para verificar estado da promoção
CREATE OR REPLACE FUNCTION public.debug_coupon_validation(
  p_user_id UUID,
  p_codigo_cupom TEXT,
  p_cliente_telefone TEXT,
  p_cliente_birth_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion RECORD;
  v_cliente_id UUID;
  v_cliente_birth_date DATE;
  v_telefone_normalizado TEXT;
  v_mes_atual INTEGER;
  v_mes_nascimento INTEGER;
  v_debug_info JSON;
BEGIN
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');
  v_mes_atual := EXTRACT(MONTH FROM now());

  -- Buscar cliente
  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  -- Buscar promoção
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
  ORDER BY 
    CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
  LIMIT 1;

  -- Calcular mês de nascimento
  IF v_cliente_birth_date IS NOT NULL THEN
    v_mes_nascimento := EXTRACT(MONTH FROM v_cliente_birth_date);
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_mes_nascimento := EXTRACT(MONTH FROM p_cliente_birth_date);
  ELSE
    v_mes_nascimento := NULL;
  END IF;

  -- Retornar informações de debug
  RETURN json_build_object(
    'telefone_normalizado', v_telefone_normalizado,
    'cliente_existe', v_cliente_id IS NOT NULL,
    'cliente_id', v_cliente_id,
    'cliente_birth_date_banco', v_cliente_birth_date,
    'cliente_birth_date_param', p_cliente_birth_date,
    'mes_nascimento', v_mes_nascimento,
    'mes_atual', v_mes_atual,
    'eh_aniversariante', v_mes_nascimento = v_mes_atual,
    'promocao_existe', v_promotion IS NOT NULL,
    'promocao_ativa', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.ativa ELSE NULL END,
    'promocao_nome_cupom', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.nome_cupom ELSE NULL END,
    'promocao_gerar_automatico', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.gerar_cupom_automatico ELSE NULL END,
    'promocao_prefixo', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.prefixo_cupom ELSE NULL END,
    'promocao_data_inicio', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.data_inicio ELSE NULL END,
    'promocao_data_fim', CASE WHEN v_promotion IS NOT NULL THEN v_promotion.data_fim ELSE NULL END,
    'data_atual', now()::date,
    'periodo_valido', CASE WHEN v_promotion IS NOT NULL THEN (now()::date >= v_promotion.data_inicio AND now()::date <= v_promotion.data_fim) ELSE NULL END,
    'codigo_cupom_buscado', p_codigo_cupom
  );
END;
$$;

-- Atualizar função validate_coupon_only com logs
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
  v_debug_log TEXT;
BEGIN
  -- Normalizar telefone (remover caracteres não numéricos)
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');
  v_debug_log := 'Iniciando validação. Telefone normalizado: ' || v_telefone_normalizado;

  -- Buscar cliente pelo telefone (se existir)
  SELECT id, birth_date INTO v_cliente_id, v_cliente_birth_date
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    v_debug_log := v_debug_log || ' | Cliente encontrado no banco. ID: ' || v_cliente_id;
  ELSE
    v_debug_log := v_debug_log || ' | Cliente NÃO encontrado no banco';
  END IF;

  -- Usar data de nascimento do parâmetro se cliente não existir, senão usar do banco
  IF v_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := v_cliente_birth_date;
    v_debug_log := v_debug_log || ' | Usando data do banco: ' || v_birth_date_to_check::TEXT;
  ELSIF p_cliente_birth_date IS NOT NULL THEN
    v_birth_date_to_check := p_cliente_birth_date;
    v_debug_log := v_debug_log || ' | Usando data do parâmetro: ' || v_birth_date_to_check::TEXT;
  ELSE
    v_birth_date_to_check := NULL;
    v_debug_log := v_debug_log || ' | NENHUMA data de nascimento disponível';
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

  -- Verificar se promoção existe
  IF v_promotion IS NULL THEN
    -- Tentar buscar sem filtro de data para debug
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
    ORDER BY 
      CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_promotion IS NULL THEN
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom inválido ou expirado',
        'debug', 'Promoção não encontrada. Código buscado: ' || p_codigo_cupom || ' | User ID: ' || p_user_id::TEXT
      );
    ELSE
      RETURN json_build_object(
        'valid', false,
        'error', 'Cupom inválido ou expirado',
        'debug', 'Promoção encontrada mas fora do período. Início: ' || v_promotion.data_inicio::TEXT || ' | Fim: ' || v_promotion.data_fim::TEXT || ' | Hoje: ' || now()::date::TEXT
      );
    END IF;
  END IF;

  v_debug_log := v_debug_log || ' | Promoção encontrada: ' || v_promotion.nome_cupom || ' | Ativa: ' || v_promotion.ativa::TEXT || ' | Período: ' || v_promotion.data_inicio::TEXT || ' até ' || v_promotion.data_fim::TEXT;

  -- Verificar período (só se estiver ativa)
  v_periodo_valido := (now()::date >= v_promotion.data_inicio AND now()::date <= v_promotion.data_fim);
  IF NOT v_periodo_valido THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado',
      'debug', 'Período inválido. Hoje: ' || now()::date::TEXT || ' | Início: ' || v_promotion.data_inicio::TEXT || ' | Fim: ' || v_promotion.data_fim::TEXT
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
        'error', 'Cupom inválido ou expirado',
        'debug', 'Mês inválido. Mês atual: ' || EXTRACT(MONTH FROM now())::TEXT || ' | Mês início promoção: ' || EXTRACT(MONTH FROM v_promotion.data_inicio)::TEXT || ' | Mês fim promoção: ' || EXTRACT(MONTH FROM v_promotion.data_fim)::TEXT
      );
    END IF;
  END IF;

  -- VALIDAÇÃO PRINCIPAL: Verificar se cliente é aniversariante do mês
  IF v_birth_date_to_check IS NOT NULL THEN
    v_mes_atual := EXTRACT(MONTH FROM now());
    v_debug_log := v_debug_log || ' | Mês atual: ' || v_mes_atual::TEXT || ' | Mês nascimento: ' || EXTRACT(MONTH FROM v_birth_date_to_check)::TEXT;
    
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
        'error', 'Cupom disponível apenas para aniversariantes do mês',
        'debug', 'Não é aniversariante. Mês atual: ' || v_mes_atual::TEXT || ' | Mês nascimento: ' || EXTRACT(MONTH FROM v_birth_date_to_check)::TEXT || ' | ' || v_debug_log
      );
    END IF;
    
    v_debug_log := v_debug_log || ' | Cliente é aniversariante: SIM';
  ELSE
    RETURN json_build_object(
      'valid', false,
      'error', 'Data de nascimento é necessária para validar cupom de aniversário',
      'debug', 'Data de nascimento não fornecida. ' || v_debug_log
    );
  END IF;

  -- Verificar se já usou (um_uso_por_cliente)
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
        'error', 'Cupom já foi utilizado por este cliente no período vigente',
        'debug', 'Cliente já usou o cupom. ' || v_debug_log
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
    'percentual', v_promotion.percentual_desconto,
    'debug', 'Validação OK. ' || v_debug_log
  );
END;
$$;

