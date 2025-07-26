
-- Criar bucket para armazenar fotos dos colaboradores
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true);

-- Criar política para permitir que usuários façam upload de suas próprias fotos
CREATE POLICY "Users can upload their own photos" ON storage.objects
FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Criar política para permitir que usuários vejam suas próprias fotos
CREATE POLICY "Users can view their own photos" ON storage.objects
FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Criar política para permitir que usuários atualizem suas próprias fotos
CREATE POLICY "Users can update their own photos" ON storage.objects
FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Criar política para permitir que usuários deletem suas próprias fotos
CREATE POLICY "Users can delete their own photos" ON storage.objects
FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
