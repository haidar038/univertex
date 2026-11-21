-- Email blast kredensial H-H (panel admin + Edge Function).
-- PIN TIDAK disimpan di sini (dibuat saat kirim + langsung jadi password).
-- Status dilacak agar blast resumable + gagal bisa diekspor ke slip fisik.

CREATE TABLE IF NOT EXISTS public.email_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  full_name    TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'sent', 'bounced', 'failed')),
  attempts     INT NOT NULL DEFAULT 0,
  provider_msg_id TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON public.email_queue(event_id, status);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email queue" ON public.email_queue;
CREATE POLICY "Admins manage email queue"
  ON public.email_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Isi antrean dari DPT event (idempotent, aman diulang).
CREATE OR REPLACE FUNCTION public.admin_enqueue_event_voters(p_event_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_n   INT;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can enqueue voters'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.election_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event tidak ditemukan'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_queue (event_id, user_id, email, full_name)
  SELECT DISTINCT
    p_event_id,
    p.id,
    lower(au.email),
    p.full_name
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  JOIN public.event_voter_groups evg
    ON evg.event_id = p_event_id AND evg.class_id = p.class_id
  JOIN public.user_roles ur
    ON ur.user_id = p.id AND ur.role = 'voter'
  ON CONFLICT (event_id, email) DO NOTHING;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'email.enqueue', 'admin', 'election_events', p_event_id::TEXT,
    'Enqueued voters for credential blast',
    jsonb_build_object('event_id', p_event_id, 'added', v_n),
    'info'
  );

  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_enqueue_event_voters(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_enqueue_event_voters(UUID) TO authenticated;

COMMENT ON TABLE public.email_queue IS
  'Antrean blast PIN kredensial H-H per event. PIN tidak disimpan (dibuat saat kirim). Gagal -> ekspor CSV slip fisik.';
