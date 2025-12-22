-- Políticas de storage para arquivos da Vitrine (bucket 'photos')

-- Permitir upload na pasta presentations/{user_id}/ para usuários autenticados
CREATE POLICY "Users can upload presentation photos to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND name LIKE 'presentations/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Permitir leitura pública das fotos da vitrine
CREATE POLICY "Anyone can view presentation photos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'photos'
  AND name LIKE 'presentations/%'
);

-- Permitir atualização para dono
CREATE POLICY "Users can update presentation photos in their own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND name LIKE 'presentations/%'
  AND split_part(name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'photos'
  AND name LIKE 'presentations/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Permitir deleção para dono
CREATE POLICY "Users can delete presentation photos in their own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND name LIKE 'presentations/%'
  AND split_part(name, '/', 2) = auth.uid()::text
);

