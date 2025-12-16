-- ============================================
-- SISTEMA DE CONTROLE DE ESTOQUE INTELIGENTE
-- Baixa automática baseada em serviços realizados
-- ============================================

-- ============================================
-- 1. Adicionar campos de controle de estoque na tabela products
-- ============================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit TEXT CHECK (unit IN ('g', 'ml', 'unidade')) DEFAULT 'unidade';

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS control_type TEXT CHECK (control_type IN ('consumo', 'unidade')) DEFAULT 'unidade';

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS total_quantity DECIMAL(10,2);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS quantity_per_unit DECIMAL(10,2);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS auto_deduct BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.products.unit IS 'Unidade de medida: g (gramas), ml (mililitros) ou unidade';
COMMENT ON COLUMN public.products.control_type IS 'Tipo de controle: consumo (para produtos como shampoo, tintura) ou unidade (para luvas, toalhas)';
COMMENT ON COLUMN public.products.total_quantity IS 'Quantidade total comprada do produto (ex: 500g, 1000ml, 10 unidades)';
COMMENT ON COLUMN public.products.quantity_per_unit IS 'Quantidade por unidade (ex: 500ml por frasco, 500g por pacote). Usado para calcular unidades restantes';
COMMENT ON COLUMN public.products.auto_deduct IS 'Se true, baixa automática quando serviço é finalizado. Se false, baixa manual';
COMMENT ON COLUMN public.products.min_quantity IS 'Quantidade mínima em UNIDADES para alerta (ex: 1 unidade, não em ml/g)';

-- Atualizar total_quantity com o valor atual de quantity para produtos existentes
UPDATE public.products 
SET total_quantity = quantity::DECIMAL(10,2)
WHERE total_quantity IS NULL;

-- ============================================
-- 2. Criar tabela de vínculo entre produtos e serviços
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de configuração de consumo
  consumption_type TEXT NOT NULL CHECK (consumption_type IN ('per_client', 'yield')) DEFAULT 'per_client',
  
  -- Opção A: Consumo por cliente (quantidade usada por atendimento)
  consumption_per_client DECIMAL(10,2),
  
  -- Opção B: Rendimento (quantos clientes o produto rende)
  yield_clients INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir que não haja duplicatas
  UNIQUE(product_id, service_id)
);

-- Habilitar RLS
ALTER TABLE public.service_products ENABLE ROW LEVEL SECURITY;

