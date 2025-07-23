
-- Criar tabela de colaboradores
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para colaboradores
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own collaborators" 
ON public.collaborators 
FOR ALL 
USING (auth.uid() = user_id);

-- Criar tabela para múltiplos serviços por agendamento
CREATE TABLE public.appointment_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  service_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para serviços de agendamento
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage appointment services through appointments" 
ON public.appointment_services 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_services.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

-- Adicionar colunas necessárias nas tabelas existentes
ALTER TABLE public.appointments 
ADD COLUMN collaborator_id UUID,
ADD COLUMN total_amount NUMERIC DEFAULT 0;

ALTER TABLE public.products 
ADD COLUMN category TEXT DEFAULT 'Geral';

-- Trigger para atualizar updated_at nos colaboradores
CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar receita quando agendamento é finalizado (atualizada para múltiplos serviços)
CREATE OR REPLACE FUNCTION public.create_income_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Quando status muda para 'finalizado', criar receita automática
  IF NEW.status = 'finalizado' AND OLD.status != 'finalizado' THEN
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
      NEW.appointment_date,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para a função atualizada
DROP TRIGGER IF EXISTS create_income_on_appointment_finish ON public.appointments;
CREATE TRIGGER create_income_on_appointment_finish
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_income_from_appointment();

-- Função para criar despesa quando produto é cadastrado
CREATE OR REPLACE FUNCTION public.create_expense_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só criar despesa se tem preço de custo e quantidade
  IF NEW.cost_price IS NOT NULL AND NEW.quantity > 0 THEN
    INSERT INTO public.financial_transactions (
      user_id,
      type,
      amount,
      description,
      category,
      transaction_date
    )
    VALUES (
      NEW.user_id,
      'expense',
      NEW.cost_price * NEW.quantity,
      'Compra de produto: ' || NEW.name || ' (Qtd: ' || NEW.quantity || ')',
      'Produtos',
      CURRENT_DATE
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para despesas de produtos
CREATE TRIGGER create_expense_on_product_insert
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_from_product();
