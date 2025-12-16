-- Função para criar despesas de salário de colaboradores CLT automaticamente
-- Esta função deve ser executada no primeiro dia de cada mês
-- Pode ser configurada como um cron job no Supabase

CREATE OR REPLACE FUNCTION public.create_monthly_salary_expenses()
RETURNS TABLE(created_count INTEGER, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  collaborator_record RECORD;
  current_month_start DATE;
  existing_transaction_id UUID;
  created_count INTEGER := 0;
  total_amount NUMERIC := 0;
BEGIN
  -- Data do primeiro dia do mês atual
  current_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Loop através de todos os colaboradores CLT ativos com salário cadastrado
  FOR collaborator_record IN
    SELECT 
      id,
      user_id,
      name,
      salary
    FROM public.collaborators
    WHERE contract_type = 'CLT'
      AND active = true
      AND salary IS NOT NULL
      AND salary > 0
  LOOP
    -- Verificar se já existe uma transação de salário para este colaborador neste mês
    SELECT id INTO existing_transaction_id
    FROM public.financial_transactions
    WHERE user_id = collaborator_record.user_id
      AND type = 'expense'
      AND category = 'Salários'
      AND description = 'Salário - ' || collaborator_record.name
      AND transaction_date = current_month_start
    LIMIT 1;
    
    -- Se não existe, criar a despesa
    IF existing_transaction_id IS NULL THEN
      INSERT INTO public.financial_transactions (
        user_id,
        type,
        amount,
        description,
        category,
        transaction_date,
        is_fixed_cost
      )
      VALUES (
        collaborator_record.user_id,
        'expense',
        collaborator_record.salary,
        'Salário - ' || collaborator_record.name,
        'Salários',
        current_month_start,
        true
      );
      
      created_count := created_count + 1;
      total_amount := total_amount + collaborator_record.salary;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT created_count, total_amount;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.create_monthly_salary_expenses() IS 
'Cria despesas de salário para todos os colaboradores CLT ativos no primeiro dia de cada mês. Retorna o número de despesas criadas e o valor total.';

-- Para executar manualmente: SELECT * FROM public.create_monthly_salary_expenses();
-- Para configurar como cron job no Supabase (executar todo dia 01 às 00:00):
-- SELECT cron.schedule('monthly-salary-expenses', '0 0 1 * *', 'SELECT * FROM public.create_monthly_salary_expenses();');

