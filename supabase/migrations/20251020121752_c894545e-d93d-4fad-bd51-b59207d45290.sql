-- Corrigir a função que cria receita ao finalizar agendamento
-- Evitar duplicações e usar a data atual

DROP TRIGGER IF EXISTS create_income_trigger ON appointments;

CREATE OR REPLACE FUNCTION public.create_income_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  existing_transaction_id UUID;
BEGIN
  -- Quando status muda para 'finalizado', criar receita automática
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Verificar se já existe uma transação para este agendamento
    SELECT id INTO existing_transaction_id
    FROM public.financial_transactions
    WHERE appointment_id = NEW.id
    LIMIT 1;
    
    -- Só criar se não existir uma transação para este agendamento
    IF existing_transaction_id IS NULL THEN
      INSERT INTO public.financial_transactions (
        user_id,
        type,
        amount,
        description,
        category,
        transaction_date,
        appointment_id
      )
      VALUES (
        NEW.user_id,
        'income',
        NEW.total_amount,
        'Agendamento finalizado - Cliente: ' || NEW.client_name,
        'Serviços',
        CURRENT_DATE, -- Usar data atual em vez da data do agendamento
        NEW.id
      );
    ELSE
      -- Se já existe, apenas atualizar o valor se foi alterado
      UPDATE public.financial_transactions
      SET amount = NEW.total_amount,
          updated_at = now()
      WHERE id = existing_transaction_id
        AND amount != NEW.total_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger
CREATE TRIGGER create_income_trigger
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_income_from_appointment();