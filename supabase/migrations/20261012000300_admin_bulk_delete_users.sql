-- P-C: hapus banyak user sekaligus dengan pengaman pemilu.
--
-- Aturan produk (dari 07-users-bulk-delete.md):
--   * Hanya admin (42501 bila bukan).
--   * Admin TIDAK bisa dihapus massal -> skipped_admin.
--   * User yang punya votes/candidacies TIDAK dihapus -> skipped_has_data
--     (suara/kandidatur tidak boleh lenyap diam-diam; hapus manual case-by-case).
--   * Penghapusan via DELETE auth.users agar trigger tg_handle_auth_user_delete
--     (20260910) membersihkan profiles/roles/sessions/notifikasi + null-kan FK.
--   * 1 baris audit user.bulk_delete (ringkasan, tanpa email mentah).

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_users(p_user_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_id       UUID;
  v_is_admin BOOLEAN;
  v_votes    INT;
  v_cand     INT;
  v_deleted  UUID[] := '{}';
  v_sk_admin UUID[] := '{}';
  v_sk_data  JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can bulk delete users'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Daftar user kosong'
      USING ERRCODE = 'P0001';
  END IF;

  -- Batasi 200 id per panggilan agar tidak timeout / lock lama.
  IF array_length(p_user_ids, 1) > 200 THEN
    RAISE EXCEPTION 'Maksimal 200 user per hapus massal'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_id IN ARRAY p_user_ids LOOP
    -- Pengaman 1: jangan hapus admin.
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = v_id AND role = 'admin'
    ) INTO v_is_admin;
    IF v_is_admin THEN
      v_sk_admin := v_sk_admin || v_id;
      CONTINUE;
    END IF;

    -- Pengaman 2: jangan hapus yang punya jejak pemilu.
    SELECT count(*) INTO v_votes FROM public.votes WHERE voter_id = v_id;
    SELECT count(*) INTO v_cand FROM public.candidates WHERE user_id = v_id;
    IF v_votes > 0 OR v_cand > 0 THEN
      v_sk_data := v_sk_data || jsonb_build_object(
        'id', v_id, 'votes', v_votes, 'candidacies', v_cand
      );
      CONTINUE;
    END IF;

    -- Hapus: trigger handle_auth_user_delete membersihkan sisanya.
    DELETE FROM auth.users WHERE id = v_id;
    IF FOUND THEN
      v_deleted := v_deleted || v_id;
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'user.bulk_delete', 'admin', 'auth.users',
    'Bulk deleted ' || array_length(v_deleted, 1) || ' users',
    jsonb_build_object(
      'deleted', COALESCE(array_length(v_deleted, 1), 0),
      'skipped_admin', COALESCE(array_length(v_sk_admin, 1), 0),
      'skipped_has_data', jsonb_array_length(v_sk_data)
    ),
    'warning'
  );

  RETURN jsonb_build_object(
    'deleted', COALESCE(v_deleted, '{}'),
    'skipped_admin', COALESCE(v_sk_admin, '{}'),
    'skipped_has_data', v_sk_data
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_bulk_delete_users(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_users(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_delete_users(UUID[]) IS
  'P-C: hapus massal user (maks 200/panggilan). Lewati admin dan pemilik votes/kandidatur. Audit user.bulk_delete.';
