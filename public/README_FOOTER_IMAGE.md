# Imagem do Rodapé da Vitrine

A imagem do rodapé é fixa e configurável apenas pelo administrador do sistema através do código.

## Como alterar a imagem:

1. Coloque sua imagem na pasta `public/` com o nome `footer-image.jpg`
2. Formato: JPG, PNG ou WEBP
3. Tamanho recomendado: 512x128px (ou 1024x256px para telas retina)
4. Proporção: 4:1 (largura:altura)

## Localização no código:

- **Página pública**: `src/pages/SalonPresentation.tsx` (linha ~168)
- **Preview**: `src/pages/PresentationSettings.tsx` (linha ~676)

Ambos usam o caminho: `/footer-image.jpg`

## Exemplo:

Se você tem uma imagem chamada `minha-imagem.jpg`:
1. Renomeie para `footer-image.jpg`
2. Coloque na pasta `public/`
3. O caminho será: `public/footer-image.jpg`
4. O código automaticamente a usará em `/footer-image.jpg`

## Nota:

Se a imagem não existir, o sistema mostrará automaticamente um placeholder gradiente.

