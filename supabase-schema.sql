-- Supabase Database Schema Setup
-- Run this script in your Supabase SQL editor to set up the database schema

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create health_logs table
CREATE TABLE IF NOT EXISTS public.health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    device_id TEXT NOT NULL
);

-- Enable Row Level Security on health_logs table
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can only access their own health logs
CREATE POLICY "Users can only access their own health logs" ON public.health_logs
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Users can insert their own health logs
CREATE POLICY "Users can insert their own health logs" ON public.health_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own health logs
CREATE POLICY "Users can update their own health logs" ON public.health_logs
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own health logs
CREATE POLICY "Users can delete their own health logs" ON public.health_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_logs_user_id ON public.health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_created_at ON public.health_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_health_logs_device_id ON public.health_logs(device_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at column
CREATE TRIGGER handle_health_logs_updated_at
    BEFORE UPDATE ON public.health_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.health_logs TO authenticated;
GRANT SELECT ON public.health_logs TO anon;

-- Optional: Create a view for health log statistics (if needed in the future)
CREATE OR REPLACE VIEW public.user_health_log_stats AS
SELECT 
    user_id,
    COUNT(*) as total_logs,
    MIN(created_at) as first_log_date,
    MAX(created_at) as last_log_date,
    COUNT(DISTINCT device_id) as device_count
FROM public.health_logs
GROUP BY user_id;

-- Grant access to the view
GRANT SELECT ON public.user_health_log_stats TO authenticated;