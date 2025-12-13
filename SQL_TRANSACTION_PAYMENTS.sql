-- ============================================
-- Criar tabela para pagamentos de transações financeiras
-- ============================================

-- Criar tabela transaction_payments (pagamentos de receitas manuais)
CREATE TABLE IF NOT EXISTS public.transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Valor pago neste método
  fee_amount DECIMAL(10,2) DEFAULT 0.00, -- Taxa calculada
  net_amount DECIMAL(10,2) NOT NULL, -- Valor líquido recebido (amount - fee_amount)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para transaction_payments
-- Usuários podem ver pagamentos de suas próprias transações
DROP POLICY IF EXISTS "Users can view own transaction payments" ON public.transaction_payments;
CREATE POLICY "Users can view own transaction payments"
ON public.transaction_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE financial_transactions.id = transaction_payments.transaction_id
    AND financial_transactions.user_id = auth.uid()
  )
);

-- Usuários podem inserir pagamentos para suas próprias transações
DROP POLICY IF EXISTS "Users can insert own transaction payments" ON public.transaction_payments;
CREATE POLICY "Users can insert own transaction payments"
ON public.transaction_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE financial_transactions.id = transaction_payments.transaction_id
    AND financial_transactions.user_id = auth.uid()
  )
);

-- Usuários podem atualizar pagamentos de suas próprias transações
DROP POLICY IF EXISTS "Users can update own transaction payments" ON public.transaction_payments;
CREATE POLICY "Users can update own transaction payments"
ON public.transaction_payments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE financial_transactions.id = transaction_payments.transaction_id
    AND financial_transactions.user_id = auth.uid()
  )
);

-- Usuários podem deletar pagamentos de suas próprias transações
DROP POLICY IF EXISTS "Users can delete own transaction payments" ON public.transaction_payments;
CREATE POLICY "Users can delete own transaction payments"
ON public.transaction_payments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE financial_transactions.id = transaction_payments.transaction_id
    AND financial_transactions.user_id = auth.uid()
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transaction_payments_transaction_id ON public.transaction_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_payments_payment_method_id ON public.transaction_payments(payment_method_id);

-- Comentários para documentação
COMMENT ON TABLE public.transaction_payments IS 'Pagamentos de transações financeiras (receitas manuais), suporta múltiplos métodos por transação';
COMMENT ON COLUMN public.transaction_payments.amount IS 'Valor pago neste método específico';
COMMENT ON COLUMN public.transaction_payments.fee_amount IS 'Taxa calculada sobre este pagamento';
COMMENT ON COLUMN public.transaction_payments.net_amount IS 'Valor líquido recebido (amount - fee_amount)';

