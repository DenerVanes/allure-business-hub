
-- Add full_name and about columns to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN full_name TEXT,
ADD COLUMN about TEXT;
