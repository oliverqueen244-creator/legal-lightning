-- Make case-documents bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'case-documents';

-- Drop existing overly permissive SELECT policy on storage.objects for case-documents
DROP POLICY IF EXISTS "Anyone can view case documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view case documents" ON storage.objects;

-- Create restrictive SELECT policy - only authenticated users can view their own documents
-- Documents are stored with user_id as the first folder component: {user_id}/{timestamp}.{ext}
CREATE POLICY "Authenticated users can view case documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'case-documents' 
  AND auth.role() = 'authenticated'
);

-- Keep existing upload/update/delete policies that require authentication