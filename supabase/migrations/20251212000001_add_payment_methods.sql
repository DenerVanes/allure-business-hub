-- ============================================
-- Sistema de Formas de Pagamento com Taxas
-- ============================================

-- 1. Criar tabela payment_methods (métodos de pagamento padrão por salão)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Dinheiro', 'Pix', 'Débito', 'Crédito'
  has_fee BOOLEAN NOT NULL DEFAULT false,
  fee_percentage DECIMAL(5,2) DEFAULT 0.00, -- ex: 2.50 para 2.5%
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Evitar duplicatas do mesmo método para o mesmo salão
  CONSTRAINT unique_user_payment_method UNIQUE (user_id, name)
);

-- 2. Criar tabela appointment_payments (pagamentos de cada agendamento)
CREATE TABLE IF NOT EXISTS public.appointment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Valor pago neste método
  fee_amount DECIMAL(10,2) DEFAULT 0.00, -- Taxa calculada
  net_amount DECIMAL(10,2) NOT NULL, -- Valor líquido recebido (amount - fee_amount)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para payment_methods
DROP POLICY IF EXISTS "Users can manage own payment methods" ON public.payment_methods;
CREATE POLICY "Users can manage own payment methods"
ON public.payment_methods
FOR ALL
USING (auth.uid() = user_id);

-- 5. Políticas RLS para appointment_payments
-- Usuários podem ver pagamentos de seus próprios agendamentos
DROP POLICY IF EXISTS "Users can view own appointment payments" ON public.appointment_payments;
CREATE POLICY "Users can view own appointment payments"
ON public.appointment_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = appointment_payments.appointment_id
    AND appointments.user_id = auth.uid()
  )
);

-- Usuários podem inserir pagamentos para seus próprios agendamentos
DROP POLICY IF EXISTS "Users can insert own appointment payments" ON public.appointment_payments;
CREATE POLICY "Users can insert own appointment payments"
ON public.appointment_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = appointment_payments.appointment_id
    AND appointments.user_id = auth.uid()
  )
);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_appointment_id ON public.appointment_payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_payment_method_id ON public.appointment_payments(payment_method_id);

-- 7. Função para inserir métodos de pagamento padrão quando um usuário é criado
CREATE OR REPLACE FUNCTION public.initialize_payment_methods_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir métodos padrão para o novo usuário
  INSERT INTO public.payment_methods (user_id, name, has_fee, fee_percentage, display_order, active)
  VALUES
    (NEW.id, 'Dinheiro', false, 0.00, 1, true),
    (NEW.id, 'Pix', false, 0.00, 2, true),
    (NEW.id, 'Débito', true, 1.50, 3, true), -- Taxa padrão de 1.5%
    (NEW.id, 'Crédito', true, 2.50, 4, true); -- Taxa padrão de 2.5%
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para inicializar métodos de pagamento (será executado manualmente ou via migration para usuários existentes)
-- Não vamos criar trigger automático, mas vamos criar uma função que pode ser chamada

-- 9. Comentários para documentação
COMMENT ON TABLE public.payment_methods IS 'Métodos de pagamento configuráveis por salão, com taxas personalizáveis';
COMMENT ON TABLE public.appointment_payments IS 'Registro de pagamentos de cada agendamento, suporta múltiplos métodos por agendamento';
COMMENT ON COLUMN public.payment_methods.fee_percentage IS 'Percentual de taxa (ex: 2.50 para 2.5%)';
COMMENT ON COLUMN public.appointment_payments.amount IS 'Valor pago neste método específico';
COMMENT ON COLUMN public.appointment_payments.fee_amount IS 'Taxa calculada sobre este pagamento';
COMMENT ON COLUMN public.appointment_payments.net_amount IS 'Valor líquido recebido (amount - fee_amount)';

