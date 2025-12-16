-- Criar tabela de histórico de movimentações de estoque
-- Registra todas as baixas automáticas e manuais

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  
  -- Tipo de movimentação
  movement_type TEXT NOT NULL CHECK (movement_type IN ('auto', 'manual', 'entry')) DEFAULT 'auto',
  
  -- Quantidade movimentada (negativa para saída, positiva para entrada)
  quantity DECIMAL(10,2) NOT NULL,
  
  -- Informações adicionais
  client_name TEXT,
  service_name TEXT,
  description TEXT,
  
  -- Estoque antes e depois
  stock_before DECIMAL(10,2) NOT NULL,
  stock_after DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Política RLS: usuários podem ver apenas suas próprias movimentações
CREATE POLICY "Users can view their own stock movements"
ON public.stock_movements
FOR SELECT
USING (auth.uid() = user_id);

-- Política RLS: sistema pode inserir movimentações (via trigger)
CREATE POLICY "System can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_appointment_id ON public.stock_movements(appointment_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- Comentários
COMMENT ON TABLE public.stock_movements IS 'Histórico de todas as movimentações de estoque (entradas, saídas automáticas e manuais)';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Tipo: auto (baixa automática), manual (baixa manual) ou entry (entrada)';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Quantidade movimentada (negativa para saída, positiva para entrada)';

