-- Enable read access for public booking pages

-- Allow anyone to view profiles that have public booking enabled
CREATE POLICY "Public booking can view enabled profiles"
ON public.profiles
FOR SELECT
USING (
  agendamento_online_ativo = true
    OR auth.uid() = user_id
);

-- Allow anyone to view services that belong to enabled profiles
CREATE POLICY "Public booking can view services from enabled profiles"
ON public.services
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = services.user_id
      AND profiles.agendamento_online_ativo = true
  )
  OR auth.uid() = services.user_id
);

-- Allow anyone to view collaborators that belong to enabled profiles
CREATE POLICY "Public booking can view collaborators from enabled profiles"
ON public.collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = collaborators.user_id
      AND profiles.agendamento_online_ativo = true
  )
  OR auth.uid() = collaborators.user_id
);

-- Allow anyone to view appointments for availability checks when the profile is enabled
CREATE POLICY "Public booking can view appointments for enabled profiles"
ON public.appointments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = appointments.user_id
      AND profiles.agendamento_online_ativo = true
  )
  OR auth.uid() = appointments.user_id
);

-- Allow public users to create appointments tied to enabled profiles
CREATE POLICY "Public booking can create appointments for enabled profiles"
ON public.appointments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = appointments.user_id
      AND profiles.agendamento_online_ativo = true
  )
  OR auth.uid() = appointments.user_id
);

-- Allow anyone to view collaborator blocks for collaborators that belong to enabled profiles
CREATE POLICY "Public booking can view collaborator blocks for enabled profiles"
ON public.collaborator_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.collaborators
    JOIN public.profiles ON profiles.user_id = collaborators.user_id
    WHERE collaborators.id = collaborator_blocks.collaborator_id
      AND profiles.agendamento_online_ativo = true
  )
);

