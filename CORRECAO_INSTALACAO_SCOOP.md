# 🔧 Correção: Erro ao Instalar Scoop

## ❌ Problema
Você está executando o PowerShell como **Administrador**, mas o Scoop **não deve** ser instalado como admin.

## ✅ Solução

### 1. Feche o PowerShell de Administrador

### 2. Abra um PowerShell Normal
- Pressione `Win + X`
- Clique em **"Windows PowerShell"** (NÃO em "Windows PowerShell (Admin)")
- Ou pesquise "PowerShell" no menu Iniciar e abra a versão normal

### 3. Execute os Comandos Novamente

```powershell
# Definir política de execução
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Instalar Scoop (agora sem ser admin)
irm get.scoop.sh | iex
```

### 4. Verificar Instalação

```powershell
scoop --version
```

### 5. Instalar Supabase CLI

```powershell
# Adicionar bucket do Supabase
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git

# Instalar Supabase CLI
scoop install supabase

# Verificar
supabase --version
```

---

## 📝 Nota Importante

- **Scoop** instala programas na pasta do usuário (`C:\Users\SeuNome\scoop`)
- **Não precisa** de privilégios de administrador
- É mais seguro e fácil de gerenciar

---

## 🚀 Próximos Passos Após Instalar

```powershell
# Login no Supabase
supabase login

# Vincular projeto
cd C:\Users\botel\Downloads\allure-business-hub
npm run supabase:link

# Gerar tipos TypeScript
npm run supabase:types
```

