-- Create table for storing judgment attachments to arguments/cases
CREATE TABLE public.judgment_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES public.daily_court_docket(id) ON DELETE CASCADE,
    argument_id uuid REFERENCES public.case_arguments(id) ON DELETE CASCADE,
    judgment_url text NOT NULL,
    judgment_title text NOT NULL,
    judgment_court text,
    judgment_date text,
    priority_signals text[] DEFAULT '{}',
    user_note text,
    attached_by uuid NOT NULL,
    attached_at timestamp with time zone NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'live-search', -- 'live-search' or 'saved'
    
    -- Audit fields
    search_vector text, -- Which search vector found this
    ranking_score integer, -- Score at time of attachment
    ranking_signals jsonb -- Full signal breakdown for audit
);

-- Enable RLS
ALTER TABLE public.judgment_attachments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view attachments"
ON public.judgment_attachments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert attachments"
ON public.judgment_attachments
FOR INSERT
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can delete own attachments"
ON public.judgment_attachments
FOR DELETE
USING (auth.uid() = attached_by);

-- Index for efficient lookups
CREATE INDEX idx_judgment_attachments_docket ON public.judgment_attachments(docket_id);
CREATE INDEX idx_judgment_attachments_argument ON public.judgment_attachments(argument_id);