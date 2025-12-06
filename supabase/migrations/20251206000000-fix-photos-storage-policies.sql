-- Corrigir políticas RLS para o bucket de fotos
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos in their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update photos in their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete photos in their own folder" ON storage.objects;

-- Garantir que o bucket existe (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas corretas para o bucket 'photos'
-- Verificar se o caminho começa com 'collaborators/' e contém o user_id do usuário autenticado
-- Usando uma abordagem mais robusta com split_part para extrair o user_id do caminho

-- Política para INSERT (upload)
CREATE POLICY "Users can upload photos to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' 
  AND name LIKE 'collaborators/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Política para SELECT (visualizar)
CREATE POLICY "Users can view photos in their own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' 
  AND name LIKE 'collaborators/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Política para UPDATE (atualizar)
CREATE POLICY "Users can update photos in their own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND name LIKE 'collaborators/%'
  AND split_part(name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'photos' 
  AND name LIKE 'collaborators/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Política para DELETE (deletar)
CREATE POLICY "Users can delete photos in their own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND name LIKE 'collaborators/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

