-- Poin 3: hapus user terhubung undangan sampai bersih.
--
-- admin_revoke_invitation hanya menandai revoked_at; akun yang sudah
-- accept tetap hidup. RPC ini menghapus akun (DELETE auth.users ->
-- trigger tg_handle_auth_user_delete membersihkan profiles/roles/
-- sessions/notifikasi + null-kan FK, sama seperti bulk delete) plus
-- baris undangannya, dengan pengaman yang sama:
--   * perlu izin user.create (42501 bila tidak),
--   * target admin -> tolak (P0001),
--   * target punya votes/kandidatur -> tolak (P0001 + jumlah),
--   * belum diterima siapa pun -> hapus baris undangan saja.
-- Audit: 1 baris invitation.user_delete (tanpa email mentah di metadata).

CREATE OR REPLACE FUNCTION public.admin_delete_invitation_user(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_target   UUID;
  v_is_admin BOOLEAN;
  v_votes    INT;
  v_cand     INT;
BEGIN
  IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create'
      USING ERRCODE = '42501';
  END IF;

  SELECT accepted_user_id INTO v_target
    FROM public.invitations
   WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan'
      USING ERRCODE = 'P0002';
  END IF;

  -- Belum diterima siapa pun: cukup hapus baris undangan.
  IF v_target IS NULL THEN
    DELETE FROM public.invitations WHERE id = p_invitation_id;

    INSERT INTO public.audit_log (
      actor_id, actor_email, actor_role,
      action, category, target_type, target_id,
      description, metadata, severity
    ) VALUES (
      v_uid,
      (SELECT email FROM auth.users WHERE id = v_uid),
      'admin',
      'invitation.user_delete', 'admin', 'invitations', p_invitation_id::TEXT,
      'Deleted unaccepted invitation',
      jsonb_build_object('deleted_user', NULL),
      'warning'
    );

    RETURN jsonb_build_object(
      'deleted_user', NULL,
      'deleted_invitation', p_invitation_id
    );
  END IF;

  -- Pengaman 1: jangan hapus admin.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_target AND role = 'admin'
  ) INTO v_is_admin;
  IF v_is_admin THEN
    RAISE EXCEPTION 'Akun admin tidak dapat dihapus dari sini'
      USING ERRCODE = 'P0001';
  END IF;

  -- Pengaman 2: jangan hapus yang punya jejak pemilu.
  SELECT count(*) INTO v_votes FROM public.votes WHERE voter_id = v_target;
  SELECT count(*) INTO v_cand FROM public.candidates WHERE user_id = v_target;
  IF v_votes > 0 OR v_cand > 0 THEN
    RAISE EXCEPTION 'Pengguna memiliki % suara dan % kandidatur — tidak dapat dihapus',
      v_votes, v_cand
      USING ERRCODE = 'P0001';
  END IF;

  -- Hapus akun: trigger handle_auth_user_delete membersihkan sisanya.
  DELETE FROM auth.users WHERE id = v_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun pengguna tidak ditemukan'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.invitations WHERE id = p_invitation_id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'invitation.user_delete', 'admin', 'invitations', p_invitation_id::TEXT,
    'Deleted invitation user ' || v_target,
    jsonb_build_object('deleted_user', v_target),
    'warning'
  );

  RETURN jsonb_build_object(
    'deleted_user', v_target,
    'deleted_invitation', p_invitation_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_invitation_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_invitation_user(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_delete_invitation_user(UUID) IS
  'Hapus user terhubung undangan + baris undangannya. Tolak admin dan pemilik votes/kandidatur. Audit invitation.user_delete.';
