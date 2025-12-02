-- 1. Criar enum para os tipos de role
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Criar tabela de roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Criar função SECURITY DEFINER para verificar roles (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Criar políticas RLS para user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 6. Adicionar admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('2771530d-6e5b-4694-9a61-1d5d466bdc9d', 'admin');

-- 7. Adicionar coluna last_activity_at na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- 8. Criar função para atualizar última atividade
CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_activity_at = now()
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 9. Criar triggers para rastrear atividade
CREATE TRIGGER track_activity_appointments
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

CREATE TRIGGER track_activity_services
AFTER INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

CREATE TRIGGER track_activity_products
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

CREATE TRIGGER track_activity_financial
AFTER INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

CREATE TRIGGER track_activity_collaborators
AFTER INSERT OR UPDATE ON public.collaborators
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

CREATE TRIGGER track_activity_clients
AFTER INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();

-- 10. Criar função RPC para admin buscar todos os profiles
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  business_name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar esta função';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.business_name,
    p.full_name,
    p.phone,
    u.email::TEXT,
    p.created_at,
    COALESCE(p.last_activity_at, p.created_at) as last_activity_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;