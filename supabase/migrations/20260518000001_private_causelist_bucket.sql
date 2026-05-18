-- ============================================================
-- C-5: Make causelist-pdfs bucket private
-- Unauthenticated reads exposed which lawyers were being tracked
-- via filenames. Edge functions use service-role keys so they
-- continue to work; frontend does not consume the public URL.
-- ============================================================

BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'causelist-pdfs';

DROP POLICY IF EXISTS "Public can view causelist PDFs" ON storage.objects;

CREATE POLICY "Authenticated users can view causelist PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'causelist-pdfs' AND auth.role() = 'authenticated');

COMMIT;
