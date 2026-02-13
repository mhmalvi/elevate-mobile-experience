-- Create storage buckets for voice notes and quote photos

-- Create job-voice-notes bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-voice-notes', 'job-voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Create quote-photos bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-photos', 'quote-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload voice notes
CREATE POLICY "Authenticated users can upload voice notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-voice-notes');

-- Policy: Everyone can view voice notes (public bucket)
CREATE POLICY "Public Access to Voice Notes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-voice-notes');

-- Policy: Authenticated users can delete their own voice notes
CREATE POLICY "Users can delete own voice notes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-voice-notes' AND owner = auth.uid());

-- Policy: Authenticated users can upload quote photos
CREATE POLICY "Authenticated users can upload quote photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-photos');

-- Policy: Public access to quote photos
CREATE POLICY "Public Access to Quote Photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-photos');

-- Policy: Users can delete own quote photos
CREATE POLICY "Users can delete own quote photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quote-photos' AND owner = auth.uid());
