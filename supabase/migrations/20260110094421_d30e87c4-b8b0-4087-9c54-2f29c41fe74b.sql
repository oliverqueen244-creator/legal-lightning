-- Create storage bucket for judgment PDFs (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS for case-documents bucket
CREATE POLICY "Lawyers can view own case documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tracked_cases 
    WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "System can upload case documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'case-documents');