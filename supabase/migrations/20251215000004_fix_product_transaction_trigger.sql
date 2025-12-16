-- Corrigir trigger para incluir product_id nas transações criadas automaticamente
-- Isso permite calcular o preço médio corretamente baseado no histórico de compras

DROP TRIGGER IF EXISTS create_expense_on_product_insert ON public.products;

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
      product_id  -- IMPORTANTE: Incluir product_id para rastreamento
    )
    VALUES (
      NEW.user_id,
      'expense',
      NEW.cost_price * NEW.quantity,
      'Compra de produto: ' || NEW.name || ' (Qtd: ' || NEW.quantity || ')',
      'Produtos',
      CURRENT_DATE,
      NEW.id  -- Incluir product_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER create_expense_on_product_insert
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_from_product();

-- Atualizar transações existentes que não têm product_id mas são de produtos
-- Buscar pela descrição e atualizar com o product_id correspondente
UPDATE public.financial_transactions ft
SET product_id = p.id
FROM public.products p
WHERE ft.product_id IS NULL
  AND ft.type = 'expense'
  AND ft.category = 'Produtos'
  AND ft.description LIKE 'Compra de produto: %'
  AND ft.description LIKE '%' || p.name || '%'
  AND ft.user_id = p.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft2
    WHERE ft2.product_id = p.id
      AND ft2.id = ft.id
  );

