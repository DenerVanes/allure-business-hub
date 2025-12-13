-- ============================================
-- Criar despesa automática para taxas de maquininha
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Função para criar despesa quando houver taxas de pagamento
CREATE OR REPLACE FUNCTION public.create_expense_for_card_fees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_fees DECIMAL(10,2);
  appointment_user_id UUID;
  appointment_date DATE;
  client_name TEXT;
  payment_method_name TEXT;
  existing_expense_id UUID;
BEGIN
  -- Calcular total de taxas do pagamento
  IF NEW.fee_amount IS NOT NULL AND NEW.fee_amount > 0 THEN
    -- Buscar informações do agendamento
    SELECT 
      a.user_id,
      a.appointment_date,
      a.client_name
    INTO appointment_user_id, appointment_date, client_name
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id;
    
    -- Buscar nome do método de pagamento
    SELECT name INTO payment_method_name
    FROM public.payment_methods
    WHERE id = NEW.payment_method_id;
    
    -- Verificar se já existe uma despesa para este appointment_id e payment_method_id
    SELECT id INTO existing_expense_id
    FROM public.financial_transactions
    WHERE appointment_id = NEW.appointment_id
      AND type = 'expense'
      AND description LIKE '%Taxa da maquininha%'
      AND description LIKE '%' || payment_method_name || '%'
    LIMIT 1;
    
    -- Calcular total de taxas do mesmo método para o mesmo agendamento
    SELECT COALESCE(SUM(fee_amount), 0) INTO total_fees
    FROM public.appointment_payments
    WHERE appointment_id = NEW.appointment_id
      AND payment_method_id = NEW.payment_method_id;
    
    -- Se não existir, criar despesa
    IF existing_expense_id IS NULL THEN
      INSERT INTO public.financial_transactions (
        user_id,
        type,
        amount,
        description,
        category,
        transaction_date,
        appointment_id,
        is_variable_cost
      )
      VALUES (
        appointment_user_id,
        'expense',
        total_fees,
        'Taxa da maquininha' || E'\n' ||
        COALESCE(payment_method_name, 'Cartão') || ' – Agendamento ' || COALESCE(client_name, 'Cliente'),
        'Taxas',
        COALESCE(appointment_date, CURRENT_DATE),
        NEW.appointment_id,
        true
      );
    ELSE
      -- Se já existe, atualizar o valor
      UPDATE public.financial_transactions
      SET amount = total_fees,
          is_variable_cost = true,
          updated_at = now()
      WHERE id = existing_expense_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função após inserir pagamento
DROP TRIGGER IF EXISTS create_expense_for_fees_trigger ON public.appointment_payments;
CREATE TRIGGER create_expense_for_fees_trigger
  AFTER INSERT OR UPDATE ON public.appointment_payments
  FOR EACH ROW
  WHEN (NEW.fee_amount > 0)
  EXECUTE FUNCTION public.create_expense_for_card_fees();

-- Função para recalcular despesas quando um pagamento é deletado
CREATE OR REPLACE FUNCTION public.update_expense_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_fees DECIMAL(10,2);
  appointment_user_id UUID;
  appointment_date DATE;
  client_name TEXT;
  payment_method_name TEXT;
  expense_id UUID;
BEGIN
  -- Buscar informações do agendamento
  SELECT 
    a.user_id,
    a.appointment_date,
    a.client_name
  INTO appointment_user_id, appointment_date, client_name
  FROM public.appointments a
  WHERE a.id = OLD.appointment_id;
  
  -- Buscar nome do método de pagamento
  SELECT name INTO payment_method_name
  FROM public.payment_methods
  WHERE id = OLD.payment_method_id;
  
  -- Buscar despesa relacionada
  SELECT id INTO expense_id
  FROM public.financial_transactions
  WHERE appointment_id = OLD.appointment_id
    AND type = 'expense'
    AND description LIKE '%Taxa da maquininha%'
    AND description LIKE '%' || payment_method_name || '%'
  LIMIT 1;
  
  -- Se encontrou a despesa
  IF expense_id IS NOT NULL THEN
    -- Calcular taxas restantes do mesmo método
    SELECT COALESCE(SUM(fee_amount), 0) INTO remaining_fees
    FROM public.appointment_payments
    WHERE appointment_id = OLD.appointment_id
      AND payment_method_id = OLD.payment_method_id;
    
    -- Se ainda há taxas, atualizar valor. Se não, deletar a despesa
    IF remaining_fees > 0 THEN
      UPDATE public.financial_transactions
      SET amount = remaining_fees,
          is_variable_cost = true,
          updated_at = now()
      WHERE id = expense_id;
    ELSE
      DELETE FROM public.financial_transactions
      WHERE id = expense_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Criar trigger para atualizar/remover despesa quando pagamento é deletado
DROP TRIGGER IF EXISTS update_expense_on_payment_delete_trigger ON public.appointment_payments;
CREATE TRIGGER update_expense_on_payment_delete_trigger
  AFTER DELETE ON public.appointment_payments
  FOR EACH ROW
  WHEN (OLD.fee_amount > 0)
  EXECUTE FUNCTION public.update_expense_on_payment_delete();

-- ============================================
-- FIM DO SCRIPT
-- ============================================

