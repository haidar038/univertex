-- Isi ulang antrean harus bisa mengaktifkan kembali baris gagal/bounce.
-- Sebelumnya ON CONFLICT DO NOTHING membuat enqueue selalu 0 setelah batch
-- gagal: baris 'failed' dipertahankan untuk slip fisik, tapi tidak bisa diulang.
-- Baris 'sent' sengaja tidak disentuh agar kredensial tidak dikirim ulang.

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
  ON CONFLICT (event_id, email) DO UPDATE SET
    user_id        = EXCLUDED.user_id,
    full_name      = EXCLUDED.full_name,
    status         = 'pending',
    attempts       = 0,
    error          = NULL,
    sent_at        = NULL,
    provider_msg_id = NULL
  WHERE public.email_queue.status IN ('failed', 'bounced');

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
