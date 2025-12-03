-- Adicionar campo para rastrear quando o usuário visualizou as notificações pela última vez
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_last_seen_at TIMESTAMPTZ;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.notifications_last_seen_at IS 'Data e hora da última vez que o usuário visualizou as notificações. Usado para determinar quais notificações são novas.';

