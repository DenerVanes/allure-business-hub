-- CRM de Vendas para Admin
-- Tabela principal de leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados básicos
  salon_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  neighborhood TEXT,
  instagram TEXT,
  -- Pipeline
  status TEXT NOT NULL DEFAULT 'novo_lead' CHECK (status IN (
    'novo_lead', 
    'contato_realizado', 
    'aguardando_resposta', 
    'interesse_medio', 
    'interesse_alto', 
    'fechado', 
    'perdido'
  )),
  heat_score INTEGER DEFAULT 0 CHECK (heat_score >= 0 AND heat_score <= 100),
  origin TEXT CHECK (origin IS NULL OR origin IN (
    'instagram', 
    'whatsapp', 
    'indicacao', 
    'trafego_pago', 
    'site', 
    'google',
    'outro'
  )),
  -- Datas
  first_contact_date DATE,
  last_contact_at TIMESTAMPTZ DEFAULT now(),
  next_action_at TIMESTAMPTZ,
  next_action_description TEXT,
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem acessar leads
CREATE POLICY "Admins can manage leads" ON public.leads
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Índices para performance
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_heat_score ON public.leads(heat_score);
CREATE INDEX idx_leads_last_contact ON public.leads(last_contact_at);
CREATE INDEX idx_leads_city ON public.leads(city);

-- Tabela de notas/histórico de conversas
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'message' CHECK (note_type IN ('message', 'objection', 'action', 'status_change', 'call', 'meeting')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem acessar notas
CREATE POLICY "Admins can manage lead notes" ON public.lead_notes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_notes.lead_id
  ) AND has_role(auth.uid(), 'admin')
);

-- Índice para buscar notas por lead
CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes(lead_id);

-- Tabela de tarefas/lembretes
CREATE TABLE public.lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem acessar tarefas
CREATE POLICY "Admins can manage lead tasks" ON public.lead_tasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_tasks.lead_id
  ) AND has_role(auth.uid(), 'admin')
);

-- Índices para performance
CREATE INDEX idx_lead_tasks_lead_id ON public.lead_tasks(lead_id);
CREATE INDEX idx_lead_tasks_due_date ON public.lead_tasks(due_date);
CREATE INDEX idx_lead_tasks_completed ON public.lead_tasks(completed);

-- Trigger para atualizar updated_at em leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar last_contact_at quando uma nota é adicionada
CREATE OR REPLACE FUNCTION public.update_lead_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads 
  SET last_contact_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_lead_contact_on_note
  AFTER INSERT ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_last_contact();