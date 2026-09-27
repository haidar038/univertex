# Plan: Fase 3 — RBAC Penuh + Comprehensive Audit

> **Tujuan:** ganti `has_role` checks dengan permission-based system (`has_permission`) + tambah immutability & export untuk audit log.
> **Sumber visi:** `.kilo/plans/election-governance-roadmap.md` §Fase 3 (RBAC & Audit).
> **Prasyarat selesai:** Fase 1 (committee/observer) + Fase 2 (state machine & scope) live.
> **Cakupan fase ini:** RBAC penuh (permission_key enum + role_permissions) + audit immutability + audit views + export RPC + frontend usePermission hook. Org hierarchy & ballot terpisah di-defer ke Fase 4+.

---

## 0. Konfirmasi keputusan

| # | Keputusan | Jawaban |
|---|---|---|
| 1 | Scope Fase 3 | **RBAC penuh + comprehensive audit** (org hierarchy & ballot di-defer) |
| 2 | RBAC implementation | **Hybrid: role_permissions table + helper `has_permission` + incremental sweep** |
| 3 | Audit enhancement | **Full: kolom + view + RPC export** |
| 4 | Permission_key enum | **Modular: domain-prefix** (election.\*, candidate.\*, vote.\*, user.\*, audit.\*) |
| 5 | Default role permissions | **Direct mapping + scope via `can_access_election`** |
| 6 | Per-election scope | **Granular: `has_permission` + `can_access_election` di setiap RPC** |
| 7 | Frontend strategy | **Hook + `<RequirePermission>` component (kompatibel dengan ProtectedRoute)** |
| 8 | Audit immutability | **Block UPDATE/DELETE kecuali via special RPC** |
| 9 | Audit retention & export | **RPC export (JSON/CSV) + 7-year retention election day, 1-year non-election** |
| 10 | Migration order | **Backend-first (M1–M6), frontend sweep di M6** |

---

## 1. Schema migration — backend M1–M5

### 1.1 M1: Permission schema + helper (20251110000000)

**File:** `supabase/migrations/20251110000000_add_permission_key_enum.sql` (non-tx, enum)

```sql
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.update';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.publish';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.delete';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.transition';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.create';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.review';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.approve';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.reject';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.edit';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.cast';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.count';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.export';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.verify';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'committee.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'committee.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'observer.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'observer.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'audit.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'audit.export';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.create';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.edit';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.delete';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.reset_password';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'system.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'system.settings';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'eligibility.manage';
```

> 30 permissions. Note: `permission_key` enum sudah dibuat di Fase 1's roadmap reference tapi **belum di-DB** (sebelumnya cuma sketch). ADD VALUE di sini = additive, tidak break.

**File:** `supabase/migrations/20251110000100_create_role_permissions.sql` (in tx)

```sql
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role          public.app_role   NOT NULL,
  permission    public.permission_key NOT NULL,
  granted_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  granted_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (role, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Admin bypass: tidak perlu policy karena has_permission hard-codes admin TRUE.
-- Tapi untuk direct SELECT admin UI, allow admin read:
CREATE POLICY "Admins can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  -- admin: ALL
  ('admin','election.view'),('admin','election.update'),('admin','election.publish'),
  ('admin','election.delete'),('admin','election.transition'),
  ('admin','candidate.view'),('admin','candidate.create'),('admin','candidate.review'),
  ('admin','candidate.approve'),('admin','candidate.reject'),('admin','candidate.edit'),
  ('admin','vote.cast'),('admin','vote.view'),('admin','vote.count'),('admin','vote.export'),
  ('admin','voter.view'),('admin','voter.verify'),('admin','voter.manage'),
  ('admin','committee.manage'),('admin','committee.view'),
  ('admin','observer.manage'),('admin','observer.view'),
  ('admin','audit.view'),('admin','audit.export'),
  ('admin','user.create'),('admin','user.edit'),('admin','user.delete'),('admin','user.reset_password'),
  ('admin','system.manage'),('admin','system.settings'),
  ('admin','eligibility.manage'),
  -- committee: read + verify (scoped via can_access_election in RPCs)
  ('committee','election.view'),('committee','candidate.view'),
  ('committee','vote.view'),('committee','voter.view'),('committee','voter.verify'),
  ('committee','committee.view'),
  ('committee','audit.view'),
  -- observer: read-only
  ('observer','election.view'),('observer','candidate.view'),
  ('observer','vote.view'),
  ('observer','committee.view'),('observer','observer.view'),
  ('observer','audit.view'),
  -- voter
  ('voter','election.view'),('voter','vote.cast'),
  -- candidate
  ('candidate','election.view'),('candidate','candidate.create')
ON CONFLICT (role, permission) DO NOTHING;
```

