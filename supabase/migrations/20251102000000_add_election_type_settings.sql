-- Add election type and visibility settings to election_events table

-- Create election type enum
CREATE TYPE public.election_type AS ENUM ('open', 'closed');

-- Add new columns to election_events table
ALTER TABLE public.election_events
ADD COLUMN IF NOT EXISTS election_type election_type NOT NULL DEFAULT 'closed',
ADD COLUMN IF NOT EXISTS show_results_after_voting BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS public_results BOOLEAN NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.election_events.election_type IS 'Type of election: open (results visible real-time) or closed (results only after event ends)';
COMMENT ON COLUMN public.election_events.show_results_after_voting IS 'Whether voters can see results immediately after they vote (only applies when election is still active)';
COMMENT ON COLUMN public.election_events.public_results IS 'Whether results can be viewed without login on public landing page';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_election_events_type_status ON public.election_events(election_type, status);
CREATE INDEX IF NOT EXISTS idx_election_events_public_results ON public.election_events(public_results, status);
