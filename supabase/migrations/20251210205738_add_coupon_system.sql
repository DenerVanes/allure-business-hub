-- Sistema de Cupons de Desconto Seguro
-- Criar tabela de promoções
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativa BOOLEAN NOT NULL DEFAULT false,
  percentual_desconto INTEGER NOT NULL CHECK (percentual_desconto >= 5 AND percentual_desconto <= 50),
  nome_cupom TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  gerar_cupom_automatico BOOLEAN NOT NULL DEFAULT false,
  prefixo_cupom TEXT,
  valido_apenas_no_mes BOOLEAN NOT NULL DEFAULT true,
  um_uso_por_cliente BOOLEAN NOT NULL DEFAULT true,
  enviar_por_whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (data_fim >= data_inicio)
);

-- Criar tabela de usos de cupons (rastrea cada uso)
CREATE TABLE IF NOT EXISTS public.coupon_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_cupom TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  percentual_desconto INTEGER NOT NULL,
  valor_desconto DECIMAL(10,2) NOT NULL,
  valor_original DECIMAL(10,2) NOT NULL,
  valor_final DECIMAL(10,2) NOT NULL,
  usado_em TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_discount CHECK (valor_desconto >= 0 AND valor_final >= 0)
);

-- Habilitar RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para promotions
CREATE POLICY "Users can manage their own promotions"
ON public.promotions
FOR ALL
USING (auth.uid() = user_id);

-- Políticas RLS para coupon_uses
CREATE POLICY "Users can view their own coupon uses"
ON public.coupon_uses
FOR SELECT
USING (auth.uid() = user_id);

-- Permitir inserção apenas através da função (que faz validação)
CREATE POLICY "Users can insert coupon uses via function"
ON public.coupon_uses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_coupon_uses_promotion ON public.coupon_uses(promotion_id);
CREATE INDEX idx_coupon_uses_telefone ON public.coupon_uses(cliente_telefone);
CREATE INDEX idx_coupon_uses_codigo ON public.coupon_uses(codigo_cupom);
CREATE INDEX idx_coupon_uses_appointment ON public.coupon_uses(appointment_id);
CREATE INDEX idx_promotions_user ON public.promotions(user_id);
CREATE INDEX idx_promotions_active ON public.promotions(ativa) WHERE ativa = true;

-- Função para validar e registrar uso de cupom
CREATE OR REPLACE FUNCTION public.validate_and_use_coupon(
  p_user_id UUID,
  p_codigo_cupom TEXT,
  p_cliente_telefone TEXT,
  p_valor_original DECIMAL,
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
BEGIN
  -- Normalizar telefone para comparação (remover caracteres não numéricos)
  v_telefone_normalizado := regexp_replace(p_cliente_telefone, '[^0-9]', '', 'g');
  -- Buscar promoção ativa do usuário
  -- Primeiro tentar buscar por cupom único (nome_cupom exato)
  -- Depois tentar buscar por cupom personalizado (código começa com prefixo)
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
      'error', 'Promoção fora do período válido'
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
        'error', 'Cupom válido apenas no período especificado'
      );
    END IF;
  END IF;

  -- Verificar se já usou (um_uso_por_cliente) - comparando telefones normalizados
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

  -- Buscar cliente_id pelo telefone (se existir) - comparando telefones normalizados
  SELECT id INTO v_cliente_id
  FROM public.clients
  WHERE user_id = p_user_id
    AND regexp_replace(phone, '[^0-9]', '', 'g') = v_telefone_normalizado
  LIMIT 1;

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
    v_telefone_normalizado, -- Salvar telefone normalizado
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

-- Função para buscar cliente_id pelo telefone (usado na função acima)
CREATE OR REPLACE FUNCTION public.get_client_id_by_phone(
  p_user_id UUID,
  p_telefone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE user_id = p_user_id
    AND phone = p_telefone
  LIMIT 1;
  
  RETURN v_client_id;
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