**File:** `supabase/migrations/20251110000200_create_has_permission_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id    UUID,
  p_permission public.permission_key
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin bypass: short-circuit
  SELECT CASE
    WHEN public.has_role(p_user_id, 'admin'::app_role) THEN TRUE
    ELSE EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = p_user_id
        AND rp.permission = p_permission
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, public.permission_key) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, public.permission_key) TO authenticated;

-- Helper: cek permission caller (current auth.uid())
CREATE OR REPLACE FUNCTION public.caller_has_permission(
  p_permission public.permission_key
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), p_permission);
$$;

REVOKE EXECUTE ON FUNCTION public.caller_has_permission(public.permission_key) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.caller_has_permission(public.permission_key) TO authenticated;
```

**File:** `supabase/migrations/20251110000300_permission_helpers_to_seed.sql` (backward compat: `caller_has_role` untuk legacy code)

Tidak perlu — `has_role` sudah ada dan di-sweep di M2, jadi tidak perlu helper baru.

### 1.2 M2: Sweep existing RPCs pakai has_permission (20251111000000)

**File:** `supabase/migrations/20251111000000_sweep_rpcs_to_has_permission.sql`

Ganti `has_role(auth.uid(), 'admin')` di body RPC yang ada dengan `caller_has_permission('<perm>')`. Tabel sweep:

| RPC | Old check | New check |
|---|---|---|
| `admin_create_user` | `has_role(...,'admin')` | `caller_has_permission('user.create')` |
| `admin_assign_committee` | `has_role(...,'admin')` | `caller_has_permission('committee.manage')` |
| `admin_revoke_committee` | same | `caller_has_permission('committee.manage')` |
| `admin_assign_observer` | same | `caller_has_permission('observer.manage')` |
| `admin_revoke_observer` | same | `caller_has_permission('observer.manage')` |
| `admin_transition_election_state` | `has_role OR can_manage_election` | `caller_has_permission('election.transition')` (admin) OR `can_manage_election (committee chair)` — keep hybrid |
| `admin_add_eligibility_rule` | `has_role(...,'admin')` | `caller_has_permission('eligibility.manage')` |
| `admin_remove_eligibility_rule` | same | `caller_has_permission('eligibility.manage')` |
| `admin_lookup_user_id_by_email` | same | `caller_has_permission('user.create')` |
| `accept_invitation_and_register` | none (anon) | keep anon — no auth check |
| `add_election_observation` | `can_access_election` | keep — scope-based, no role needed |
| `add_election_observation` (extra: chair-only field?) | n/a | no change |

Pattern di setiap RPC:
```sql
-- BEFORE
IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
  RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
END IF;

-- AFTER
IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
  RAISE EXCEPTION 'Tidak memiliki izin user.create' USING ERRCODE = '42501';
END IF;
```

**Important:** Untuk RPC yang admin-only (seperti `admin_transition_election_state`), admin tetap di-allow via `caller_has_permission` karena admin punya semua permission di seed. Tidak perlu fallback ke `has_role` di dalam RPC. Committee chair tetap pakai `can_manage_election` (scope-based, bukan permission-based).

### 1.3 M3: Audit enhancement columns + immutability (20251112000000)

**File:** `supabase/migrations/20251112000000_audit_enhancement.sql`

