-- Izinkan pelepasan audit dari event yang dihapus (pola sama seperti actor_id).
--
-- Latar: admin_delete_event me-NULL-kan audit_log.election_id agar baris audit
-- tetap ada setelah event arsip dihapus. Trigger immutability hanya mengizinkan
-- pola NULL-kan actor_id (kasus hapus user) sehingga pelepas election_id
-- meledak P0001 (HTTP 400). Klausa baru mengizinkan UPDATE bila SATU-SATUNYA
-- perubahan adalah election_id: X -> NULL. Mengubah isi audit tetap dilarang.

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow audit.correction rows to be updated (existing behaviour)
  IF OLD.action = 'audit.correction' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Allow the FK ON DELETE SET NULL cascade from auth.users deletion.
  IF NEW.actor_id IS NULL
     AND OLD.actor_id IS NOT NULL
     AND NEW.actor_email        IS NOT DISTINCT FROM OLD.actor_email
     AND NEW.actor_role         IS NOT DISTINCT FROM OLD.actor_role
     AND NEW.action             IS NOT DISTINCT FROM OLD.action
     AND NEW.category           IS NOT DISTINCT FROM OLD.category
     AND NEW.target_type        IS NOT DISTINCT FROM OLD.target_type
     AND NEW.target_id          IS NOT DISTINCT FROM OLD.target_id
     AND NEW.description        IS NOT DISTINCT FROM OLD.description
     AND NEW.metadata           IS NOT DISTINCT FROM OLD.metadata
     AND NEW.ip_address         IS NOT DISTINCT FROM OLD.ip_address
     AND NEW.user_agent         IS NOT DISTINCT FROM OLD.user_agent
     AND NEW.severity           IS NOT DISTINCT FROM OLD.severity
     AND NEW.election_id        IS NOT DISTINCT FROM OLD.election_id
     AND NEW.request_id         IS NOT DISTINCT FROM OLD.request_id
     AND NEW.original_description IS NOT DISTINCT FROM OLD.original_description
     AND NEW.schema_version     IS NOT DISTINCT FROM OLD.schema_version
  THEN
    RETURN NEW;
  END IF;

  -- Allow disassociating audit rows from a deleted archived event
  -- (admin_delete_event): only election_id X -> NULL, nothing else changes.
  IF NEW.election_id IS NULL
     AND OLD.election_id IS NOT NULL
     AND NEW.actor_id           IS NOT DISTINCT FROM OLD.actor_id
     AND NEW.actor_email        IS NOT DISTINCT FROM OLD.actor_email
     AND NEW.actor_role         IS NOT DISTINCT FROM OLD.actor_role
     AND NEW.action             IS NOT DISTINCT FROM OLD.action
     AND NEW.category           IS NOT DISTINCT FROM OLD.category
     AND NEW.target_type        IS NOT DISTINCT FROM OLD.target_type
     AND NEW.target_id          IS NOT DISTINCT FROM OLD.target_id
     AND NEW.description        IS NOT DISTINCT FROM OLD.description
     AND NEW.metadata           IS NOT DISTINCT FROM OLD.metadata
     AND NEW.ip_address         IS NOT DISTINCT FROM OLD.ip_address
     AND NEW.user_agent         IS NOT DISTINCT FROM OLD.user_agent
     AND NEW.severity           IS NOT DISTINCT FROM OLD.severity
     AND NEW.request_id         IS NOT DISTINCT FROM OLD.request_id
     AND NEW.original_description IS NOT DISTINCT FROM OLD.original_description
     AND NEW.schema_version     IS NOT DISTINCT FROM OLD.schema_version
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_log is immutable; use rpc admin_correct_audit_entry to make corrections'
    USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.audit_log_immutable() IS
  'Append-only guard. Allows audit.correction rows + FK SET NULL cascades (actor_id from user delete, election_id from archived-event delete) and nothing else.';
