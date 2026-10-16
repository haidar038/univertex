-- Hapus event PEMILU yang sudah diarsipkan beserta data anaknya.
--
-- Latar: DELETE langsung dari UI selalu gagal FK 400 bila event punya anak
-- (votes/kandidat/DPT/transisi), dan dialog memang TIDAK boleh hapus event
-- yang punya suara (aturan produk). Pengecualian satu-satunya: status
-- 'archived' + admin + konfirmasi ketik di UI. Audit dipertahankan
-- (audit_log.election_id di-NULL-kan, baris tidak dihapus).

CREATE OR REPLACE FUNCTION public.admin_delete_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_status TEXT;
  v_title  TEXT;
  v_votes  INT;
  v_cand   INT;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete events'
      USING ERRCODE = '42501';
  END IF;

  SELECT status, title INTO v_status, v_title
    FROM public.election_events WHERE id = p_event_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Event tidak ditemukan'
      USING ERRCODE = 'P0001';
  END IF;

  -- Hanya arsip yang boleh dihapus total. Selain itu: arsipkan dulu.
  IF v_status <> 'archived' THEN
    RAISE EXCEPTION 'Hanya event berstatus diarsipkan yang bisa dihapus (status=%). Arsipkan dulu.', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Anak dalam urutan aman FK (semuanya milik event ini saja).
  SELECT count(*) INTO v_votes FROM public.votes WHERE event_id = p_event_id;
  SELECT count(*) INTO v_cand FROM public.candidates WHERE event_id = p_event_id;

  DELETE FROM public.votes WHERE event_id = p_event_id;
  DELETE FROM public.candidate_pair_members
   WHERE pair_id IN (SELECT id FROM public.candidate_pairs WHERE event_id = p_event_id);
  DELETE FROM public.candidate_pairs WHERE event_id = p_event_id;
  DELETE FROM public.candidates WHERE event_id = p_event_id;
  DELETE FROM public.event_voter_groups WHERE event_id = p_event_id;
  DELETE FROM public.election_state_transitions WHERE election_id = p_event_id;
  DELETE FROM public.election_eligibility_rules WHERE election_id = p_event_id;
  DELETE FROM public.election_committees WHERE election_id = p_event_id;
  DELETE FROM public.election_observers WHERE election_id = p_event_id;
  DELETE FROM public.election_observations WHERE election_id = p_event_id;
  DELETE FROM public.invitations WHERE event_id = p_event_id;

  -- Audit dipertahankan: putuskan tautan, jangan hapus baris.
  UPDATE public.audit_log SET election_id = NULL WHERE election_id = p_event_id;

  DELETE FROM public.election_events WHERE id = p_event_id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'event.delete', 'election', 'election_events', p_event_id::TEXT,
    'Deleted archived event "' || v_title || '"',
    jsonb_build_object('event_id', p_event_id, 'votes', v_votes, 'candidates', v_cand),
    'warning'
  );

  RETURN jsonb_build_object('deleted', p_event_id, 'votes', v_votes, 'candidates', v_cand);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_delete_event(UUID) IS
  'Hapus event berstatus archived + anaknya (transaksional). Non-archived ditolak; audit dipertahankan via NULL.';