```sql
-- Add columns
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,  -- SHA-256 of IP for privacy
  ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '3';

CREATE INDEX IF NOT EXISTS idx_audit_log_request
  ON public.audit_log(request_id) WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created
  ON public.audit_log(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_election_action
  ON public.audit_log(election_id, action, created_at DESC) WHERE election_id IS NOT NULL;

-- Immutability trigger: block UPDATE/DELETE unless via special RPC
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow system-initiated corrections (special action)
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

DROP TRIGGER IF EXISTS tg_audit_log_no_delete ON public.audit_log;
CREATE TRIGGER tg_audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_immutable();

-- Special RPC: admin correction
CREATE OR REPLACE FUNCTION public.admin_correct_audit_entry(
  p_entry_id     UUID,
  p_new_description TEXT,
  p_correction_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_has_permission('audit.view'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin' USING ERRCODE = '42501';
  END IF;

  UPDATE public.audit_log
    SET description = '[CORRECTED ' || now()::text || '] ' || p_new_description,
        metadata = metadata || jsonb_build_object(
          'correction_reason', p_correction_reason,
          'corrected_by', auth.uid(),
          'corrected_at', now()
        )
    WHERE id = p_entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_correct_audit_entry(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_audit_entry(UUID, TEXT, TEXT) TO authenticated;
```

### 1.4 M4: Audit view + export RPC (20251113000000)

**File:** `supabase/migrations/20251113000000_audit_views_and_export.sql`

```sql
-- Comprehensive view: join audit + actor profile
CREATE OR REPLACE VIEW public.election_audit_trail AS
  SELECT
    al.id,
    al.created_at,
    al.action,
    al.category,
    al.severity,
    al.description,
    al.metadata,
    al.target_type,
    al.target_id,
    al.election_id,
    al.actor_id,
    al.actor_email,
    al.actor_role,
    al.ip_address_hash,
    al.user_agent,
    al.request_id,
    al.schema_version,
    p.full_name AS actor_full_name,
    p.student_id AS actor_student_id
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE al.election_id IS NOT NULL;

GRANT SELECT ON public.election_audit_trail TO authenticated;

-- Per-election view (alternative)
CREATE OR REPLACE VIEW public.election_audit_by_election AS
  SELECT
    al.*,
    e.title AS election_title,
    p.full_name AS actor_full_name,
    p.student_id AS actor_student_id
  FROM public.audit_log al
  JOIN public.election_events e ON e.id = al.election_id
  LEFT JOIN public.profiles p ON p.id = al.actor_id;

GRANT SELECT ON public.election_audit_by_election TO authenticated;

-- Export RPC: paged JSON
CREATE OR REPLACE FUNCTION public.admin_export_audit_log(
  p_election_id  UUID DEFAULT NULL,
  p_from_date    TIMESTAMPTZ DEFAULT NULL,
  p_to_date      TIMESTAMPTZ DEFAULT NULL,
  p_limit        INTEGER DEFAULT 1000,
  p_offset       INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total INTEGER;
BEGIN
  IF NOT public.caller_has_permission('audit.export'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin audit.export' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.audit_log
  WHERE (p_election_id IS NULL OR election_id = p_election_id)
    AND (p_from_date IS NULL OR created_at >= p_from_date)
    AND (p_to_date IS NULL OR created_at < p_to_date);

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      al.id, al.created_at, al.action, al.category, al.severity,
      al.description, al.metadata, al.target_type, al.target_id,
      al.election_id, al.actor_id, al.actor_email, al.actor_role,
      al.ip_address_hash, al.request_id, al.schema_version,
      p.full_name AS actor_full_name, p.student_id AS actor_student_id
    FROM public.audit_log al
    LEFT JOIN public.profiles p ON p.id = al.actor_id
    WHERE (p_election_id IS NULL OR al.election_id = p_election_id)
      AND (p_from_date IS NULL OR al.created_at >= p_from_date)
      AND (p_to_date IS NULL OR al.created_at < p_to_date)
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_audit_log(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export_audit_log(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  TO authenticated;
```

