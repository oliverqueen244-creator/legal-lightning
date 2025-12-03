-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', true);

-- Storage policies for case documents
CREATE POLICY "Anyone can view case documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can upload case documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'case-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update case documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete case documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    COALESCE(new.raw_user_meta_data ->> 'role', 'JUNIOR')
  );
  RETURN new;
END;
$$;

-- Trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();