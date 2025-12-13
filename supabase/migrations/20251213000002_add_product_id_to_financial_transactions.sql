-- ============================================
-- Adicionar product_id e is_variable_cost à tabela financial_transactions
-- ============================================

-- Adicionar coluna product_id
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Adicionar coluna is_variable_cost (custo variável)
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS is_variable_cost BOOLEAN DEFAULT false;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_product_id ON public.financial_transactions(product_id);

-- Comentários para documentação
COMMENT ON COLUMN public.financial_transactions.product_id IS 'ID do produto relacionado à transação (para custos variáveis)';
COMMENT ON COLUMN public.financial_transactions.is_variable_cost IS 'Indica se esta transação é um custo variável (relacionado a produtos)';

