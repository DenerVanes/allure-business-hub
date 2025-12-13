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

-- Atualizar trigger para marcar transações de produtos como custo variável
CREATE OR REPLACE FUNCTION public.create_expense_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só criar despesa se tem preço de custo e quantidade
  IF NEW.cost_price IS NOT NULL AND NEW.quantity > 0 THEN
    INSERT INTO public.financial_transactions (
      user_id,
      type,
      amount,
      description,
      category,
      transaction_date,
      product_id,
      is_variable_cost
    )
    VALUES (
      NEW.user_id,
      'expense',
      NEW.cost_price * NEW.quantity,
      'Compra de produto: ' || NEW.name || ' (Qtd: ' || NEW.quantity || ')',
      'Produtos',
      CURRENT_DATE,
      NEW.id,
      true -- Marcar como custo variável
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger para despesas de produtos
DROP TRIGGER IF EXISTS create_expense_on_product_insert ON public.products;
CREATE TRIGGER create_expense_on_product_insert
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_from_product();

