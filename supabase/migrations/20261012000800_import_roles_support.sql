-- Perluas admin_import_class_users: dukung roles per baris (sinkronisasi UI).
--
-- Latar: UI BulkImport mengatur role client-side (hapus voter / tambah candidate)
-- sementara RPC batch mengabaikan roles -> dua perilaku beda. Mulai migrasi ini
-- SATU-SATUNYA penentu roles saat import: tiap item boleh bawa
-- roles: "voter" | "voter|candidate" (format CSV, dipisah | atau koma).
-- Selain itu -> entry errors (bukan gagal total). Trigger memberi role voter
-- default; RPC menyesuaikan di atasnya, persis seperti UI lama.
-- Idempotent + audit sama seperti sebelumnya (CREATE OR REPLACE penuh).

CREATE OR REPLACE FUNCTION public.admin_import_class_users(
  p_class_id UUID,
  p_users    JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_item    JSONB;
  v_email   TEXT;
  v_name    TEXT;
  v_sid     TEXT;
  v_pass    TEXT;
  v_dept    TEXT;
  v_roles   TEXT[];
  v_r       TEXT;
  v_new_uid UUID;
  v_created INT := 0;
  v_skipped TEXT[] := '{}';
  v_errors  JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import users'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'Kelas tidak ditemukan'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_users IS NULL OR jsonb_typeof(p_users) <> 'array'
     OR jsonb_array_length(p_users) = 0 THEN
    RAISE EXCEPTION 'Daftar user kosong'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_users) > 200 THEN
    RAISE EXCEPTION 'Maksimal 200 user per import (pecah CSV besar)'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_users) LOOP
    v_email := lower(trim(COALESCE(v_item->>'email', '')));
    v_name  := trim(COALESCE(v_item->>'full_name', ''));
    v_sid   := trim(COALESCE(v_item->>'student_id', ''));
    v_pass  := COALESCE(v_item->>'password', '');
    v_dept  := NULLIF(trim(COALESCE(v_item->>'department', '')), '');

    -- Roles per baris (format CSV "voter|candidate", koma juga diterima).
    SELECT array_agg(DISTINCT trim(both ' ' FROM x))
      INTO v_roles
      FROM unnest(string_to_array(
             replace(COALESCE(v_item->>'roles', 'voter'), ',', '|'), '|'
           )) AS x;

    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'Email tidak valid');
      CONTINUE;
    END IF;
    IF length(v_pass) < 8 THEN
      v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'Password minimal 8 karakter');
      CONTINUE;
    END IF;
    IF v_name = '' OR v_sid = '' THEN
      v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'Nama/NIM wajib diisi');
      CONTINUE;
    END IF;
    IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
      v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'Role tidak boleh kosong');
      CONTINUE;
    END IF;
    FOR v_r IN SELECT unnest(v_roles) LOOP
      IF v_r NOT IN ('voter', 'candidate') THEN
        v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'Role tidak valid: ' || v_r);
        v_roles := NULL;
        EXIT;
      END IF;
    END LOOP;
    IF v_roles IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
      v_skipped := v_skipped || v_email;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE student_id = v_sid) THEN
      v_errors := v_errors || jsonb_build_object('email', v_email, 'error', 'NIM sudah digunakan');
      CONTINUE;
    END IF;

    v_new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_new_uid, 'authenticated', 'authenticated', v_email,
      crypt(v_pass, gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name, 'student_id', v_sid,
                         'department', v_dept, 'class_id', p_class_id::TEXT),
      now(), now(), '', ''
    );

    UPDATE public.profiles
       SET full_name  = v_name,
           student_id = v_sid,
           department = COALESCE(v_dept, department),
           class_id   = p_class_id
     WHERE id = v_new_uid;

    -- Sesuaikan role di atas default voter dari trigger (cermin UI lama).
    IF NOT ('voter' = ANY (v_roles)) THEN
      DELETE FROM public.user_roles WHERE user_id = v_new_uid AND role = 'voter';
    END IF;
    IF 'candidate' = ANY (v_roles) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_new_uid, 'candidate')
      ON CONFLICT DO NOTHING;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'user.bulk_import', 'admin', 'classes', p_class_id::TEXT,
    'Imported ' || v_created || ' users to class',
    jsonb_build_object(
      'class_id', p_class_id,
      'created', v_created,
      'skipped_exists', COALESCE(array_length(v_skipped, 1), 0),
      'errors', jsonb_array_length(v_errors)
    ),
    'info'
  );

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped_exists', COALESCE(v_skipped, '{}'),
    'errors', v_errors
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_import_class_users(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_class_users(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_import_class_users(UUID, JSONB) IS
  'Import batch per kelas incl. roles per baris (voter|candidate). Satu-satunya penentu role saat import; UI loop lama dihapus.';
