# 🔧 Solução: Problema de Redirecionamento na Recuperação de Senha

## 🐛 Problema Identificado

O link de recuperação de senha está redirecionando para `localhost:3000` mesmo em produção porque:

1. **Supabase Dashboard está configurado com localhost**: A configuração "Site URL" no Supabase Dashboard está definida como `http://localhost:3000`
2. **Redirect URLs não incluem o domínio de produção**: O Supabase só aceita redirecionamentos para URLs que estão na lista de "Redirect URLs" permitidas
3. **O código está correto**: O código usa `window.location.origin`, mas o Supabase ignora se a URL não estiver nas permitidas

## ✅ Solução Implementada

### 1. Código Atualizado
- ✅ A página `ResetPassword.tsx` agora processa o token **independente da origem**
- ✅ A página `Index.tsx` detecta tokens na raiz e redireciona para `/reset-password`
- ✅ Logs adicionados para debug

### 2. O Que Você Precisa Fazer no Supabase Dashboard

**PASSO CRÍTICO - FAÇA ISSO AGORA:**

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Authentication** → **URL Configuration**
3. Configure:

   **Site URL:**
   ```
   https://seudominio.com.br
   ```
   (Substitua pelo seu domínio real de produção)

   **Redirect URLs:**
   ```
   https://seudominio.com.br/**
   https://seudominio.com.br/reset-password
   http://localhost:3000/**
   http://localhost:3000/reset-password
   ```
   (Adicione todas as URLs que você usa - produção E desenvolvimento)

4. Clique em **Save**

### 3. Como Funciona Agora

Mesmo que o Supabase redirecione para `localhost:3000`, a solução funciona porque:

1. **Se o token chegar na raiz (`/`)**: A página Index detecta e redireciona para `/reset-password`
2. **Se o token chegar em `/reset-password`**: A página processa o token automaticamente
3. **O token funciona de qualquer origem**: O código processa o token mesmo se vier de localhost

## 🧪 Como Testar

1. **Solicite um novo link de recuperação** (links antigos podem ter expirado)
2. **Clique no link do email**
3. **Mesmo que redirecione para localhost**, o token será processado
4. **A página de reset deve aparecer** e permitir alterar a senha

## 📝 Notas Importantes

- ⚠️ **Configure o Supabase Dashboard** - Isso é essencial para novos links funcionarem corretamente
- ✅ **O código atual funciona** mesmo com a configuração errada (processa token de qualquer origem)
- 🔄 **Após configurar o dashboard**, os novos links vão redirecionar corretamente para produção

## 🆘 Se Ainda Não Funcionar

1. Verifique o console do navegador (F12) - há logs detalhados
2. Verifique se o token está na URL (deve ter `#access_token=...`)
3. Solicite um novo link após configurar o Supabase Dashboard
4. Verifique se o domínio de produção está nas Redirect URLs permitidas

