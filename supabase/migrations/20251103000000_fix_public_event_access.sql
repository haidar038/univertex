-- Fix public access to election events on landing page
-- This allows anonymous (not logged in) users to view active events and public results

-- Add policy for anonymous users to view active events and public closed events
CREATE POLICY "Public can view active events and public results"
ON public.election_events FOR SELECT
TO anon
USING (
  status = 'active' OR
  (status = 'closed' AND public_results = true)
);

-- Add comment for documentation
COMMENT ON POLICY "Public can view active events and public results" ON public.election_events
IS 'Allows anonymous users to view active events and closed events with public_results enabled on the landing page';
