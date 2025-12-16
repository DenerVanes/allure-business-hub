-- Corrigir trigger para calcular corretamente o valor da transação
-- O problema: o trigger estava multiplicando cost_price * quantity (ml), mas deveria ser cost_price * unidades

DROP TRIGGER IF EXISTS create_expense_on_product_insert ON public.products;

CREATE OR REPLACE FUNCTION public.create_expense_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  quantity_in_units NUMERIC;
  total_amount NUMERIC;
BEGIN
  -- Só criar despesa se tem preço de custo e quantidade
  IF NEW.cost_price IS NOT NULL AND NEW.quantity > 0 THEN
    -- Calcular quantidade em unidades
    IF NEW.unit = 'unidade' OR NEW.quantity_per_unit IS NULL OR NEW.quantity_per_unit = 0 THEN
      -- Para produtos em unidades, usar quantity diretamente
      quantity_in_units := NEW.quantity;
    ELSE
      -- Para ml/g: converter quantidade (ml/g) para unidades (frascos/pacotes)
      quantity_in_units := NEW.quantity / NEW.quantity_per_unit;
    END IF;
    
    -- Calcular valor total: preço unitário × quantidade em unidades
    total_amount := NEW.cost_price * quantity_in_units;
    
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
      total_amount,
      'Compra de produto: ' || NEW.name || ' (Qtd: ' || quantity_in_units || ' ' || 
      CASE 
        WHEN NEW.unit = 'ml' THEN 'frascos'
        WHEN NEW.unit = 'g' THEN 'pacotes'
        ELSE 'un'
      END || ')',
      'Produtos',
      CURRENT_DATE,
      NEW.id,
      true
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

COMMENT ON FUNCTION public.create_expense_from_product() IS 
'Cria transação financeira ao inserir produto, calculando corretamente o valor baseado em unidades';

