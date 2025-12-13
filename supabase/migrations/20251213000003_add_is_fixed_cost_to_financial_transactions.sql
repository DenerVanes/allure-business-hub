-- ============================================
-- Adicionar is_fixed_cost à tabela financial_transactions
-- ============================================

-- Adicionar coluna is_fixed_cost (custo fixo)
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS is_fixed_cost BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.financial_transactions.is_fixed_cost IS 'Indica se esta transação é um custo fixo (baseado no tipo de custo da categoria)';

