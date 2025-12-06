# Instruções para Criar a Tabela collaborator_schedules

## Problema
O erro "relation 'public.collaborator_schedules' does not exist" ocorre porque a tabela não foi criada no banco de dados.

## Solução

### Opção 1: Executar o Script SQL (Recomendado)

1. Acesse o **Supabase Dashboard** (https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (no menu lateral)
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo `CREATE_COLLABORATOR_SCHEDULES_TABLE.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)

### Opção 2: Executar via Supabase CLI

Se você tem o Supabase CLI instalado:

```bash
supabase db push
```

Isso executará todas as migrations pendentes, incluindo a que cria a tabela `collaborator_schedules`.

### Opção 3: Executar Migration Manualmente

Se preferir executar apenas a migration específica:

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `supabase/migrations/20251205195343_add_collaborator_schedules.sql`
4. Copie e cole o conteúdo no SQL Editor
5. Execute o script

## Verificação

Após executar o script, você pode verificar se a tabela foi criada:

```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'collaborator_schedules';
```

Se retornar uma linha, a tabela foi criada com sucesso!

## Próximos Passos

Após criar a tabela, tente atualizar o colaborador novamente. O erro deve desaparecer.


