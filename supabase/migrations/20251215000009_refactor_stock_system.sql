-- ============================================
-- REFATORAÇÃO COMPLETA DO SISTEMA DE ESTOQUE
-- Baseado nas especificações do usuário
-- ============================================

-- 1. Adicionar novos campos na tabela products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS estoque_unidades DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS estoque_total DECIMAL(10,2);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS preco_medio_atual DECIMAL(10,2);

-- Comentários para documentação
COMMENT ON COLUMN public.products.estoque_unidades IS 'Quantidade de frascos/caixas/unidades físicas';
COMMENT ON COLUMN public.products.estoque_total IS 'Quantidade total em ml/g/unidade (calculado automaticamente)';
COMMENT ON COLUMN public.products.preco_medio_atual IS 'Preço médio atual do produto (calculado automaticamente)';

-- Atualizar campos existentes para valores iniciais
-- Se quantity existe, calcular estoque_unidades e estoque_total
UPDATE public.products 
SET 
  estoque_unidades = CASE 
    WHEN unit = 'unidade' THEN quantity
    WHEN quantity_per_unit > 0 THEN quantity / quantity_per_unit
    ELSE 0
  END,
  estoque_total = quantity,
  preco_medio_atual = cost_price
WHERE estoque_unidades IS NULL OR estoque_total IS NULL OR preco_medio_atual IS NULL;

-- 2. Criar tabela de histórico de entradas de estoque
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dados da entrada
  quantidade_comprada DECIMAL(10,2) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  preco_total DECIMAL(10,2) NOT NULL,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  
  -- Dados antes e depois para auditoria
  estoque_unidades_antes DECIMAL(10,2) NOT NULL,
  estoque_total_antes DECIMAL(10,2) NOT NULL,
  preco_medio_antes DECIMAL(10,2),
  
  estoque_unidades_depois DECIMAL(10,2) NOT NULL,
  estoque_total_depois DECIMAL(10,2) NOT NULL,
  preco_medio_depois DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

-- Política RLS: usuários podem ver apenas suas próprias entradas
DROP POLICY IF EXISTS "Users can view their own stock entries" ON public.stock_entries;
CREATE POLICY "Users can view their own stock entries"
ON public.stock_entries
FOR SELECT
USING (auth.uid() = user_id);

-- Política RLS: usuários podem inserir suas próprias entradas
DROP POLICY IF EXISTS "Users can insert their own stock entries" ON public.stock_entries;
CREATE POLICY "Users can insert their own stock entries"
ON public.stock_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_entries_product_id ON public.stock_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_user_id ON public.stock_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_data_compra ON public.stock_entries(data_compra DESC);

-- Comentários
COMMENT ON TABLE public.stock_entries IS 'Histórico completo de todas as entradas de estoque com cálculo de preço médio';
COMMENT ON COLUMN public.stock_entries.preco_medio_antes IS 'Preço médio antes desta entrada';
COMMENT ON COLUMN public.stock_entries.preco_medio_depois IS 'Preço médio depois desta entrada (calculado)';

-- 3. Criar função para calcular preço médio
CREATE OR REPLACE FUNCTION public.calculate_average_price(
  estoque_atual DECIMAL,
  preco_medio_atual DECIMAL,
  quantidade_nova DECIMAL,
  preco_novo DECIMAL
) RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Fórmula: ((estoque_atual × preço_médio_atual) + (quantidade_nova × preço_novo)) ÷ (estoque_atual + quantidade_nova)
  IF (estoque_atual + quantidade_nova) > 0 THEN
    RETURN ((estoque_atual * COALESCE(preco_medio_atual, 0)) + (quantidade_nova * preco_novo)) / (estoque_atual + quantidade_nova);
  ELSE
    RETURN preco_novo;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_average_price IS 
'Calcula o preço médio ponderado: ((estoque_atual × preço_médio_atual) + (quantidade_nova × preço_novo)) ÷ (estoque_atual + quantidade_nova)';

-- 4. Criar função para atualizar estoque_total automaticamente
CREATE OR REPLACE FUNCTION public.update_estoque_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calcular estoque_total baseado em estoque_unidades e quantity_per_unit
  IF NEW.unit = 'unidade' OR NEW.quantity_per_unit IS NULL OR NEW.quantity_per_unit = 0 THEN
    NEW.estoque_total := NEW.estoque_unidades;
  ELSE
    NEW.estoque_total := NEW.estoque_unidades * NEW.quantity_per_unit;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar estoque_total automaticamente
DROP TRIGGER IF EXISTS update_estoque_total_trigger ON public.products;
CREATE TRIGGER update_estoque_total_trigger
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_estoque_total();

COMMENT ON FUNCTION public.update_estoque_total() IS 
'Atualiza estoque_total automaticamente quando estoque_unidades ou quantity_per_unit são alterados';

-- 5. Atualizar campos existentes para garantir consistência
UPDATE public.products
SET 
  estoque_total = CASE 
    WHEN unit = 'unidade' OR quantity_per_unit IS NULL OR quantity_per_unit = 0 THEN estoque_unidades
    ELSE estoque_unidades * quantity_per_unit
  END
WHERE estoque_total IS NULL OR estoque_total != (
  CASE 
    WHEN unit = 'unidade' OR quantity_per_unit IS NULL OR quantity_per_unit = 0 THEN estoque_unidades
    ELSE estoque_unidades * quantity_per_unit
  END
);

