-- Atualizar todas as transações de comissão para ter is_variable_cost = true e categoria = 'Comissões'
-- Isso garante que todas as comissões (antigas e novas) sejam marcadas como custo variável

UPDATE public.financial_transactions
SET 
  is_variable_cost = true,
  category = 'Comissões'
WHERE 
  type = 'expense'
  AND (
    category = 'Comissões' 
    OR description LIKE 'Comissão%'
    OR description LIKE '%comissão%'
  )
  AND (is_variable_cost IS NULL OR is_variable_cost = false OR category != 'Comissões');

