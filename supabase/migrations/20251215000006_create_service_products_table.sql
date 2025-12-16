-- Criar tabela de vínculo entre produtos e serviços
-- Define o consumo de cada produto por serviço

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
CREATE POLICY "Users can manage their own service products"
ON public.service_products
FOR ALL
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_products_product_id ON public.service_products(product_id);
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON public.service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_user_id ON public.service_products(user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_service_products_updated_at
  BEFORE UPDATE ON public.service_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.service_products IS 'Vínculo entre produtos e serviços com configuração de consumo';
COMMENT ON COLUMN public.service_products.consumption_type IS 'Tipo: per_client (quantidade por cliente) ou yield (rendimento em clientes)';
COMMENT ON COLUMN public.service_products.consumption_per_client IS 'Quantidade usada por cliente (ex: 10g, 50ml)';
COMMENT ON COLUMN public.service_products.yield_clients IS 'Quantos clientes o produto rende (ex: 50 clientes)';

