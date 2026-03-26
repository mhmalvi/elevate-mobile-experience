-- Sequential quote and invoice number generation
-- Uses a sequences table to track the next number per user

CREATE TABLE IF NOT EXISTS public.document_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'invoice')),
  prefix TEXT NOT NULL DEFAULT '',
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, document_type)
);

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sequences" ON public.document_sequences
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Function to get next document number atomically
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_document_type TEXT,
  p_prefix TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_year TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_year := to_char(now(), 'YYYY');

  -- Default prefixes
  IF p_prefix IS NULL THEN
    IF p_document_type = 'quote' THEN
      v_prefix := 'QT-';
    ELSIF p_document_type = 'invoice' THEN
      v_prefix := 'INV-';
    ELSE
      RAISE EXCEPTION 'Invalid document type: %', p_document_type;
    END IF;
  ELSE
    v_prefix := p_prefix;
  END IF;

  -- Atomically get and increment the next number
  INSERT INTO public.document_sequences (user_id, document_type, prefix, next_number)
  VALUES (v_user_id, p_document_type, v_prefix, 2)
  ON CONFLICT (user_id, document_type)
  DO UPDATE SET
    next_number = document_sequences.next_number + 1,
    updated_at = now()
  RETURNING next_number - 1 INTO v_next_number;

  -- Format: PREFIX-YEAR-NNNN (e.g., QT-2026-0001, INV-2026-0042)
  RETURN v_prefix || v_year || '-' || lpad(v_next_number::TEXT, 4, '0');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_document_number(TEXT, TEXT) TO authenticated;
