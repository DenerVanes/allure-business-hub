# 🗄️ Guia de Integração Supabase + Cursor

Este guia explica como integrar o Supabase com o Cursor para que o AI possa ler o schema do banco e criar migrações automaticamente.

## 📋 Índice

1. [Como Funciona](#como-funciona)
2. [Instalação do Supabase CLI](#instalação-do-supabase-cli)
3. [Configuração Inicial](#configuração-inicial)
4. [Gerar Tipos TypeScript](#gerar-tipos-typescript)
5. [Criar Migrations](#criar-migrations)
6. [Aplicar Migrations](#aplicar-migrations)
7. [Como o AI Lê o Banco](#como-o-ai-lê-o-banco)
8. [Comandos Úteis](#comandos-úteis)

---

## 🎯 Como Funciona

### Como o AI (Cursor) Trabalha com o Banco:

1. **Lê Migrations Existentes**: O AI lê os arquivos SQL em `supabase/migrations/` para entender o schema atual
2. **Lê Tipos TypeScript**: O AI lê `src/integrations/supabase/types.ts` para entender a estrutura das tabelas
3. **Cria Novas Migrations**: Quando você pede mudanças no banco, o AI cria arquivos SQL em `supabase/migrations/`
4. **Você Aplica**: Você executa as migrations no Supabase (via Dashboard ou CLI)

### ⚠️ Importante:
- O AI **NÃO** se conecta diretamente ao banco
- O AI trabalha através de **arquivos de migração SQL**
- Você precisa **aplicar as migrations manualmente** no Supabase

---

## 🛠️ Instalação do Supabase CLI

### Windows (PowerShell):

```powershell
# Opção 1: Via Scoop (recomendado)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Opção 2: Via npm
npm install -g supabase

# Opção 3: Via Chocolatey
choco install supabase
```

### Verificar Instalação:

```powershell
supabase --version
```

---

## ⚙️ Configuração Inicial

### 1. Login no Supabase CLI

```powershell
supabase login
```

Isso abrirá o navegador para autenticação.

### 2. Vincular Projeto Local ao Remoto

```powershell
# No diretório do projeto
supabase link --project-ref nzllgvbyuxkzlxgtaxhq
```

**Onde encontrar o project-ref:**
- Dashboard Supabase → Settings → General → Reference ID
- Ou no arquivo `supabase/config.toml` (já está lá: `nzllgvbyuxkzlxgtaxhq`)

### 3. Verificar Conexão

```powershell
supabase projects list
```

---

## 📝 Gerar Tipos TypeScript

### Por que é importante?
Os tipos TypeScript permitem que o AI entenda a estrutura exata das tabelas, colunas e relacionamentos.

### Gerar Tipos:

```powershell
# Gerar tipos do banco remoto
supabase gen types typescript --project-id nzllgvbyuxkzlxgtaxhq > src/integrations/supabase/types.ts
```

### Ou criar um script no package.json:

```json
{
  "scripts": {
    "supabase:types": "supabase gen types typescript --project-id nzllgvbyuxkzlxgtaxhq > src/integrations/supabase/types.ts"
  }
}
```

Depois execute:
```powershell
npm run supabase:types
```

### ⚠️ Importante:
Execute este comando sempre que:
- Criar uma nova tabela
- Adicionar/modificar colunas
- Criar novas funções RPC
- Fazer mudanças no schema

---

## 📦 Criar Migrations

### Método 1: Via AI (Cursor)

Quando você pedir ao AI para criar/modificar tabelas, ele criará arquivos em `supabase/migrations/`:

```
supabase/migrations/
  └── YYYYMMDDHHMMSS_nome_da_migration.sql
```

**Exemplo:**
```sql
-- supabase/migrations/20251210210000_add_validate_coupon_only.sql
CREATE OR REPLACE FUNCTION public.validate_coupon_only(...)
```

### Método 2: Via CLI (Manual)

```powershell
# Criar uma nova migration vazia
supabase migration new nome_da_migration

# Isso cria: supabase/migrations/YYYYMMDDHHMMSS_nome_da_migration.sql
```

Depois edite o arquivo criado e adicione seu SQL.

---

## 🚀 Aplicar Migrations

### Opção 1: Via Dashboard Supabase (Mais Fácil)

1. Acesse: https://supabase.com/dashboard/project/nzllgvbyuxkzlxgtaxhq
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `.sql` da migration
4. Clique em **Run**

### Opção 2: Via CLI

```powershell
# Aplicar todas as migrations pendentes
supabase db push

# Aplicar uma migration específica (copie o SQL e execute no Dashboard)
```

### ⚠️ Importante:
- **Sempre** revise o SQL antes de executar
- **Teste** em ambiente de desenvolvimento primeiro (se tiver)
- **Backup** do banco antes de migrations importantes

---

## 🔍 Como o AI Lê o Banco

### 1. Lendo Migrations Existentes

O AI usa a ferramenta `read_file` para ler:
```
supabase/migrations/*.sql
```

**Exemplo:**
```typescript
// AI lê este arquivo
read_file('supabase/migrations/20251210205738_add_coupon_system.sql')
```

### 2. Lendo Tipos TypeScript

O AI lê:
```
src/integrations/supabase/types.ts
```

Isso mostra a estrutura exata das tabelas:
```typescript
export type Database = {
  public: {
    Tables: {
      promotions: {
        Row: {
          id: string
          user_id: string
          ativa: boolean
          // ...
        }
      }
    }
  }
}
```

### 3. Buscando no Código

O AI usa `codebase_search` para encontrar:
- Como tabelas são usadas no código
- Relacionamentos entre tabelas
- Funções RPC existentes

---

## 📚 Comandos Úteis

### Verificar Status das Migrations

```powershell
# Ver migrations locais vs remoto
supabase migration list
```

### Resetar Banco Local (Cuidado!)

```powershell
# ⚠️ Isso apaga tudo no banco local
supabase db reset
```

### Ver Diferenças

```powershell
# Ver diferenças entre local e remoto
supabase db diff
```

### Gerar Migration a partir de Mudanças

```powershell
# Se você fez mudanças direto no Dashboard, pode gerar uma migration
supabase db diff -f nome_da_migration
```

---

## 🎯 Fluxo de Trabalho Recomendado

### 1. Pedir Mudança ao AI
```
"Preciso criar uma tabela de cupons com campos X, Y, Z"
```

### 2. AI Cria Migration
- AI cria arquivo em `supabase/migrations/`
- Você revisa o SQL

### 3. Aplicar Migration
- Copie o SQL
- Execute no Dashboard Supabase
- Ou use `supabase db push`

### 4. Atualizar Tipos
```powershell
npm run supabase:types
```

### 5. AI Pode Usar Novos Tipos
- AI agora entende a nova estrutura
- Pode criar queries e componentes usando os novos tipos

---

## 🔐 Variáveis de Ambiente

### Criar arquivo `.env.local` (não commitado):

```env
VITE_SUPABASE_URL=https://nzllgvbyuxkzlxgtaxhq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Atualizar `client.ts` para usar variáveis:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://nzllgvbyuxkzlxgtaxhq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "...";
```

---

## 🐛 Troubleshooting

### Erro: "Project not found"
```powershell
# Re-vincular projeto
supabase link --project-ref nzllgvbyuxkzlxgtaxhq
```

### Erro: "Migration already applied"
- Verifique se a migration já foi executada no Dashboard
- Se sim, marque como aplicada ou ignore

### Tipos desatualizados
```powershell
# Sempre regenere após mudanças no banco
npm run supabase:types
```

---

## 📖 Recursos Adicionais

- [Documentação Supabase CLI](https://supabase.com/docs/reference/cli)
- [Guia de Migrations](https://supabase.com/docs/guides/database/migrations)
- [TypeScript Types](https://supabase.com/docs/reference/cli/supabase-gen-types-typescript)

---

## ✅ Checklist de Setup

- [ ] Supabase CLI instalado
- [ ] Login realizado (`supabase login`)
- [ ] Projeto vinculado (`supabase link`)
- [ ] Tipos TypeScript gerados (`npm run supabase:types`)
- [ ] Script no package.json criado
- [ ] Migrations existentes revisadas

---

**Pronto!** Agora o AI pode ler seu banco e criar migrations automaticamente! 🎉

