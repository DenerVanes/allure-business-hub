-- Add foreign key relationship between appointments and collaborators
ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_collaborator
FOREIGN KEY (collaborator_id)
REFERENCES collaborators(id)
ON DELETE SET NULL;