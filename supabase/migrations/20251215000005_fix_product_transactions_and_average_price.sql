-- Script para corrigir transações de produtos e recalcular preço médio
-- Este script garante que todas as transações de produtos tenham product_id
-- e recalcula o preço médio baseado no histórico real de compras

-- 1. Atualizar transações que não têm product_id mas são de produtos
-- Buscar pela descrição e atualizar com o product_id correspondente
UPDATE public.financial_transactions ft
SET product_id = p.id
FROM public.products p
WHERE ft.product_id IS NULL
  AND ft.type = 'expense'
  AND ft.category = 'Produtos'
  AND (
    ft.description LIKE 'Compra de produto - %' || p.name || '%'
    OR ft.description LIKE 'Compra de produto: %' || p.name || '%'
    OR ft.description ILIKE '%' || p.name || '%'
  )
  AND ft.user_id = p.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft2
    WHERE ft2.product_id = p.id
      AND ft2.id = ft.id
  );

-- 2. Função para recalcular preço médio de um produto baseado nas transações
CREATE OR REPLACE FUNCTION public.recalculate_product_average_price(product_uuid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_invested NUMERIC := 0;
  total_units NUMERIC := 0;
  avg_price NUMERIC := 0;
  transaction_record RECORD;
  product_record RECORD;
  qty_per_unit NUMERIC;
  current_quantity_units NUMERIC;
BEGIN
  -- Buscar dados do produto
  SELECT 
    p.id,
    p.quantity,
    p.quantity_per_unit,
    p.unit,
    p.cost_price
  INTO product_record
  FROM public.products p
  WHERE p.id = product_uuid;
  
  IF product_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calcular quantidade atual em unidades
  IF product_record.unit = 'unidade' THEN
    current_quantity_units := product_record.quantity;
  ELSE
    qty_per_unit := COALESCE(product_record.quantity_per_unit, 1);
    IF qty_per_unit > 0 THEN
      current_quantity_units := product_record.quantity / qty_per_unit;
    ELSE
      current_quantity_units := 0;
    END IF;
  END IF;
  
  -- Buscar todas as transações de compra deste produto
  FOR transaction_record IN
    SELECT 
      amount,
      description,
      created_at
    FROM public.financial_transactions
    WHERE product_id = product_uuid
      AND type = 'expense'
      AND category = 'Produtos'
    ORDER BY created_at ASC
  LOOP
    -- Somar o valor investido
    total_invested := total_invested + COALESCE(transaction_record.amount, 0);
  END LOOP;
  
  -- Se encontrou transações e tem quantidade, calcular média
  IF total_invested > 0 AND current_quantity_units > 0 THEN
    avg_price := total_invested / current_quantity_units;
    
    -- Atualizar o cost_price do produto
    UPDATE public.products
    SET cost_price = avg_price
    WHERE products.id = product_uuid;
    
    RETURN avg_price;
  END IF;
  
  -- Se não encontrou transações, retornar o cost_price atual
  RETURN product_record.cost_price;
END;
$$;

-- 3. Recalcular preço médio para todos os produtos que têm transações
DO $$
DECLARE
  product_record RECORD;
  calculated_price NUMERIC;
BEGIN
  FOR product_record IN
    SELECT DISTINCT p.id
    FROM public.products p
    INNER JOIN public.financial_transactions ft ON ft.product_id = p.id
    WHERE ft.type = 'expense'
      AND ft.category = 'Produtos'
  LOOP
    calculated_price := public.recalculate_product_average_price(product_record.id);
    RAISE NOTICE 'Produto %: Preço médio recalculado = %', product_record.id, calculated_price;
  END LOOP;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.recalculate_product_average_price(UUID) IS 
'Recalcula o preço médio de um produto baseado no histórico real de transações de compra';