### 1.5 M5: Retention cron job (20251114000000)

**File:** `supabase/migrations/20251114000000_audit_retention_cron.sql`

```sql
-- Mark audit_log entries older than retention threshold.
-- Instead of DELETE (which is blocked by immutability trigger), mark with metadata.
-- Admin export can filter by metadata.is_archived = true.
-- Actually, immutability block DELETE. Need separate retention table.

CREATE TABLE IF NOT EXISTS public.audit_archive (
  id            UUID PRIMARY KEY,
  payload       JSONB NOT NULL,
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function: move old audit_log rows to archive (export then insert into archive, then DELETE)
CREATE OR REPLACE FUNCTION public.admin_archive_old_audit_entries(
  p_older_than TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.caller_has_permission('audit.export'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT id FROM public.audit_log
    WHERE created_at < p_older_than
    LIMIT 10000  -- batch size to avoid long locks
  LOOP
    INSERT INTO public.audit_archive (id, payload)
    SELECT id, to_jsonb(al.*) FROM public.audit_log al WHERE id = rec.id;
    DELETE FROM public.audit_log WHERE id = rec.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) TO service_role;

-- Retention policy: 1 year non-election, 7 years for election-day audit
-- pg_cron: weekly job, archive entries older than 1 year (election entries protected)
SELECT cron.schedule(
  'archive-old-audit-entries',
  '0 3 * * 0',  -- 3 AM every Sunday
  $$SELECT public.admin_archive_old_audit_entries(now() - interval '1 year')$$
);
```

> **Election day audit retention** is implicit: if `election.archived_at` > retention threshold, entries are kept longer. Future enhancement: per-election retention override. For now: 1 year baseline; admins manually skip deletion for election-day entries via `p_older_than = now() - interval '7 years'`.

---

## 2. Frontend — M6 (20251115000000)

### 2.1 Hook `usePermission`

**File:** `src/hooks/usePermission.ts` (new)

```ts
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type PermissionKey =
  | 'election.view' | 'election.update' | 'election.publish' | 'election.delete' | 'election.transition'
  | 'candidate.view' | 'candidate.create' | 'candidate.review' | 'candidate.approve' | 'candidate.reject' | 'candidate.edit'
  | 'vote.cast' | 'vote.view' | 'vote.count' | 'vote.export'
  | 'voter.view' | 'voter.verify' | 'voter.manage'
  | 'committee.manage' | 'committee.view'
  | 'observer.manage' | 'observer.view'
  | 'audit.view' | 'audit.export'
  | 'user.create' | 'user.edit' | 'user.delete' | 'user.reset_password'
  | 'system.manage' | 'system.settings'
  | 'eligibility.manage';

export function usePermission(permission: PermissionKey): boolean {
  const { profile } = useAuth();
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!profile) {
      setHas(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.rpc('has_permission', { p_user_id: profile.id, p_permission: permission })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('usePermission RPC error', error);
          setHas(false);
        } else {
          setHas(Boolean(data));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [profile?.id, permission]);

  return has;
}

// Multi-permission check (any of)
export function useAnyPermission(permissions: PermissionKey[]): boolean {
  // Hooks must be called unconditionally; use first to get loading
  const a = usePermission(permissions[0]);
  // For simplicity in M6, just use first perm. Extend with OR logic via single RPC call:
  // OPTIONAL: useAnyPermission via new RPC has_any_permission(perms[])
  return a;
}
```

> For M6, ship `usePermission` (single). Multi-permission RPC + hook di Fase 4+.

### 2.2 Component `<RequirePermission>`

**File:** `src/components/RequirePermission.tsx` (new)

```tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission, PermissionKey } from '@/hooks/usePermission';
import { Loader2 } from 'lucide-react';

interface Props {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;  // optional: custom denied UI (default: navigate to /)
}

export function RequirePermission({ permission, children, fallback }: Props) {
  const has = usePermission(permission);
  // Optional: loading skeleton via usePermission.isLoading (extend hook)
  if (!has) {
    return fallback ? <>{fallback}</> : <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
```

