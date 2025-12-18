-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Grant usage to the service role
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO service_role;