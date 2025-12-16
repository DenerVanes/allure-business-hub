-- Corrigir ou deletar transações existentes que foram criadas com valores incorretos
-- O problema: transações foram criadas multiplicando cost_price * quantity (ml) em vez de cost_price * unidades

-- OPÇÃO 1: Deletar transações com formato antigo que têm valores muito altos (provavelmente incorretos)
-- Isso força o sistema a usar apenas transações criadas corretamente pelo frontend

DELETE FROM public.financial_transactions
WHERE type = 'expense'
  AND category = 'Produtos'
  AND description LIKE 'Compra de produto: %'
  AND description LIKE '%(Qtd: %'
  AND amount > 1000  -- Valores muito altos indicam cálculo incorreto
  AND product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = financial_transactions.product_id
      AND p.unit IN ('ml', 'g')
      AND p.quantity_per_unit > 0
  );

-- Isso vai deletar as transações incorretas criadas pelo trigger antigo
-- O sistema agora vai usar apenas as transações criadas corretamente pelo frontend

