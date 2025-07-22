
-- Criar tabela de categorias de serviços
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela service_categories
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_categories
CREATE POLICY "Usuários podem gerenciar apenas suas próprias categorias"
ON public.service_categories 
FOR ALL 
USING (auth.uid() = user_id);

-- Criar tabela de clientes
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clients
CREATE POLICY "Usuários podem gerenciar apenas seus próprios clientes"
ON public.clients 
FOR ALL 
USING (auth.uid() = user_id);

-- Criar tabela de produtos para estoque
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  cost_price DECIMAL(10,2),
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 5,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para products
CREATE POLICY "Usuários podem gerenciar apenas seus próprios produtos"
ON public.products 
FOR ALL 
USING (auth.uid() = user_id);

-- Criar tabela de movimentações financeiras
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para financial_transactions
CREATE POLICY "Usuários podem gerenciar apenas suas próprias transações"
ON public.financial_transactions 
FOR ALL 
USING (auth.uid() = user_id);

-- Atualizar tabela de serviços para incluir categoria personalizada
ALTER TABLE public.services ADD COLUMN category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- Atualizar tabela de agendamentos para incluir referência ao cliente
ALTER TABLE public.appointments ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Criar triggers para atualização automática de timestamps nas novas tabelas
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar receita automaticamente quando agendamento for finalizado
CREATE OR REPLACE FUNCTION public.create_income_from_appointment()
RETURNS TRIGGER AS $$
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
    SELECT 
      NEW.user_id,
      'income',
      s.price,
      'Serviço: ' || s.name || ' - Cliente: ' || NEW.client_name,
      'Serviços',
      NEW.appointment_date,
      NEW.id
    FROM public.services s
    WHERE s.id = NEW.service_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar receita automaticamente
CREATE TRIGGER on_appointment_finalized
  AFTER UPDATE ON public.appointments
  FOR EACH ROW 
  EXECUTE FUNCTION public.create_income_from_appointment();
