-- Create storage bucket for cause list PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('causelist-pdfs', 'causelist-pdfs', true);

-- RLS policy: Anyone can view causelist PDFs (public bucket)
CREATE POLICY "Public can view causelist PDFs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'causelist-pdfs');

-- RLS policy: Authenticated users can upload causelist PDFs
CREATE POLICY "Authenticated users can upload causelist PDFs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'causelist-pdfs' AND auth.role() = 'authenticated');

-- RLS policy: Service role can upload (for edge functions)
CREATE POLICY "Service role can upload causelist PDFs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'causelist-pdfs');