-- Add admin_notes field for general admin observations during approval process
-- This is separate from rejection_reason which is only for rejected candidates

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.candidates.admin_notes IS 'General notes from admin during approval review (verification checks, observations, etc)';
COMMENT ON COLUMN public.candidates.rejection_reason IS 'Specific reason for rejection (only used when status = rejected)';
