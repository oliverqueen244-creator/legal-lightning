-- Enable realtime for case_parse_queue and raw_causelists tables
ALTER TABLE public.case_parse_queue REPLICA IDENTITY FULL;
ALTER TABLE public.raw_causelists REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_parse_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_causelists;