### 2.3 Update `useAuth` (additive, backward compat)

**File:** `src/hooks/useAuth.ts`

```ts
// Add to return value (don't break existing destructuring)
return {
  user, profile, loading, refresh, signOut,
  isAdmin, isVoter, isCandidate, isCommittee, isObserver,
  // NEW: pass-through to usePermission
  // (frontend components call usePermission directly, no wrapper here)
};
```

No breaking change. Existing tests pass.

### 2.4 Sweep admin pages with `<RequirePermission>`

Update 1-by-1 (incremental, low risk):

| Page | Old | New |
|---|---|---|
| `pages/admin/Users.tsx` | `isAdmin` check | `<RequirePermission permission="user.view">` wrap; button "Tambah User" uses `user.create` |
| `pages/admin/Classes.tsx` | `isAdmin` | `<RequirePermission permission="user.manage">` |
| `pages/admin/Events.tsx` | `isAdmin` | `<RequirePermission permission="election.view">` |
| `pages/admin/EventDetail.tsx` | `isAdmin` + `requireRole` | keep requireRole for backstop, add `<RequirePermission permission="election.update">` for action buttons |
| `pages/admin/ElectionStaff.tsx` | direct `has_role` in RPC | UI uses `<RequirePermission permission="committee.manage">` for assign buttons |
| `pages/admin/Invitations.tsx` | `isAdmin` | `<RequirePermission permission="user.create">` |
| `pages/admin/AuditLog.tsx` | `isAdmin` | `<RequirePermission permission="audit.view">` |
| `pages/admin/Sessions.tsx` | `isAdmin` | `<RequirePermission permission="user.manage">` |
| New: `pages/admin/AuditExport.tsx` | n/a | uses `permission="audit.export"` + button calls `admin_export_audit_log` |

**File:** `src/pages/admin/AuditExport.tsx` (new)

```tsx
// Form: from_date, to_date, election_id (optional)
// Submit → supabase.rpc('admin_export_audit_log', {p_election_id, p_from_date, p_to_date, p_limit: 1000, p_offset: 0})
// Display: total count, rows in a table, "Download JSON" button (creates blob from result)
```

### 2.5 ProtectedRoute compatibility

**`src/components/ProtectedRoute.tsx`** — keep as-is (backward compat). Add optional `permission` prop:

```ts
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: Role;
  permission?: PermissionKey;  // NEW: optional, takes precedence if set
}
```

If `permission` is set, use `usePermission(permission)` for the gate. Otherwise fall back to `requireRole` check. Existing routes unchanged.

### 2.6 Tests

**File:** `src/hooks/__tests__/usePermission.test.ts` (new)
- Mock RPC: returns true for admin, false for non-admin
- Test loading state, error handling, re-fetch on user change

**File:** `src/components/__tests__/RequirePermission.test.tsx` (new)
- Test: render with permission = true → children shown
- Test: render with permission = false → fallback (default Navigate to /)
- Test: custom fallback component

**File:** `src/hooks/__tests__/useAuth.test.ts`** — add test: `useAuth` does not break when role is `committee`/`observer` (existing tests should pass)

**File:** `src/pages/__tests__/admin/AuditExport.test.tsx` (new)
- Test: form submit → RPC called with correct args
- Test: response rendered as table
- Test: download button creates JSON blob

**File:** `src/pages/__tests__/admin/EventDetail.permission.test.tsx` (new)
- Test: action button hidden when user lacks `election.update`
- Test: action button visible when user has `election.update`

---

## 3. Validation matrix

