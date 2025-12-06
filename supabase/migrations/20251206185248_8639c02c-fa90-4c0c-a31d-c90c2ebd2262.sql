-- Fix search_path for the new function
CREATE OR REPLACE FUNCTION public.update_lead_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads 
  SET last_contact_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;