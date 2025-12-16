-- Atualizar descrições antigas de comissões para o novo formato
-- Formato antigo: "Comissão colaborador - Cliente: [Nome]"
-- Formato novo: "Comissão - [Nome do colaborador] | [Nome do serviço] - [Nome do cliente]"

UPDATE public.financial_transactions
SET description = (
  SELECT 
    'Comissão - ' || COALESCE(c.name, 'Colaborador') || 
    ' | ' || COALESCE(s.name, '') || 
    CASE 
      WHEN s.name IS NOT NULL AND a.client_name IS NOT NULL THEN ' - ' || a.client_name
      WHEN a.client_name IS NOT NULL THEN a.client_name
      ELSE ''
    END
  FROM public.appointments a
  LEFT JOIN public.collaborators c ON c.id = a.collaborator_id
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = financial_transactions.appointment_id
)
WHERE category = 'Comissões'
  AND type = 'expense'
  AND description LIKE 'Comissão%colaborador%'
  AND appointment_id IS NOT NULL;

