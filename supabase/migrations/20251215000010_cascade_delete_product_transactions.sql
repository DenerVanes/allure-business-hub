-- ============================================
-- CASCADE DELETE: Deletar transações financeiras quando produto for deletado
-- ============================================
-- Quando um produto é deletado, todas as transações financeiras relacionadas
-- também devem ser deletadas automaticamente, como se nunca tivessem existido.

-- Remover constraint existente (pode ter nomes diferentes dependendo de como foi criada)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Buscar todas as foreign key constraints relacionadas a product_id
    FOR r IN 
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.financial_transactions'::regclass
          AND contype = 'f'
          AND EXISTS (
              SELECT 1 
              FROM pg_attribute a
              JOIN pg_constraint c ON a.attrelid = c.conrelid
              WHERE a.attname = 'product_id'
                AND c.conname = pg_constraint.conname
                AND a.attnum = ANY(c.conkey)
          )
    LOOP
        EXECUTE format('ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

-- Recriar a constraint com ON DELETE CASCADE
ALTER TABLE public.financial_transactions 
ADD CONSTRAINT financial_transactions_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE CASCADE;

-- Comentário para documentação
COMMENT ON CONSTRAINT financial_transactions_product_id_fkey ON public.financial_transactions IS 
'Quando um produto é deletado, todas as transações financeiras relacionadas são deletadas automaticamente (CASCADE DELETE)';

