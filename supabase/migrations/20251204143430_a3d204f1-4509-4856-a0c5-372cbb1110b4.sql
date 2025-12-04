-- Add status column to live_board_cache
ALTER TABLE public.live_board_cache 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'hearing' 
CHECK (status IN ('hearing', 'passover', 'lunch'));

-- Create document_annotations table for PDF annotations
CREATE TABLE public.document_annotations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid REFERENCES public.case_documents(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    page_number int NOT NULL,
    annotation_type TEXT CHECK (annotation_type IN ('highlight', 'pen', 'text')),
    annotation_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_annotations ENABLE ROW LEVEL SECURITY;

-- Policies for document_annotations
CREATE POLICY "Users can view all annotations"
ON public.document_annotations FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create annotations"
ON public.document_annotations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own annotations"
ON public.document_annotations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
ON public.document_annotations FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for annotation sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotations;