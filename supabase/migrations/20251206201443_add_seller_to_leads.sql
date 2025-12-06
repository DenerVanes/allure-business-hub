-- Adicionar campo seller (vendedor) na tabela leads
ALTER TABLE public.leads 
ADD COLUMN seller TEXT CHECK (seller IS NULL OR seller IN ('Dener Vanes', 'Larissa Botelho'));

-- Criar índice para performance nas buscas por vendedor
CREATE INDEX idx_leads_seller ON public.leads(seller);

