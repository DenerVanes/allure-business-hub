-- ============================================
-- Corrigir função de baixa automática de estoque
-- ============================================
-- Atualizar para usar os novos campos estoque_unidades, estoque_total
-- e também atualizar esses campos corretamente quando fizer a baixa

CREATE OR REPLACE FUNCTION public.deduct_stock_on_appointment_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_record RECORD;
  product_record RECORD;
  consumption_amount DECIMAL(10,2);
  current_stock_total DECIMAL(10,2);
  new_stock_total DECIMAL(10,2);
  current_stock_units DECIMAL(10,2);
  new_stock_units DECIMAL(10,2);
  quantity_per_unit DECIMAL(10,2);
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
          p.estoque_total as current_estoque_total,
          p.estoque_unidades as current_estoque_unidades,
          p.quantity_per_unit,
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
        -- Obter quantidade por unidade
        quantity_per_unit := COALESCE(product_record.quantity_per_unit, 1);
        
        -- Usar estoque_total (ml/g/unidade) como base
        current_stock_total := COALESCE(product_record.current_estoque_total, 0);
        current_stock_units := COALESCE(product_record.current_estoque_unidades, 0);
        
        -- Calcular consumo em ml/g/unidade
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := COALESCE(product_record.consumption_per_client, 0);
        ELSIF product_record.consumption_type = 'yield' AND product_record.yield_clients > 0 THEN
          -- Para yield, calcular: estoque_total / número de clientes = consumo por cliente
          IF current_stock_total > 0 THEN
            consumption_amount := current_stock_total / product_record.yield_clients;
          ELSE
            -- Se não tem estoque_total, usar quantity_per_unit como estimativa
            IF quantity_per_unit > 0 THEN
              consumption_amount := quantity_per_unit / product_record.yield_clients;
            ELSE
              CONTINUE;
            END IF;
          END IF;
        ELSE
          -- Se não tem dados suficientes, pular este produto
          CONTINUE;
        END IF;
        
        -- Verificar se tem estoque suficiente
        IF current_stock_total < consumption_amount THEN
          -- Log de aviso (não bloquear a finalização, apenas avisar)
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock_total, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque_total (ml/g/unidade)
        new_stock_total := current_stock_total - consumption_amount;
        
        -- Calcular novo estoque_unidades (frascos/pacotes/unidades)
        -- IMPORTANTE: Como o trigger update_estoque_total_trigger recalcula estoque_total,
        -- devemos calcular estoque_unidades de forma que quando o trigger recalcular,
        -- o estoque_total final seja exatamente o valor que queremos
        IF product_record.unit = 'unidade' OR quantity_per_unit <= 0 THEN
          -- Para produtos em unidades, estoque_unidades = estoque_total
          new_stock_units := new_stock_total;
        ELSE
          -- Para ml/g: estoque_unidades = estoque_total / quantity_per_unit
          -- Usar precisão alta para evitar erros de arredondamento
          new_stock_units := ROUND((new_stock_total / quantity_per_unit)::numeric, 4);
        END IF;
        
        -- Atualizar estoque do produto
        -- O trigger update_estoque_total_trigger vai recalcular estoque_total baseado em estoque_unidades
        -- então atualizamos apenas estoque_unidades e deixamos o trigger fazer o trabalho
        UPDATE public.products
        SET 
          estoque_unidades = new_stock_units,
          updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Depois da atualização, obter o estoque_total real (calculado pelo trigger)
        SELECT estoque_total, quantity INTO new_stock_total, new_stock_total
        FROM public.products
        WHERE id = product_record.product_id;
        
        -- Atualizar também o campo quantity para compatibilidade
        UPDATE public.products
        SET quantity = new_stock_total
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
          current_stock_total,
          new_stock_total
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
          p.estoque_total as current_estoque_total,
          p.estoque_unidades as current_estoque_unidades,
          p.quantity_per_unit,
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
        -- Obter quantidade por unidade
        quantity_per_unit := COALESCE(product_record.quantity_per_unit, 1);
        
        -- Usar estoque_total como base
        current_stock_total := COALESCE(product_record.current_estoque_total, 0);
        current_stock_units := COALESCE(product_record.current_estoque_unidades, 0);
        
        -- Calcular consumo
        IF product_record.consumption_type = 'per_client' THEN
          consumption_amount := COALESCE(product_record.consumption_per_client, 0);
        ELSIF product_record.consumption_type = 'yield' AND product_record.yield_clients > 0 THEN
          IF current_stock_total > 0 THEN
            consumption_amount := current_stock_total / product_record.yield_clients;
          ELSE
            IF quantity_per_unit > 0 THEN
              consumption_amount := quantity_per_unit / product_record.yield_clients;
            ELSE
              CONTINUE;
            END IF;
          END IF;
        ELSE
          CONTINUE;
        END IF;
        
        -- Verificar estoque
        IF current_stock_total < consumption_amount THEN
          RAISE WARNING 'Produto % tem estoque insuficiente. Estoque: %, Necessário: %', 
            product_record.product_name, current_stock_total, consumption_amount;
          CONTINUE;
        END IF;
        
        -- Calcular novo estoque
        new_stock_total := current_stock_total - consumption_amount;
        
        -- Calcular novo estoque_unidades
        IF product_record.unit = 'unidade' OR quantity_per_unit <= 0 THEN
          new_stock_units := new_stock_total;
        ELSE
          -- Usar precisão alta para evitar erros de arredondamento
          new_stock_units := ROUND((new_stock_total / quantity_per_unit)::numeric, 4);
        END IF;
        
        -- Atualizar estoque
        -- O trigger update_estoque_total_trigger vai recalcular estoque_total
        UPDATE public.products
        SET 
          estoque_unidades = new_stock_units,
          updated_at = now()
        WHERE id = product_record.product_id;
        
        -- Obter o estoque_total real após o trigger
        SELECT estoque_total INTO new_stock_total
        FROM public.products
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
          current_stock_total,
          new_stock_total
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.deduct_stock_on_appointment_finalized() IS 
'Faz baixa automática de estoque quando um agendamento é finalizado, usando os novos campos estoque_total e estoque_unidades';

-- IMPORTANTE: O trigger update_estoque_total_trigger recalcula estoque_total automaticamente
-- baseado em estoque_unidades * quantity_per_unit, então devemos garantir que estoque_unidades
-- seja calculado corretamente a partir do estoque_total após a baixa

