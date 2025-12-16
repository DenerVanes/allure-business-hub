-- ============================================
-- Remover trigger que cria transações automaticamente ao inserir produto
-- ============================================
-- O frontend já cria as transações corretamente, considerando apenas a nova compra
-- e não o estoque atual. O trigger estava criando transações duplicadas/incorretas.

-- Remover o trigger
DROP TRIGGER IF EXISTS create_expense_on_product_insert ON public.products;

-- Comentário para documentação
-- A função pode ser mantida para referência, mas não será mais executada automaticamente
-- O frontend (NewProductModal.tsx e StockInModal.tsx) cria as transações manualmente

