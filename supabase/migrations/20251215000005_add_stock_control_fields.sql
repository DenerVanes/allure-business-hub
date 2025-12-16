-- Adicionar campos de controle de estoque inteligente na tabela products
-- Unidade de medida, tipo de controle e quantidade total

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit TEXT CHECK (unit IN ('g', 'ml', 'unidade')) DEFAULT 'unidade';

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS control_type TEXT CHECK (control_type IN ('consumo', 'unidade')) DEFAULT 'unidade';

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS total_quantity DECIMAL(10,2);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS auto_deduct BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.products.unit IS 'Unidade de medida: g (gramas), ml (mililitros) ou unidade';
COMMENT ON COLUMN public.products.control_type IS 'Tipo de controle: consumo (para produtos como shampoo, tintura) ou unidade (para luvas, toalhas)';
COMMENT ON COLUMN public.products.total_quantity IS 'Quantidade total comprada do produto (ex: 500g, 1000ml, 10 unidades)';
COMMENT ON COLUMN public.products.auto_deduct IS 'Se true, baixa automática quando serviço é finalizado. Se false, baixa manual';

-- Atualizar total_quantity com o valor atual de quantity para produtos existentes
UPDATE public.products 
SET total_quantity = quantity::DECIMAL(10,2)
WHERE total_quantity IS NULL;

