-- Função para fazer baixa automática de estoque quando agendamento é finalizado
-- Esta função será chamada pelo trigger de finalização de agendamento

CREATE OR REPLACE FUNCTION public.deduct_stock_on_appointment_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_record RECORD;
  product_record RECORD;
  consumption_amount DECIMAL(10,2);
  current_stock DECIMAL(10,2);
  new_stock DECIMAL(10,2);
  product_unit TEXT;
BEGIN
  -- Só processar se o status mudou para 'finalizado'
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Buscar todos os serviços do agendamento
    -- Primeiro verificar se é um agendamento com service_id direto (formato antigo)
    IF NEW.service_id IS NOT NULL THEN
      -- Processar serviço único
      FOR product_record IN
        SELECT 
          sp.id,
          sp.product_id,
          sp.consumption_type,
          sp.consumption_per_client,
          sp.yield_clients,
          p.quantity as current_quantity,
          p.total_quantity,
          p.unit,
          p.auto_deduct,
          p.name as product_name,
          s.name as service_name
        FROM public.service_products sp
        INNER JOIN public.products p ON p.id = sp.product_id
        INNER JOIN public.services s ON s.id = sp.service_id
        WHERE sp.service_id = NEW.service_id
          AND sp.user_id = NEW.user_id
          AND p.auto_deduct = true
      LOOP
        -- Calcular consumo
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := product_record.consumption_per_client;
        ELSIF product_record.consumption_type = 'yield' AND product_record.total_quantity IS NOT NULL AND product_record.yield_clients > 0 THEN
          -- Calcular: quantidade total / número de clientes
          consumption_amount := product_record.total_quantity / product_record.yield_clients;
        ELSE
          -- Se não tem dados suficientes, pular este produto
          CONTINUE;
        END IF;
        
        -- Verificar se tem estoque suficiente
        current_stock := product_record.current_quantity;
        IF current_stock < consumption_amount THEN
          -- Log de aviso (não bloquear a finalização, apenas avisar)
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque
        new_stock := current_stock - consumption_amount;
        
        -- Atualizar estoque do produto
        UPDATE public.products
        SET quantity = new_stock,
            updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Registrar movimentação no histórico
        INSERT INTO public.stock_movements (
          product_id,
          user_id,
          appointment_id,
          service_id,
          movement_type,
          quantity,
          client_name,
          service_name,
          description,
          stock_before,
          stock_after
        )
        VALUES (
          product_record.product_id,
          NEW.user_id,
          NEW.id,
          NEW.service_id,
          'auto',
          -consumption_amount, -- Negativo porque é saída
          NEW.client_name,
          product_record.service_name,
          'Baixa automática - ' || product_record.service_name || ' - ' || NEW.client_name,
          current_stock,
          new_stock
        );
      END LOOP;
    END IF;
    
    -- Também processar serviços vinculados via appointment_services (formato novo com múltiplos serviços)
    FOR service_record IN
      SELECT DISTINCT s.id, s.name
      FROM public.appointment_services aps
      INNER JOIN public.services s ON s.id = aps.service_id
      WHERE aps.appointment_id = NEW.id
    LOOP
      -- Para cada serviço do agendamento, processar produtos vinculados
      FOR product_record IN
        SELECT 
          sp.id,
          sp.product_id,
          sp.consumption_type,
          sp.consumption_per_client,
          sp.yield_clients,
          p.quantity as current_quantity,
          p.total_quantity,
          p.unit,
          p.auto_deduct,
          p.name as product_name,
          s.name as service_name
        FROM public.service_products sp
        INNER JOIN public.products p ON p.id = sp.product_id
        INNER JOIN public.services s ON s.id = sp.service_id
        WHERE sp.service_id = service_record.id
          AND sp.user_id = NEW.user_id
          AND p.auto_deduct = true
      LOOP
        -- Calcular consumo
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := product_record.consumption_per_client;
        ELSIF product_record.consumption_type = 'yield' AND product_record.total_quantity IS NOT NULL AND product_record.yield_clients > 0 THEN
          consumption_amount := product_record.total_quantity / product_record.yield_clients;
        ELSE
          CONTINUE;
        END IF;
        
        -- Verificar estoque
        current_stock := product_record.current_quantity;
        IF current_stock < consumption_amount THEN
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque
        new_stock := current_stock - consumption_amount;
        
        -- Atualizar estoque
        UPDATE public.products
        SET quantity = new_stock,
            updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Registrar movimentação
        INSERT INTO public.stock_movements (
          product_id,
          user_id,
          appointment_id,
          service_id,
          movement_type,
          quantity,
          client_name,
          service_name,
          description,
          stock_before,
          stock_after
        )
        VALUES (
          product_record.product_id,
          NEW.user_id,
          NEW.id,
          service_record.id,
          'auto',
          -consumption_amount,
          NEW.client_name,
          product_record.service_name,
          'Baixa automática - ' || product_record.service_name || ' - ' || NEW.client_name,
          current_stock,
          new_stock
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.deduct_stock_on_appointment_finalized() IS 
'Faz baixa automática de estoque quando um agendamento é finalizado, baseado nos produtos vinculados aos serviços realizados';

-- Atualizar o trigger de finalização de agendamento para também chamar esta função
-- Primeiro, vamos modificar a função existente para chamar a função de baixa de estoque
-- Mas na verdade, é melhor criar um trigger separado que roda após o trigger de receita

DROP TRIGGER IF EXISTS deduct_stock_trigger ON appointments;

CREATE TRIGGER deduct_stock_trigger
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado'))
  EXECUTE FUNCTION public.deduct_stock_on_appointment_finalized();

