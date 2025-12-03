# 🔧 Troubleshooting: Erro 404 em Links Públicos de Agendamento

## ✅ O que foi feito:

1. ✅ Criado `vercel.json` com configuração de rewrites
2. ✅ Criado `public/_redirects` como alternativa
3. ✅ Alterações commitadas e enviadas para o GitHub

## 🔍 Verificações na Vercel:

### 1. Verificar se o Framework está correto

1. Acesse o dashboard da Vercel: [vercel.com/dashboard](https://vercel.com/dashboard)
2. Vá no seu projeto
3. Clique em **Settings** → **General**
4. Verifique se o **Framework Preset** está como **"Vite"**
   - Se não estiver, altere para **"Vite"**
   - Salve as alterações

### 2. Verificar Build Settings

1. Vá em **Settings** → **Build & Development Settings**
2. Verifique se está configurado:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Se estiver diferente, ajuste e salve

### 3. Fazer um Redeploy Manual

1. Vá em **Deployments**
2. Clique nos **3 pontos** (⋯) do último deploy
3. Selecione **"Redeploy"**
4. Aguarde o build completar

### 4. Verificar se o vercel.json está sendo lido

1. Vá em **Deployments**
2. Clique no último deploy
3. Vá na aba **"Build Logs"**
4. Procure por mensagens sobre `vercel.json` ou `_redirects`
5. Se houver erros, anote-os

### 5. Limpar Cache e Fazer Novo Deploy

1. Vá em **Settings** → **Build & Development Settings**
2. Role até **"Environment Variables"**
3. Não precisa alterar nada, apenas verificar
4. Volte em **Deployments**
5. Clique nos **3 pontos** (⋯) do último deploy
6. Selecione **"Redeploy"**
7. Marque a opção **"Use existing Build Cache"** como **DESMARCADA**
8. Clique em **"Redeploy"**

## 🎯 Solução Alternativa: Configuração Manual na Vercel

Se o `vercel.json` não estiver funcionando, você pode configurar manualmente:

### Opção 1: Usar Rewrites no Dashboard

1. Vá em **Settings** → **Functions**
2. Procure por **"Rewrites"** ou **"Redirects"**
3. Adicione:
   - **Source:** `/(.*)`
   - **Destination:** `/index.html`
   - **Status Code:** `200`

### Opção 2: Verificar se o arquivo está no build

1. Vá em **Deployments**
2. Clique no último deploy
3. Vá na aba **"Source"** ou **"Files"**
4. Verifique se o arquivo `vercel.json` está presente na raiz
5. Verifique se o arquivo `public/_redirects` está presente

## 🚨 Se ainda não funcionar:

### Verificar Console do Navegador

1. Abra o DevTools (F12)
2. Vá na aba **Network**
3. Tente acessar o link público novamente
4. Veja qual arquivo está retornando 404
5. Anote o nome do arquivo

### Verificar Build Logs

1. Vá em **Deployments** → último deploy → **Build Logs**
2. Procure por erros relacionados a:
   - `vercel.json`
   - `_redirects`
   - `build`
   - `dist`

### Testar Localmente

1. Execute: `npm run build`
2. Execute: `npm run preview`
3. Acesse: `http://localhost:4173/agendar/lari-studios-fd40553e`
4. Se funcionar localmente, o problema é na Vercel
5. Se não funcionar, o problema pode estar no código

## 📝 Informações para Suporte Vercel

Se precisar abrir um ticket na Vercel, forneça:

1. **URL do projeto:** `agendaris.com.br`
2. **URL que está dando erro:** `agendaris.com.br/agendar/lari-studios-fd40553e`
3. **Framework:** Vite + React
4. **Arquivos de configuração:**
   - `vercel.json` (presente)
   - `public/_redirects` (presente)
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`

## ✅ Checklist Final

- [ ] Framework Preset está como "Vite"
- [ ] Build Command está como `npm run build`
- [ ] Output Directory está como `dist`
- [ ] `vercel.json` está na raiz do projeto
- [ ] `public/_redirects` está presente
- [ ] Foi feito um redeploy após as alterações
- [ ] Cache foi limpo no redeploy
- [ ] Aguardou 2-3 minutos após o deploy

## 🔄 Próximos Passos

1. Aguarde o deploy automático completar (1-2 minutos)
2. Teste o link novamente
3. Se ainda não funcionar, siga o checklist acima
4. Se persistir, pode ser necessário verificar as configurações do domínio na Vercel

---

**Última atualização:** Após push do commit `8215531`

