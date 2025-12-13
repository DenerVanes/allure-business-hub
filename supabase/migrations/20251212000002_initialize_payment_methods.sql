-- ============================================
-- Inicializar métodos de pagamento para usuários existentes
-- ============================================

-- Função para inicializar métodos de pagamento para um usuário
CREATE OR REPLACE FUNCTION public.initialize_payment_methods_for_existing_users()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Para cada usuário que ainda não tem métodos de pagamento
  FOR user_record IN 
    SELECT DISTINCT u.id
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.payment_methods pm WHERE pm.user_id = u.id
    )
  LOOP
    -- Inserir métodos padrão
    INSERT INTO public.payment_methods (user_id, name, has_fee, fee_percentage, display_order, active)
    VALUES
      (user_record.id, 'Dinheiro', false, 0.00, 1, true),
      (user_record.id, 'Pix', false, 0.00, 2, true),
      (user_record.id, 'Débito', true, 1.50, 3, true),
      (user_record.id, 'Crédito', true, 2.50, 4, true)
    ON CONFLICT (user_id, name) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar a função para inicializar métodos de pagamento
SELECT public.initialize_payment_methods_for_existing_users();

