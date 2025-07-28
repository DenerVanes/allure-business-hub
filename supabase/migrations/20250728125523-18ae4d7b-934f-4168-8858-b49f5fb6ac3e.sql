
-- Remover categorias duplicadas de "Cabelo", mantendo apenas uma
DELETE FROM public.service_categories 
WHERE name = 'Cabelo' 
AND id NOT IN (
  SELECT MIN(id) 
  FROM public.service_categories 
  WHERE name = 'Cabelo'
  GROUP BY user_id
);

-- Criar um índice único para impedir categorias duplicadas por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_user_name 
ON public.service_categories (user_id, name);
