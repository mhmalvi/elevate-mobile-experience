-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for job photos
CREATE POLICY "Users can upload job photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view job photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'job-photos');

CREATE POLICY "Users can delete their job photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);