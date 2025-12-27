-- Add signature_data column to quotes table for e-signature capture
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS signature_data text;