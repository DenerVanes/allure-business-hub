-- Adicionar campo para imagem do rodapé
ALTER TABLE public.salon_presentation
ADD COLUMN IF NOT EXISTS footer_image_url TEXT;

