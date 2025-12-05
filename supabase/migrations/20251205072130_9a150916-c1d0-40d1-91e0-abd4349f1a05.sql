-- Create board_status enum
CREATE TYPE board_status AS ENUM ('hearing', 'passover', 'lunch', 'adjourned');

-- Create lawyer_aliases table for name matching
CREATE TABLE public.lawyer_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    alias_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on lawyer_aliases
ALTER TABLE public.lawyer_aliases ENABLE ROW LEVEL SECURITY;

-- Users can manage their own aliases
CREATE POLICY "Users can view own aliases" ON public.lawyer_aliases
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own aliases" ON public.lawyer_aliases
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own aliases" ON public.lawyer_aliases
    FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete own aliases" ON public.lawyer_aliases
    FOR DELETE USING (auth.uid() = profile_id);

-- Add new columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bar_registration_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bench TEXT CHECK (bench IN ('JAIPUR', 'JODHPUR'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Enable realtime for lawyer_aliases
ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyer_aliases;