| Concern | Enforcement layer | Verifikasi |
|---|---|---|
| User can call `admin_create_user` | RPC `caller_has_permission('user.create')` | Unit test: non-admin returns 42501 |
| User can transition election state | RPC `caller_has_permission('election.transition')` | Unit test: voter returns 42501 |
| Frontend hides "Tambah User" for non-admin | `<RequirePermission permission="user.create">` | Component test |
| Audit row can't be UPDATE/DELETE | Trigger `audit_log_immutable` | Direct SQL test |
| Admin can correct audit row | RPC `admin_correct_audit_entry` | Unit test + audit meta has `corrected_by` |
| Audit export works | RPC `admin_export_audit_log` | Component test + e2e manual |
| Old audit (1y+) archived | pg_cron weekly | Manual: `SELECT * FROM cron.job` |
| Committee chair can transition own event | `can_manage_election(uid, event_id)` (existing) | Unit test: chair of event X can transition event X |
| Voter can't see committee dashboard | `ProtectedRoute requireRole="committee"` (existing) | Existing test still pass |

---

## 4. Files to add / modify

### Migration (5 new files)

- `supabase/migrations/20251110000000_add_permission_key_enum.sql` (non-tx enum)
- `supabase/migrations/20251110000100_create_role_permissions.sql`
- `supabase/migrations/20251110000200_create_has_permission_rpc.sql`
- `supabase/migrations/20251111000000_sweep_rpcs_to_has_permission.sql`
- `supabase/migrations/20251112000000_audit_enhancement.sql`
- `supabase/migrations/20251113000000_audit_views_and_export.sql`
- `supabase/migrations/20251114000000_audit_retention_cron.sql`

### Frontend (new + modified)

New:
- `src/hooks/usePermission.ts`
- `src/components/RequirePermission.tsx`
- `src/pages/admin/AuditExport.tsx`
- `src/hooks/__tests__/usePermission.test.ts`
- `src/components/__tests__/RequirePermission.test.tsx`
- `src/pages/__tests__/admin/AuditExport.test.tsx`
- `src/pages/__tests__/admin/EventDetail.permission.test.tsx`

Modified (sweep, incremental):
- `src/hooks/useAuth.ts` (additive return values, no breaking change)
- `src/components/ProtectedRoute.tsx` (optional `permission` prop)
- `src/pages/admin/Users.tsx` (wrap with RequirePermission)
- `src/pages/admin/Classes.tsx` (wrap)
- `src/pages/admin/Events.tsx` (wrap)
- `src/pages/admin/EventDetail.tsx` (wrap + permission-gated buttons)
- `src/pages/admin/ElectionStaff.tsx` (wrap)
- `src/pages/admin/Invitations.tsx` (wrap)
- `src/pages/admin/AuditLog.tsx` (wrap + link to AuditExport)
- `src/pages/admin/Sessions.tsx` (wrap)
- `src/App.tsx` (add AuditExport route)

### Regenerate types

After M1, regenerate `src/integrations/supabase/types.ts` via `supabase_generate_typescript_types` to include new enum + RPCs.

---

## 5. Risk register

| Risk | Mitigation |
|---|---|
| Sweep RPCs introduces regression (some action now 42501) | Migration M2 has explicit unit test per RPC. Reuse existing test patterns. |
| `caller_has_permission` is too slow (N RPCs × N checks per call) | Use SECURITY DEFINER + STABLE. Consider materializing `user_permissions` view in M7+ if hot path. |
| `permission_key` enum ADD VALUE can't be in transaction | M1 first migration is non-tx (enum only). M1.1+ (table + RPC) is in-tx. |
| Audit immutability breaks admin tooling that auto-prunes logs | `admin_archive_old_audit_entries` (M5) provides a sanctioned path: export → archive table → DELETE. |
| `audit_log_immutable` trigger fires on legitimate UPDATEs from other triggers | Add `audit.correction` special action marker; existing UPDATE flows don't touch audit_log directly. |
| Frontend `usePermission` adds 1 RPC call per guarded page | Acceptable for M6. Phase 4+: bake permissions into `useAuth` (one fetch, expose as Set). |
| `caller_has_permission` returns FALSE for admin if role_permissions missing admin seed | Seed includes admin ALL in M1.1. Re-run seed if accidentally truncated. |
| `cron.schedule` for archive-old may fail silently if pg_cron not enabled in Supabase plan | Same as Fase 2: check `SELECT extname FROM pg_extension WHERE extname='pg_cron'`. If not, run archive manually via `SELECT admin_archive_old_audit_entries(now() - interval '1 year')`. |
| Existing tests use `isAdmin: true` from profile.roles — refactor changes shape? | No: useAuth return shape preserved (additive). New `usePermission` is opt-in. |
| `RequirePermission` triggers redirect to `/` for unauthorized — bad UX? | Show inline "Akses ditolak" page with link back. Update fallback in M6. |

