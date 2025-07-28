
-- Alterar a coluna 'notes' para 'observations' na tabela appointments se necessário
-- Ou adicionar a coluna 'notes' se ela não existir
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Garantir que ambas as colunas existam para compatibilidade
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS observations TEXT;
