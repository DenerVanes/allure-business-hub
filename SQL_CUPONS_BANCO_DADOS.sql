-- ============================================
-- SQL PARA EXECUTAR NO SUPABASE
-- Migração: Cupons devem estar APENAS no banco de dados
-- ============================================
-- 
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Garantir que a coluna 'status' existe
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
    
    -- Atualizar registros existentes
    UPDATE public.promotions 
    SET status = CASE 
      WHEN ativa = true THEN 'ativo' 
      ELSE 'pausado' 
    END 
    WHERE status IS NULL;
  END IF;
END $$;

-- 2. Garantir que as colunas de limite existem
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

-- 3. Garantir constraint única para evitar cupons duplicados por salão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'promotions_user_codigo_unique'
  ) THEN
    -- Remover duplicatas antes de criar constraint (se houver)
    DELETE FROM public.promotions p1
    WHERE EXISTS (
      SELECT 1 FROM public.promotions p2
      WHERE p2.user_id = p1.user_id
        AND UPPER(TRIM(p2.nome_cupom)) = UPPER(TRIM(p1.nome_cupom))
        AND p2.id < p1.id
    );
    
    -- Criar constraint única
    ALTER TABLE public.promotions 
    ADD CONSTRAINT promotions_user_codigo_unique 
    UNIQUE (user_id, nome_cupom);
  END IF;
END $$;

-- 4. Garantir índices para performance
CREATE INDEX IF NOT EXISTS idx_promotions_user_codigo ON public.promotions(user_id, nome_cupom);
CREATE INDEX IF NOT EXISTS idx_promotions_user_status ON public.promotions(user_id, status, ativa);
CREATE INDEX IF NOT EXISTS idx_promotions_user_nome_cupom ON public.promotions(user_id, nome_cupom) WHERE ativa = true;

-- 5. Garantir políticas RLS corretas
DROP POLICY IF EXISTS "Users can view their own promotions" ON public.promotions;
CREATE POLICY "Users can view their own promotions"
ON public.promotions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own promotions" ON public.promotions;
CREATE POLICY "Users can manage their own promotions"
ON public.promotions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Comentários para documentação
COMMENT ON TABLE public.promotions IS 'Armazena os cupons criados por cada salão. Cada registro é um cupom único. FONTE ÚNICA DA VERDADE - não usar localStorage.';
COMMENT ON COLUMN public.promotions.nome_cupom IS 'Código do cupom (ex: NIVER10OFF). Deve ser único por user_id.';
COMMENT ON COLUMN public.promotions.status IS 'Status: ativo (pode ser usado), pausado (temporariamente desabilitado), cancelado (permanentemente desabilitado)';
COMMENT ON COLUMN public.promotions.ativa IS 'Campo legado, mantido para compatibilidade. Use status = ''ativo'' para verificar se está ativo.';

-- ============================================
-- IMPORTANTE:
-- Após executar este SQL, todos os cupons devem ser gerenciados
-- exclusivamente através da tabela 'promotions' no banco de dados.
-- O localStorage não deve mais ser usado para armazenar cupons.
-- ============================================

