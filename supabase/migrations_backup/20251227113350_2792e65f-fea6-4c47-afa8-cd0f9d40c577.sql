-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true);

-- RLS policy: Users can view their own logos (and public logos)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');

-- RLS policy: Users can upload their own logos
CREATE POLICY "Users can upload logos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Users can update their own logos
CREATE POLICY "Users can update logos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Users can delete their own logos
CREATE POLICY "Users can delete logos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);