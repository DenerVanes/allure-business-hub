-- Atualizar função para criar receita e despesa de comissão quando agendamento é finalizado
-- A receita será sempre o valor bruto original do serviço (não o valor finalizado com desconto)
-- A despesa de comissão será criada automaticamente se houver colaborador com comissão

DROP TRIGGER IF EXISTS create_income_trigger ON appointments;

CREATE OR REPLACE FUNCTION public.create_income_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  existing_transaction_id UUID;
  service_price NUMERIC;
  service_name TEXT;
  collaborator_name TEXT;
  collaborator_commission_model TEXT;
  collaborator_commission_value NUMERIC;
  commission_amount NUMERIC;
  commission_description TEXT;
BEGIN
  -- Quando status muda para 'finalizado', criar receita automática
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Buscar preço e nome original do serviço
    SELECT price, name INTO service_price, service_name
    FROM public.services
    WHERE id = NEW.service_id;
    
    -- Se não encontrar o serviço, usar total_amount como fallback
    IF service_price IS NULL THEN
      service_price := NEW.total_amount;
    END IF;
    
    -- Verificar se já existe uma transação de receita para este agendamento
    SELECT id INTO existing_transaction_id
    FROM public.financial_transactions
    WHERE appointment_id = NEW.id
      AND type = 'income'
    LIMIT 1;
    
    -- Criar ou atualizar receita com valor bruto original do serviço
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
        service_price, -- Usar preço original do serviço, não o total_amount
        'Agendamento finalizado - Cliente: ' || NEW.client_name,
        'Serviços',
        CURRENT_DATE,
        NEW.id
      );
    ELSE
      -- Se já existe, atualizar o valor se foi alterado
      UPDATE public.financial_transactions
      SET amount = service_price,
          updated_at = now()
      WHERE id = existing_transaction_id
        AND amount != service_price;
    END IF;
    
    -- Criar despesa de comissão se houver colaborador com comissão
    IF NEW.collaborator_id IS NOT NULL THEN
      -- Buscar dados de comissão e nome do colaborador
      SELECT commission_model, commission_value, name
      INTO collaborator_commission_model, collaborator_commission_value, collaborator_name
      FROM public.collaborators
      WHERE id = NEW.collaborator_id;
      
      -- Calcular comissão se houver modelo e valor definidos
      IF collaborator_commission_model IS NOT NULL AND collaborator_commission_value IS NOT NULL THEN
        IF collaborator_commission_model = 'percentage' THEN
          -- Comissão percentual sobre o valor bruto original
          commission_amount := service_price * (collaborator_commission_value / 100);
        ELSIF collaborator_commission_model = 'fixed' THEN
          -- Comissão fixa
          commission_amount := collaborator_commission_value;
        END IF;
        
        -- Verificar se já existe uma transação de comissão para este agendamento
        SELECT id INTO existing_transaction_id
        FROM public.financial_transactions
        WHERE appointment_id = NEW.id
          AND type = 'expense'
          AND category = 'Comissões'
        LIMIT 1;
        
        -- Formatar descrição: "Comissão - [Nome do colaborador] | [Nome do serviço] - [Nome do cliente]"
        -- O formato usa " | " como separador para o frontend poder dividir em principal e secundário
        -- Primeira parte: "Comissão - [Nome do colaborador]" (sempre com o nome real do colaborador)
        IF collaborator_name IS NOT NULL THEN
          commission_description := 'Comissão - ' || collaborator_name;
        ELSE
          commission_description := 'Comissão';
        END IF;
        
        -- Segunda parte: "[Nome do serviço] - [Nome do cliente]" (sempre que possível)
        IF service_name IS NOT NULL AND NEW.client_name IS NOT NULL THEN
          commission_description := commission_description || ' | ' || service_name || ' - ' || NEW.client_name;
        ELSIF service_name IS NOT NULL THEN
          commission_description := commission_description || ' | ' || service_name;
        ELSIF NEW.client_name IS NOT NULL THEN
          commission_description := commission_description || ' | ' || NEW.client_name;
        END IF;
        
        -- Criar ou atualizar despesa de comissão
        IF existing_transaction_id IS NULL THEN
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
            NEW.user_id,
            'expense',
            commission_amount,
            commission_description,
            'Comissões',
            CURRENT_DATE,
            NEW.id,
            true  -- Comissões são sempre custo variável
          );
        ELSE
          -- Se já existe, atualizar o valor, descrição e is_variable_cost se foram alterados
          UPDATE public.financial_transactions
          SET amount = commission_amount,
              description = commission_description,
              category = 'Comissões',
              is_variable_cost = true,
              updated_at = now()
          WHERE id = existing_transaction_id
            AND (amount != commission_amount OR description != commission_description OR category != 'Comissões' OR is_variable_cost != true);
        END IF;
      END IF;
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