-- Política RLS: usuários podem gerenciar apenas seus próprios vínculos
DROP POLICY IF EXISTS "Users can manage their own service products" ON public.service_products;
CREATE POLICY "Users can manage their own service products"
ON public.service_products
FOR ALL
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_products_product_id ON public.service_products(product_id);
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON public.service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_user_id ON public.service_products(user_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_service_products_updated_at ON public.service_products;
CREATE TRIGGER update_service_products_updated_at
  BEFORE UPDATE ON public.service_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.service_products IS 'Vínculo entre produtos e serviços com configuração de consumo';
COMMENT ON COLUMN public.service_products.consumption_type IS 'Tipo: per_client (quantidade por cliente) ou yield (rendimento em clientes)';
COMMENT ON COLUMN public.service_products.consumption_per_client IS 'Quantidade usada por cliente (ex: 10g, 50ml)';
COMMENT ON COLUMN public.service_products.yield_clients IS 'Quantos clientes o produto rende (ex: 50 clientes)';

-- ============================================
-- 3. Criar tabela de histórico de movimentações de estoque
-- ============================================

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
DROP POLICY IF EXISTS "Users can view their own stock movements" ON public.stock_movements;
CREATE POLICY "Users can view their own stock movements"
ON public.stock_movements
FOR SELECT
USING (auth.uid() = user_id);

-- Política RLS: sistema pode inserir movimentações (via trigger)
DROP POLICY IF EXISTS "System can insert stock movements" ON public.stock_movements;
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

-- ============================================
-- 4. Função para fazer baixa automática de estoque
-- ============================================

CREATE OR REPLACE FUNCTION public.deduct_stock_on_appointment_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_record RECORD;
  product_record RECORD;
  consumption_amount DECIMAL(10,2);
  current_stock DECIMAL(10,2);
  new_stock DECIMAL(10,2);
BEGIN
  -- Só processar se o status mudou para 'finalizado'
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Buscar todos os serviços do agendamento
    -- Primeiro verificar se é um agendamento com service_id direto (formato antigo)
    IF NEW.service_id IS NOT NULL THEN
      -- Processar serviço único
      FOR product_record IN
        SELECT 
          sp.id,
          sp.product_id,
          sp.consumption_type,
          sp.consumption_per_client,
          sp.yield_clients,
          p.quantity as current_quantity,
          p.total_quantity,
          p.unit,
          p.auto_deduct,
          p.name as product_name,
          s.name as service_name
        FROM public.service_products sp
        INNER JOIN public.products p ON p.id = sp.product_id
        INNER JOIN public.services s ON s.id = sp.service_id
        WHERE sp.service_id = NEW.service_id
          AND sp.user_id = NEW.user_id
          AND p.auto_deduct = true
      LOOP
        -- Calcular consumo
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := product_record.consumption_per_client;
        ELSIF product_record.consumption_type = 'yield' AND product_record.total_quantity IS NOT NULL AND product_record.yield_clients > 0 THEN
          -- Calcular: quantidade total / número de clientes
          consumption_amount := product_record.total_quantity / product_record.yield_clients;
        ELSE
          -- Se não tem dados suficientes, pular este produto
          CONTINUE;
        END IF;
        
        -- Verificar se tem estoque suficiente
        current_stock := product_record.current_quantity;
        IF current_stock < consumption_amount THEN
          -- Log de aviso (não bloquear a finalização, apenas avisar)
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque
        new_stock := current_stock - consumption_amount;
        
        -- Atualizar estoque do produto
        UPDATE public.products
        SET quantity = new_stock,
            updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Registrar movimentação no histórico
        INSERT INTO public.stock_movements (
          product_id,
          user_id,
          appointment_id,
          service_id,
          movement_type,
          quantity,
          client_name,
          service_name,
          description,
          stock_before,
          stock_after
        )
        VALUES (
          product_record.product_id,
          NEW.user_id,
          NEW.id,
          NEW.service_id,
          'auto',
          -consumption_amount, -- Negativo porque é saída
          NEW.client_name,
          product_record.service_name,
          'Baixa automática - ' || product_record.service_name || ' - ' || NEW.client_name,
          current_stock,
          new_stock
        );
      END LOOP;
    END IF;
    
    -- Também processar serviços vinculados via appointment_services (formato novo com múltiplos serviços)
    FOR service_record IN
      SELECT DISTINCT s.id, s.name
      FROM public.appointment_services aps
      INNER JOIN public.services s ON s.id = aps.service_id
      WHERE aps.appointment_id = NEW.id
    LOOP
      -- Para cada serviço do agendamento, processar produtos vinculados
      FOR product_record IN
        SELECT 
          sp.id,
          sp.product_id,
          sp.consumption_type,
          sp.consumption_per_client,
          sp.yield_clients,
          p.quantity as current_quantity,
          p.total_quantity,
          p.unit,
          p.auto_deduct,
          p.name as product_name,
          s.name as service_name
        FROM public.service_products sp
        INNER JOIN public.products p ON p.id = sp.product_id
        INNER JOIN public.services s ON s.id = sp.service_id
        WHERE sp.service_id = service_record.id
          AND sp.user_id = NEW.user_id
          AND p.auto_deduct = true
      LOOP
        -- Calcular consumo
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := product_record.consumption_per_client;
        ELSIF product_record.consumption_type = 'yield' AND product_record.total_quantity IS NOT NULL AND product_record.yield_clients > 0 THEN
          consumption_amount := product_record.total_quantity / product_record.yield_clients;
        ELSE
          CONTINUE;
        END IF;
        
        -- Verificar estoque
        current_stock := product_record.current_quantity;
        IF current_stock < consumption_amount THEN
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque
        new_stock := current_stock - consumption_amount;
        
        -- Atualizar estoque
        UPDATE public.products
        SET quantity = new_stock,
            updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Registrar movimentação
        INSERT INTO public.stock_movements (
          product_id,
          user_id,
          appointment_id,
          service_id,
          movement_type,
          quantity,
          client_name,
          service_name,
          description,
          stock_before,
          stock_after
        )
        VALUES (
          product_record.product_id,
          NEW.user_id,
          NEW.id,
          service_record.id,
          'auto',
          -consumption_amount,
          NEW.client_name,
          product_record.service_name,
          'Baixa automática - ' || product_record.service_name || ' - ' || NEW.client_name,
          current_stock,
          new_stock
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.deduct_stock_on_appointment_finalized() IS 
'Faz baixa automática de estoque quando um agendamento é finalizado, baseado nos produtos vinculados aos serviços realizados';

-- Criar trigger
DROP TRIGGER IF EXISTS deduct_stock_trigger ON appointments;

CREATE TRIGGER deduct_stock_trigger
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado'))
  EXECUTE FUNCTION public.deduct_stock_on_appointment_finalized();

-- ============================================
-- FIM DO SCRIPT
-- ============================================

