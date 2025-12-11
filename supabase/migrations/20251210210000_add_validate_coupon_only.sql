-- Função para apenas validar cupom sem registrar uso (usada no frontend para preview)
CREATE OR REPLACE FUNCTION public.validate_coupon_only(
  p_user_id UUID,
  p_codigo_cupom TEXT,
  p_cliente_telefone TEXT,
  p_valor_original DECIMAL
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
BEGIN
  -- Normalizar telefone (remover caracteres não numéricos)
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');

  -- Buscar promoção ativa do usuário
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE user_id = p_user_id
    AND ativa = true
    AND (
      -- Cupom único: código deve ser exatamente igual ao nome_cupom
      (gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom))
      OR 
      -- Cupom personalizado: código deve começar com o prefixo
      (gerar_cupom_automatico = true AND prefixo_cupom IS NOT NULL 
        AND UPPER(p_codigo_cupom) LIKE UPPER(prefixo_cupom || '%'))
    )
    AND now()::date >= data_inicio
    AND now()::date <= data_fim
  ORDER BY 
    -- Priorizar cupom único (match exato)
    CASE WHEN gerar_cupom_automatico = false AND UPPER(nome_cupom) = UPPER(p_codigo_cupom) THEN 0 ELSE 1 END
  LIMIT 1;

  -- Verificar se promoção existe
  IF v_promotion IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cupom inválido ou expirado'
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

  -- Verificar se já usou (um_uso_por_cliente) - NORMALIZANDO TELEFONE
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

