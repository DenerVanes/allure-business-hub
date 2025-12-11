# 🪟 Instalação do Supabase CLI no Windows

## ⚠️ Problema
O Supabase CLI não pode ser instalado via `npm install -g` no Windows.

## ✅ Soluções

### Opção 1: Via Scoop (Recomendado - Mais Fácil)

1. **Instalar Scoop** (se não tiver):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

2. **Adicionar bucket do Supabase**:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
```

3. **Instalar Supabase CLI**:
```powershell
scoop install supabase
```

4. **Verificar instalação**:
```powershell
supabase --version
```

---

### Opção 2: Via Chocolatey

1. **Instalar Chocolatey** (se não tiver):
   - Acesse: https://chocolatey.org/install
   - Execute o comando no PowerShell como Administrador

2. **Instalar Supabase CLI**:
```powershell
choco install supabase
```

3. **Verificar instalação**:
```powershell
supabase --version
```

---

### Opção 3: Download Manual (Binário)

1. **Baixar binário**:
   - Acesse: https://github.com/supabase/cli/releases
   - Baixe a versão para Windows (`.exe`)

2. **Adicionar ao PATH**:
   - Extraia o arquivo
   - Adicione a pasta ao PATH do sistema
   - Ou coloque em uma pasta que já está no PATH

---

## 🚀 Após Instalação

### 1. Login
```powershell
supabase login
```
Isso abrirá o navegador para autenticação.

### 2. Vincular Projeto
```powershell
npm run supabase:link
```
Ou:
```powershell
supabase link --project-ref nzllgvbyuxkzlxgtaxhq
```

### 3. Gerar Tipos TypeScript
```powershell
npm run supabase:types
```

---

## 🔄 Alternativa: Gerar Tipos Manualmente

Se não conseguir instalar o CLI, você pode gerar os tipos manualmente:

### Via Dashboard Supabase:

1. Acesse: https://supabase.com/dashboard/project/nzllgvbyuxkzlxgtaxhq
2. Vá em **Settings** → **API**
3. Role até **"Generate TypeScript types"**
4. Copie o código gerado
5. Cole em `src/integrations/supabase/types.ts`

### Ou use a API diretamente:

1. Acesse: https://supabase.com/dashboard/project/nzllgvbyuxkzlxgtaxhq/settings/api
2. Copie a **"service_role" key** (CUIDADO: não compartilhe!)
3. Use um gerador online ou script personalizado

---

## ✅ Verificação

Após instalar, teste:

```powershell
supabase --version
supabase projects list
```

Se funcionar, está tudo certo! 🎉

