-- ============================================
-- Migração: Migrar cupons do localStorage para banco de dados
-- ============================================
-- 
-- OBJETIVO:
-- Garantir que os cupons sejam armazenados apenas no banco de dados
-- A tabela 'promotions' já armazena os cupons criados (um registro por cupom)
-- Esta migração garante que a estrutura está correta e completa
-- ============================================

-- A tabela 'promotions' já existe e armazena os cupons criados
-- Cada registro em 'promotions' representa um cupom com:
-- - nome_cupom: código do cupom (ex: 'NIVER10OFF')
-- - percentual_desconto: desconto do cupom
-- - data_inicio/data_fim: período de validade
-- - status: ativo, pausado, cancelado
-- - user_id: isolamento por salão

-- Garantir que a coluna 'status' existe (foi adicionada em migração anterior)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'promotions' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.promotions 
    ADD COLUMN status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'cancelado'));
  END IF;
END $$;

-- Garantir que as colunas de limite existem (foram adicionadas em migração anterior)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'promotions' 
    AND column_name = 'limite_cupons_ativo'
  ) THEN
    ALTER TABLE public.promotions 
    ADD COLUMN limite_cupons_ativo BOOLEAN DEFAULT false,
    ADD COLUMN limite_cupons INTEGER DEFAULT 0;
  END IF;
END $$;

-- Garantir índices para performance
CREATE INDEX IF NOT EXISTS idx_promotions_user_codigo ON public.promotions(user_id, nome_cupom);
CREATE INDEX IF NOT EXISTS idx_promotions_user_status ON public.promotions(user_id, status, ativa);
CREATE INDEX IF NOT EXISTS idx_promotions_user_nome_cupom ON public.promotions(user_id, nome_cupom) WHERE ativa = true;

-- Garantir que não há cupons duplicados por user_id + nome_cupom
-- Criar constraint única (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'promotions_user_codigo_unique'
  ) THEN
    ALTER TABLE public.promotions 
    ADD CONSTRAINT promotions_user_codigo_unique 
    UNIQUE (user_id, nome_cupom);
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON TABLE public.promotions IS 'Armazena os cupons criados por cada salão. Cada registro é um cupom único.';
COMMENT ON COLUMN public.promotions.nome_cupom IS 'Código do cupom (ex: NIVER10OFF, DEZEMBRO2024). Deve ser único por user_id.';
COMMENT ON COLUMN public.promotions.status IS 'Status do cupom: ativo (pode ser usado), pausado (temporariamente desabilitado), cancelado (permanentemente desabilitado)';
COMMENT ON COLUMN public.promotions.ativa IS 'Campo legado, mantido para compatibilidade. Use status = ''ativo'' para verificar se está ativo.';

-- NOTA IMPORTANTE:
-- A partir desta migração, os cupons devem ser armazenados APENAS no banco de dados
-- A tabela 'promotions' é a fonte única da verdade para os cupons criados
-- O frontend deve buscar os cupons da tabela 'promotions' filtrando por user_id
-- O localStorage pode ser usado apenas como cache temporário, mas não como fonte principal

