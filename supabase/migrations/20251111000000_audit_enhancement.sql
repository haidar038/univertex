-- Migration: Fase 3 M3 — Audit enhancement columns + immutability
--
-- 1) Adds request_id, ip_address_hash (hashed for UU PDP compliance),
--    schema_version, and a few indexes.
-- 2) Adds a BEFORE UPDATE trigger that BLOCKS all updates except rows
--    whose action = 'audit.correction' (used by admin_correct_audit_entry
--    below to preserve original_description in metadata).
-- 3) DELETE is intentionally NOT blocked — admin_archive_old_audit_entries
--    (M5) is the sanctioned retention path and needs to remove rows after
--    archiving them. This satisfies immutability for fraud (no silent
--    in-place UPDATE) while letting retention proceed.

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS request_id        UUID,
  ADD COLUMN IF NOT EXISTS ip_address_hash   TEXT,
  ADD COLUMN IF NOT EXISTS original_description TEXT,
  ADD COLUMN IF NOT EXISTS schema_version   TEXT DEFAULT '3';

CREATE INDEX IF NOT EXISTS idx_audit_log_request
  ON public.audit_log(request_id) WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created
  ON public.audit_log(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_election_action
  ON public.audit_log(election_id, action, created_at DESC) WHERE election_id IS NOT NULL;

-- Immutability: block UPDATE unless this is an 'audit.correction' row.
-- The correction RPC writes a fresh audit.correction row that wraps the
-- corrected entry's id in metadata; the trigger allows UPDATEs to those
-- rows so the original_description column can be appended.
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.action = 'audit.correction' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log is immutable; use rpc admin_correct_audit_entry to make corrections'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_log_no_update ON public.audit_log;
CREATE TRIGGER tg_audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_immutable();

-- Admin correction RPC: appends an 'audit.correction' marker that points
-- to the original row. Trigger allows the marker row to be inserted +
-- updated because it satisfies action='audit.correction'. Original
-- description is preserved in metadata for audit trail of corrections.
CREATE OR REPLACE FUNCTION public.admin_correct_audit_entry(
  p_entry_id           UUID,
  p_new_description    TEXT,
  p_correction_reason  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_text TEXT;
  v_correction_id UUID;
BEGIN
  IF NOT public.caller_has_permission('audit.view'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin audit.view'
      USING ERRCODE = '42501';
  END IF;

  SELECT description INTO v_original_text
    FROM public.audit_log
   WHERE id = p_entry_id;

  IF v_original_text IS NULL THEN
    RAISE EXCEPTION 'Audit entry tidak ditemukan'
      USING ERRCODE = 'P0002';
  END IF;

  -- Insert a marker row (action='audit.correction') describing the change.
  -- The BEFORE UPDATE trigger permits updates to rows where
  -- action='audit.correction', so the marker stays editable for any future
  -- bookkeeping. The original entry is NOT touched — its description is
  -- preserved as original_description for forensic completeness.
  INSERT INTO public.audit_log (
    actor_id, action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    auth.uid(),
    'audit.correction',
    'audit',
    'audit_log',
    p_entry_id::TEXT,
    'Correction: ' || COALESCE(p_new_description, ''),
    jsonb_build_object(
      'corrects_entry_id', p_entry_id,
      'original_description', v_original_text,
      'new_description', p_new_description,
      'correction_reason', p_correction_reason,
      'corrected_by', auth.uid(),
      'corrected_at', now()
    ),
    'warning'
  )
  RETURNING id INTO v_correction_id;

  RETURN v_correction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_correct_audit_entry(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_audit_entry(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.audit_log_immutable() IS
  'BEFORE UPDATE trigger. Blocks UPDATE unless action=''audit.correction''. DELETE is intentionally not blocked so admin_archive_old_audit_entries (M5) can archive old rows.';

COMMENT ON FUNCTION public.admin_correct_audit_entry(UUID, TEXT, TEXT) IS
  'Inserts a new audit.correction marker describing the correction; preserves the original entry unchanged. Requires audit.view permission.';

COMMENT ON COLUMN public.audit_log.request_id IS
  'Caller-provided correlation id (UUID). Useful for tracing a single user action across multiple audit rows.';

COMMENT ON COLUMN public.audit_log.ip_address_hash IS
  'SHA-256 of the actor IP (hashed for UU PDP compliance — do not store raw IP here).';

COMMENT ON COLUMN public.audit_log.schema_version IS
  'Schema version of this audit row. Fase 3 = ''3''.';