---

## 6. Out of scope (deferred to Fase 4+)

- **Organizational hierarchy** (organizations, organizational_positions) — drop classes.faculty TEXT, replace with FK
- **Ballot vs Vote separation** (ballots table, issued→used lifecycle)
- **Multi-permission hooks** (`useAnyPermission`, `useAllPermission`) with batched RPC
- **Permission UI management** (admin page to grant/revoke custom permissions per user)
- **Department/cohort scope expansion** (elections at scope=department, scope=cohort via Fase 2's scope_type)
- **Profile-based permissions override** (e.g., "this user is admin for THIS election only")

---

## 7. Rollout

1. **Apply M1** (enum + role_permissions + has_permission) to staging
2. **Apply M2** (sweep RPCs) to staging. Run all existing tests against staging
3. **Apply M3-M5** (audit enhancement + cron) to staging
4. **Frontend M6** deploy to staging. Manual smoke: admin can still create user, transition state, etc.
5. **Apply to production** (during off-peak)
6. **Smoke test**:
   - Login as admin → can still access all admin pages
   - Login as committee → can access /committee, see observation form
   - Login as voter → cannot access /admin (existing ProtectedRoute still gates)
   - Try to UPDATE audit_log row directly via Studio → blocked
   - Call admin_export_audit_log from admin → JSON returned
7. **Monitor** Sentry for permission errors (42501) over 1 week
8. **Update docs** `docs/Update_September_2026.md` + add new runbook for audit export

---

## 8. Definition of Done

- [ ] All 7 migration files applied to live DB
- [ ] `permission_key` enum has 30 values
- [ ] `role_permissions` table seeded with default mappings
- [ ] `has_permission` and `caller_has_permission` RPCs live
- [ ] All M2-swept RPCs use `caller_has_permission` (no `has_role(...,'admin')` left in RPC bodies, except for admin_bypass special cases)
- [ ] Audit log immutability trigger live; UPDATE/DELETE blocked unless via `admin_correct_audit_entry`
- [ ] `election_audit_trail` view live, queryable from admin role
- [ ] `admin_export_audit_log` returns JSON
- [ ] pg_cron `archive-old-audit-entries` registered
- [ ] `usePermission` hook + `<RequirePermission>` component live
- [ ] 3 admin pages swept to use `<RequirePermission>` (Users, Events, AuditLog)
- [ ] New `AuditExport` page accessible to admin
- [ ] All 121+ existing tests still pass; 7+ new tests pass
- [ ] tsc 0 error
- [ ] vite build success
- [ ] Sentry has 0 new 42501 errors in first 24h after deploy (means sweeps work)

---

## 9. References

- **Roadmap source**: `.kilo/plans/election-governance-roadmap.md` §Fase 3
- **Phase 1 (committee/observer)**: done
- **Phase 2 (state machine & scope)**: `.kilo/plans/phase2-state-machine-and-scope.md` (done)
- **Production readiness**: `.kilo/plans/production-readiness.md`
- **Live DB**: `oiurjnmpkguyxevdbpbu` (UniVertex Supabase)
- **Current schema (after Phase 2)**: 17 public tables (12 base + 3 Fase 1 + 2 Fase 2)
- **Current RPCs**: ~17 (10 Fase 1, 7 Fase 2)
- **Current app_role enum**: admin, voter, candidate, committee, observer (5)
- **New app_role enum**: unchanged
- **New permission_key enum**: 30 values (added in M1)
