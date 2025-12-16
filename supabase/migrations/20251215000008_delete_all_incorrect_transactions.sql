-- Deletar TODAS as transações incorretas criadas pelo trigger antigo
-- Essas transações têm valores muito altos porque multiplicavam cost_price * quantity (ml) em vez de cost_price * unidades

-- PASSO 1: Deletar todas as transações com formato antigo do trigger
-- Formato antigo: "Compra de produto: [nome] (Qtd: [número])"
DELETE FROM public.financial_transactions
WHERE type = 'expense'
  AND category = 'Produtos'
  AND description LIKE 'Compra de produto: %'
  AND description LIKE '%(Qtd: %';

-- PASSO 2: Deletar transações com valores muito altos para produtos em ml/g
-- Valores acima de R$ 100 para produtos com quantity_per_unit < 1000 geralmente indicam cálculo incorreto
DELETE FROM public.financial_transactions ft
WHERE ft.type = 'expense'
  AND ft.category = 'Produtos'
  AND ft.amount > 100
  AND ft.product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = ft.product_id
      AND p.unit IN ('ml', 'g')
      AND p.quantity_per_unit > 0
      AND p.quantity_per_unit < 1000
  );

-- PASSO 3: Deletar transações específicas com valores conhecidos incorretos
-- R$ 10.000, R$ 5.970, R$ 200 (valores muito altos para compras normais)
DELETE FROM public.financial_transactions
WHERE type = 'expense'
  AND category = 'Produtos'
  AND amount IN (10000, 59700, 200, 10200, 10220)
  AND product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = financial_transactions.product_id
      AND p.name ILIKE '%removedor%'
  );

-- Comentário: Após executar este script, as transações incorretas serão removidas
-- O usuário precisará recriar as entradas de estoque para gerar transações corretas
-- As novas transações serão criadas corretamente pelo frontend ou pelo trigger corrigido

