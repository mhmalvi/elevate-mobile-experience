# Database Migrations Required

The following features require database updates to function correctly:

1. **Subcontractor Management**
2. **Voice Notes**
3. **Quote Photos**

## Instructions
Please run the following SQL commands in your Supabase Dashboard (SQL Editor) to create the necessary tables and storage buckets.

### 1. Create Subcontractors Table
Source: `supabase/migrations/20260116_create_subcontractors.sql`

```sql
-- Create subcontractors table
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trade TEXT NOT NULL DEFAULT '',
    phone TEXT,
    email TEXT,
    abn TEXT,
    hourly_rate DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subcontractors" ON public.subcontractors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subcontractors" ON public.subcontractors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcontractors" ON public.subcontractors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcontractors" ON public.subcontractors FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subcontractors_user_id ON public.subcontractors(user_id);
GRANT ALL ON public.subcontractors TO authenticated;
```

### 2. Create Storage Buckets
Source: `supabase/migrations/20260116_create_storage_buckets.sql`

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('job-voice-notes', 'job-voice-notes', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('quote-photos', 'quote-photos', true) ON CONFLICT (id) DO NOTHING;

-- RLS for Voice Notes
CREATE POLICY "Authenticated users can upload voice notes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'job-voice-notes');
CREATE POLICY "Public Access to Voice Notes" ON storage.objects FOR SELECT TO public USING (bucket_id = 'job-voice-notes');
CREATE POLICY "Users can delete own voice notes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'job-voice-notes' AND owner = auth.uid());

-- RLS for Quote Photos
CREATE POLICY "Authenticated users can upload quote photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-photos');
CREATE POLICY "Public Access to Quote Photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'quote-photos');
CREATE POLICY "Users can delete own quote photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'quote-photos' AND owner = auth.uid());
```
