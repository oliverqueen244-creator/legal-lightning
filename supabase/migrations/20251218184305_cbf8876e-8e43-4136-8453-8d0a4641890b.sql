-- Create a queue table for sequential document processing
CREATE TABLE public.document_processing_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_update_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL,
  file_id text NOT NULL,
  file_name text,
  chat_id bigint NOT NULL,
  bench text NOT NULL,
  list_type text NOT NULL,
  court_no text,
  message_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_telegram_update UNIQUE (telegram_update_id)
);

-- Enable RLS
ALTER TABLE public.document_processing_queue ENABLE ROW LEVEL SECURITY;

-- Policies for service role access (edge functions use service role)
CREATE POLICY "Service role can manage queue"
ON public.document_processing_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for finding next pending document
CREATE INDEX idx_queue_status_created ON public.document_processing_queue (status, created_at);

-- Index for checking if processing is active
CREATE INDEX idx_queue_processing ON public.document_processing_queue (status) WHERE status = 'processing';