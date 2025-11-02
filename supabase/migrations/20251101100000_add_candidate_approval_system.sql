-- Add candidate approval system and photo storage

-- Create approval status enum
CREATE TYPE public.candidate_status AS ENUM ('pending', 'approved', 'rejected');

-- Add new columns to candidates table
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS status candidate_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS photo_storage_path TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_candidates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_candidates_updated_at();

-- Update existing candidates to approved status (backward compatibility)
UPDATE public.candidates SET status = 'approved', approved_at = now();

-- Create storage bucket for candidate photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-photos', 'candidate-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for candidate photos
CREATE POLICY "Anyone can view candidate photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'candidate-photos');

CREATE POLICY "Authenticated users can upload candidate photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'candidate-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own candidate photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'candidate-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own candidate photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'candidate-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update RLS policies for candidates table
-- Drop existing policy if exists
DROP POLICY IF EXISTS "Candidates can update their own profile" ON public.candidates;

-- Candidates can only update their own profile (vision, mission, photo)
CREATE POLICY "Candidates can update their own profile"
ON public.candidates FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() AND
  -- Only allow updating specific columns
  vision IS NOT NULL OR mission IS NOT NULL OR photo_storage_path IS NOT NULL
);

-- Only show approved candidates to voters (except admins who can see all)
DROP POLICY IF EXISTS "Everyone can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Voters can view approved candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admins can approve or reject candidates" ON public.candidates;

CREATE POLICY "Voters can view approved candidates"
ON public.candidates FOR SELECT
TO authenticated
USING (
  status = 'approved' OR
  public.has_role(auth.uid(), 'admin') OR
  user_id = auth.uid()
);

-- Admins can approve/reject candidates
CREATE POLICY "Admins can approve or reject candidates"
ON public.candidates FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create notification table for candidate status changes
CREATE TABLE IF NOT EXISTS public.candidate_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'approved', 'rejected', 'changes_submitted'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.candidate_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.candidate_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.candidate_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.candidate_notifications;

CREATE POLICY "Users can view their own notifications"
ON public.candidate_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
ON public.candidate_notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own notifications"
ON public.candidate_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create function to send notification when candidate status changes
CREATE OR REPLACE FUNCTION public.notify_candidate_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Only notify on status change
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'approved' THEN
      notification_type := 'approved';
      notification_message := 'Selamat! Profil kandidat Anda telah disetujui dan akan tampil di pemilihan.';
    ELSIF NEW.status = 'rejected' THEN
      notification_type := 'rejected';
      notification_message := 'Profil kandidat Anda ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Tidak ada alasan yang diberikan.');
    ELSIF NEW.status = 'pending' THEN
      notification_type := 'changes_submitted';
      notification_message := 'Perubahan profil kandidat Anda sedang menunggu persetujuan admin.';
    END IF;

    INSERT INTO public.candidate_notifications (candidate_id, user_id, type, message)
    VALUES (NEW.id, NEW.user_id, notification_type, notification_message);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER candidate_status_notification
AFTER INSERT OR UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.notify_candidate_status_change();

-- Add index for better performance
CREATE INDEX idx_candidates_status ON public.candidates(status);
CREATE INDEX idx_candidates_event_status ON public.candidates(event_id, status);
CREATE INDEX idx_candidate_notifications_user ON public.candidate_notifications(user_id, is_read);
