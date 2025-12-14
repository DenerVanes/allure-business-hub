-- ============================================
-- Adicionar campos de contrato e comissão para colaboradores
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Tipo de vínculo (Proprietário, CLT ou PJ/Parceiro)
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN ('Proprietário', 'CLT', 'PJ'));

-- Campos específicos para CLT
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS clt_contract_type TEXT CHECK (clt_contract_type IN ('CLT', 'Estágio', 'Outro'));

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2);

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS work_hours TEXT;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Campos específicos para PJ/Parceiro
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS cnpj TEXT;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS legal_name TEXT;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS pix_key TEXT;

ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS contract_notes TEXT;

-- Modelo de comissão (só para PJ)
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS commission_model TEXT CHECK (commission_model IN ('percentage', 'fixed', NULL));

-- Valor da comissão (percentual ou valor fixo)
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2);

-- Comentários para documentação
COMMENT ON COLUMN public.collaborators.contract_type IS 'Tipo de vínculo: CLT ou PJ';
COMMENT ON COLUMN public.collaborators.clt_contract_type IS 'Tipo de contrato CLT: CLT, Estágio ou Outro';
COMMENT ON COLUMN public.collaborators.salary IS 'Salário fixo mensal (para CLT)';
COMMENT ON COLUMN public.collaborators.work_hours IS 'Carga horária semanal (ex: 44h semanais)';
COMMENT ON COLUMN public.collaborators.start_date IS 'Data de início do contrato (para CLT)';
COMMENT ON COLUMN public.collaborators.internal_notes IS 'Observações internas (para CLT). Colaboradores CLT devem ser tratados como despesa fixa nos relatórios financeiros.';
COMMENT ON COLUMN public.collaborators.company_name IS 'Nome fantasia / Nome do prestador (para PJ)';
COMMENT ON COLUMN public.collaborators.cnpj IS 'CNPJ da empresa (para PJ)';
COMMENT ON COLUMN public.collaborators.legal_name IS 'Razão social (para PJ)';
COMMENT ON COLUMN public.collaborators.pix_key IS 'Chave Pix para repasse (opcional, para PJ)';
COMMENT ON COLUMN public.collaborators.contract_notes IS 'Observações contratuais (para PJ)';
COMMENT ON COLUMN public.collaborators.commission_model IS 'Modelo de comissão: percentage (percentual), fixed (valor fixo) ou NULL';
COMMENT ON COLUMN public.collaborators.commission_value IS 'Valor da comissão (percentual ou valor fixo conforme commission_model). Para percentage: valor entre 0-100. Para fixed: valor em reais.';

