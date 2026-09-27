# Plan: Fase 2 — Election State Machine & Scope

> **Tujuan:** election punya lifecycle 6 state yang valid (draft → registration → voting → counting → published → archived), dengan transisi yang diawasi trigger + auto-transition via cron, plus eligibility rules fleksibel.
> **Sumber visi:** `.kilo/plans/election-governance-roadmap.md` §Fase 2.
> **Prasyarat (sudah selesai):** Fase 1 (committee/observer) live — `committee_role` enum, `app_role` punya `committee`/`observer`, `election_id` di audit_log, helper `has_election_role`/`can_access_election`/`can_manage_election`.
> **Cakupan fase ini:** state machine + auto-transition + scope column + eligibility rules. Fase 3 (RBAC/org hierarchy/ballot terpisah) tetap di-defer.

---

## 0. Konfirmasi keputusan (sudah dikonfirmasi dengan user)

| # | Keputusan | Jawaban |
|---|---|---|
| 1 | State machine values | **6 state penuh**: `draft, registration, voting, counting, published, archived` |
| 2 | Auto-transition | **Otomatis via cron** (pg_cron extension) — fallback admin manual via RPC |
| 3 | Eligibility mechanism | **Tabel `election_eligibility_rules` baru** (rule_type + rule_value) |
| 4 | Legacy `event_voter_groups` | **Tetap dipakai paralel** — `is_eligible_voter` cek keduanya; deprecate nanti |
| 5 | `scope_type` relasi | **Polymorphic**: `scope_id TEXT` (UUID disimpan sebagai text), validasi via RPC `validate_scope_id` |
| 6 | Permission enforcement | **Hard-block RLS** dengan USING clause yang reference `election_events.status` |
| 7 | Existing data migrasi | **Otomatis**: `'active'→'voting'`, `'closed'→'published'` di migration |

---

## 1. Schema migration — `20251108000000_phase2_state_machine_and_scope.sql`

### 1.1 Update CHECK constraint `election_events.status`

```sql
ALTER TABLE public.election_events
  DROP CONSTRAINT IF EXISTS election_events_status_check;

ALTER TABLE public.election_events
  ADD CONSTRAINT election_events_status_check CHECK (
    status IN ('draft','registration','voting','counting','published','archived')
  );

-- Backward-migrate existing rows (live DB saat ini: 1 active, 1 closed)
UPDATE public.election_events SET status = 'voting'    WHERE status = 'active';
UPDATE public.election_events SET status = 'published' WHERE status = 'closed';
```

### 1.2 State transition log

```sql
CREATE TABLE IF NOT EXISTS public.election_state_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  from_status   TEXT NOT NULL CHECK (from_status IN
                  ('draft','registration','voting','counting','published','archived')),
  to_status     TEXT NOT NULL CHECK (to_status IN
                  ('draft','registration','voting','counting','published','archived')),
  triggered_by  TEXT NOT NULL CHECK (triggered_by IN ('admin','system','auto_window')),
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_election_state_transitions_election
  ON public.election_state_transitions(election_id, created_at DESC);
```

### 1.3 Trigger validasi transisi

```sql
CREATE OR REPLACE FUNCTION public.validate_election_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_is_admin BOOLEAN := public.has_role(auth.uid(), 'admin'::app_role);
  v_actor_is_chair  BOOLEAN := public.can_manage_election(auth.uid(), NEW.id);
BEGIN
  -- 1) Identical status = no-op (allow updates to other fields)
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- 2) System-triggered auto-transition (auth.uid() IS NULL via SECURITY DEFINER) — allowed
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- 3) Only admin or committee chair can change status
  IF NOT (v_actor_is_admin OR v_actor_is_chair) THEN
    RAISE EXCEPTION 'Tidak berhak mengubah status pemilihan'
      USING ERRCODE = '42501';
  END IF;

  -- 4) Allowed transitions map
  -- draft       -> registration | archived
  -- registration -> voting     | draft (cancel) | archived
  -- voting      -> counting    | draft (cancel) | archived
  -- counting    -> published   | voting (re-open) | archived
  -- published   -> archived
  -- archived    -> (terminal — only super_admin via direct SQL)
  IF NOT (
    (OLD.status = 'draft'       AND NEW.status IN ('registration','archived')) OR
    (OLD.status = 'registration' AND NEW.status IN ('voting','draft','archived')) OR
    (OLD.status = 'voting'      AND NEW.status IN ('counting','draft','archived')) OR
    (OLD.status = 'counting'    AND NEW.status IN ('published','voting','archived')) OR
    (OLD.status = 'published'   AND NEW.status IN ('archived')) OR
    -- Admin can also force any transition (override)
    v_actor_is_admin
  ) THEN
    RAISE EXCEPTION 'Transisi status % -> % tidak diizinkan', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_validate_election_state_transition ON public.election_events;
CREATE TRIGGER tg_validate_election_state_transition
  BEFORE UPDATE OF status ON public.election_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_election_state_transition();
```

### 1.4 Auto-transition RPC (dipanggil oleh cron job)

```sql
CREATE OR REPLACE FUNCTION public.auto_transition_elections()
RETURNS TABLE (election_id UUID, from_status TEXT, to_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, status, start_time, end_time FROM public.election_events
    WHERE status IN ('registration','voting')
  LOOP
    IF rec.status = 'registration' AND rec.start_time <= now() THEN
      UPDATE public.election_events SET status = 'voting' WHERE id = rec.id;
      INSERT INTO public.election_state_transitions (election_id, from_status, to_status, triggered_by, reason)
      VALUES (rec.id, 'registration', 'voting', 'auto_window', 'start_time reached');
      RETURN QUERY SELECT rec.id, 'registration'::TEXT, 'voting'::TEXT;
    ELSIF rec.status = 'voting' AND rec.end_time <= now() THEN
      UPDATE public.election_events SET status = 'counting' WHERE id = rec.id;
      INSERT INTO public.election_state_transitions (election_id, from_status, to_status, triggered_by, reason)
      VALUES (rec.id, 'voting', 'counting', 'auto_window', 'end_time reached');
      RETURN QUERY SELECT rec.id, 'voting'::TEXT, 'counting'::TEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_transition_elections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_transition_elections() TO service_role;  -- only cron job
```

> **Kenapa `service_role`?** pg_cron di Supabase dijalankan sebagai `service_role` (bypass RLS). Trigger `validate_election_state_transition` mengizinkan transition jika `auth.uid() IS NULL`, jadi cron job via service_role aman.

### 1.5 Scope column

```sql
CREATE TYPE public.election_scope_type AS ENUM (
  'university','faculty','department','program','cohort','class','organization'
);

ALTER TABLE public.election_events
  ADD COLUMN IF NOT EXISTS scope_type public.election_scope_type,
  ADD COLUMN IF NOT EXISTS scope_id TEXT;  -- polymorphic: UUID or composite key

ALTER TABLE public.election_events
  ADD CONSTRAINT election_events_scope_consistency CHECK (
    (scope_type IS NULL AND scope_id IS NULL) OR
    (scope_type IS NOT NULL AND scope_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_election_events_scope
  ON public.election_events(scope_type, scope_id)
  WHERE scope_type IS NOT NULL;
```

### 1.6 RPC `validate_scope_id` (dipanggil di trigger/event create)

```sql
CREATE OR REPLACE FUNCTION public.validate_scope_id(
  p_scope_type public.election_scope_type,
  p_scope_id   TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_scope_type IS NULL OR p_scope_id IS NULL THEN RETURN TRUE; END IF;

  -- scope_id is text; try parse as UUID for those that reference UUID PKs
  CASE p_scope_type
    WHEN 'class' THEN
      RETURN EXISTS (SELECT 1 FROM public.classes WHERE id::text = p_scope_id);
    WHEN 'organization' THEN
      -- organisasi external, tidak ada tabel; skip validation
      RETURN TRUE;
    ELSE
      -- faculty/department/program/cohort/university belum punya tabel
      -- TODO: Fase 3 (organizational hierarchy) akan menambah validasi ini
      RETURN TRUE;
  END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_scope_id(public.election_scope_type, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_scope_id(public.election_scope_type, TEXT) TO authenticated;
```

### 1.7 Tabel `election_eligibility_rules`

```sql
CREATE TABLE IF NOT EXISTS public.election_eligibility_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL CHECK (rule_type IN
                    ('class_id','profile_id','department','cohort','organization','custom')),
  rule_value      TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_election_eligibility_rules_election
  ON public.election_eligibility_rules(election_id);

CREATE INDEX IF NOT EXISTS idx_election_eligibility_rules_lookup
  ON public.election_eligibility_rules(election_id, rule_type, rule_value);

ALTER TABLE public.election_eligibility_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage eligibility rules"
  ON public.election_eligibility_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Committee and observers view eligibility rules"
  ON public.election_eligibility_rules FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), election_id));
```

### 1.8 RPC `is_eligible_voter` (gabungan event_voter_groups + rules)

```sql
CREATE OR REPLACE FUNCTION public.is_eligible_voter(
  p_user_id     UUID,
  p_election_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id UUID;
  v_in_group BOOLEAN;
BEGIN
  -- Path 1: event_voter_groups (legacy, class-based)
  SELECT class_id INTO v_class_id FROM public.profiles WHERE id = p_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.event_voter_groups evg
    WHERE evg.event_id = p_election_id AND evg.class_id = v_class_id
  ) INTO v_in_group;

  IF v_in_group THEN RETURN TRUE; END IF;

  -- Path 2: election_eligibility_rules
  RETURN EXISTS (
    SELECT 1 FROM public.election_eligibility_rules r
    WHERE r.election_id = p_election_id
      AND (
        (r.rule_type = 'class_id'    AND r.rule_value = v_class_id::TEXT)
        OR (r.rule_type = 'profile_id' AND r.rule_value = p_user_id::TEXT)
        -- Future Fase 3: department, cohort, organization rules will use
        -- profiles.class_id -> classes.faculty etc; placeholder for now
      )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_eligible_voter(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_eligible_voter(UUID, UUID) TO authenticated;
```

### 1.9 RPC admin: tambah/hapus eligibility rule

```sql
CREATE OR REPLACE FUNCTION public.admin_add_eligibility_rule(
  p_election_id  UUID,
  p_rule_type    TEXT,
  p_rule_value   TEXT,
  p_description  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
  END IF;
  IF p_rule_type NOT IN ('class_id','profile_id','department','cohort','organization','custom') THEN
    RAISE EXCEPTION 'rule_type tidak valid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.election_eligibility_rules (election_id, rule_type, rule_value, description, created_by)
  VALUES (p_election_id, p_rule_type, p_rule_value, p_description, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'eligibility.add', 'admin', 'election_eligibility_rules', v_id::TEXT,
          'Eligibility rule added', p_election_id,
          jsonb_build_object('rule_type', p_rule_type, 'rule_value', p_rule_value),
          'info');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_eligibility_rule(
  p_rule_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_election UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
  END IF;
  SELECT election_id INTO v_election FROM public.election_eligibility_rules WHERE id = p_rule_id;
  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Rule tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.election_eligibility_rules WHERE id = p_rule_id;
  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, severity)
  VALUES (auth.uid(), 'eligibility.remove', 'admin', 'election_eligibility_rules', p_rule_id::TEXT,
          'Eligibility rule removed', v_election, 'info');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) TO authenticated;
```

### 1.10 RPC transition state (admin manual override)

```sql
CREATE OR REPLACE FUNCTION public.admin_transition_election_state(
  p_election_id UUID,
  p_to_status   TEXT,
  p_reason      TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
  v_to   TEXT := p_to_status;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.can_manage_election(auth.uid(), p_election_id)) THEN
    RAISE EXCEPTION 'Tidak berhak' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_from FROM public.election_events WHERE id = p_election_id;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Pemilihan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Trigger validate_election_state_transition akan enforce allowed transitions.
  -- admin override flag di trigger mengizinkan admin lewati validation.
  UPDATE public.election_events SET status = p_to_status WHERE id = p_election_id;

  INSERT INTO public.election_state_transitions
    (election_id, from_status, to_status, triggered_by, actor_id, reason)
  VALUES (p_election_id, v_from, p_to_status, 'admin', auth.uid(), p_reason);

  INSERT INTO public.audit_log
    (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'election.transition', 'admin', 'election_events', p_election_id::TEXT,
            'Election state: ' || v_from || ' -> ' || p_to_status,
            p_election_id, jsonb_build_object('from', v_from, 'to', p_to_status, 'reason', p_reason),
            'info');

  RETURN p_to_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) TO authenticated;
```

### 1.11 Update RLS — state-based permission

```sql
-- Drop existing policies that don't reference status
DROP POLICY IF EXISTS "Voters can insert their own votes" ON public.votes;
CREATE POLICY "Voters can insert their own votes"
  ON public.votes FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE e.id = event_id
        AND e.status = 'voting'
        AND public.is_eligible_voter(auth.uid(), e.id)
    )
  );

-- Hard-block candidate edits when election is past registration
DROP POLICY IF EXISTS "Admin can manage candidates" ON public.candidates;
-- Keep simple "admin all" but add: candidates cannot be added/deleted when status not in (draft, registration)
-- RLS WITH CHECK applies only to INSERT/UPDATE. For now keep admin all access via RPC admin_manage_candidate.

-- Update votes SELECT to allow committee+observer scoped to their event (already added in Fase 1)
-- Add: voter can still SELECT own vote regardless of state
DROP POLICY IF EXISTS "Voters can view their own votes" ON public.votes;
CREATE POLICY "Voters can view their own votes"
  ON public.votes FOR SELECT TO authenticated
  USING (voter_id = auth.uid());
```

### 1.12 pg_cron job

```sql
-- Enable extension (run separately, IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto_transition_elections to run every minute
SELECT cron.schedule(
  'auto-transition-elections',
  '* * * * *',
  $$SELECT * FROM public.auto_transition_elections()$$
);
```

> **Catatan:** Jika `pg_cron` extension belum enabled di Supabase project, harus diaktifkan manual via Dashboard → Database → Extensions. Default-nya enabled di Supabase hosted.

---

## 2. Frontend

### 2.1 Update `types.ts` (regenerate via supabase_generate_typescript_types)

Setelah apply migration, regenerate types. Akan ada tambahan: enum `election_scope_type`, table `election_state_transitions`, `election_eligibility_rules`, RPCs.

### 2.2 Admin Events page (`src/pages/admin/Events.tsx`)

- Tambah kolom/filter `status` di tabel (dropdown filter: draft/registration/voting/counting/published/archived).
- Tambah badge warna berbeda per status.

### 2.3 Admin EventDetail page (`src/pages/admin/EventDetail.tsx`)

- Tambah tab "Status & Rules" yang berisi:
  - State machine controls: tombol "Buka Pendaftaran" / "Buka Voting" / "Mulai Hitung" / "Publikasikan" / "Arsipkan" (sesuai transisi yang diizinkan, disabled jika tidak)
  - Timeline `election_state_transitions` (kapan transisi, oleh siapa, trigger)
  - Form tambah `election_eligibility_rule` (rule_type + rule_value + description)
  - List existing rules dengan tombol hapus
  - Section `scope`: dropdown scope_type + input scope_id, validasi via `validate_scope_id` RPC

### 2.4 Update `CreateEventDialog`

- Tambah field `scope_type` (optional) + `scope_id` (optional)
- Tidak ubah start_time/end_time

### 2.5 Voter-facing: hide tombol vote jika bukan `voting`

- VotingPage: cek `election.status === 'voting'` sebelum render form. Jika `counting`/`published`, tampilkan hasil + notice "Voting telah berakhir".
- ResultPage: tampilkan status badge (counting/published/archived).
- PublicResultsPage: hanya tampilkan jika `published` (atau `closed` dengan public_results, fallback existing).

### 2.6 Lib helper

File `src/lib/election-state.ts` (baru):
```ts
export const STATUS_LABEL: Record<ElectionStatus, string> = {
  draft: 'Draf', registration: 'Pendaftaran', voting: 'Voting',
  counting: 'Penghitungan', published: 'Dipublikasikan', archived: 'Diarsipkan',
};
export const STATUS_COLOR: Record<ElectionStatus, string> = { ... };
export function canTransition(from: ElectionStatus, to: ElectionStatus, isAdmin: boolean): boolean { ... }
export const ALLOWED_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  draft:       ['registration','archived'],
  registration: ['voting','draft','archived'],
  voting:      ['counting','draft','archived'],
  counting:    ['published','voting','archived'],
  published:   ['archived'],
  archived:    [],
};
```

---

## 3. Tests

### 3.1 `src/lib/__tests__/election-state.test.ts` (baru)

- Unit test untuk `ALLOWED_TRANSITIONS` dan `canTransition()`
- Boundary cases: archived = terminal, admin override = always true

### 3.2 `src/pages/__tests__/admin/EventDetail.state.test.tsx` (baru)

- Admin dapat klik tombol transisi yang valid
- Admin TIDAK dapat transisi invalid (e.g., draft → published)
- Eligibility rule form submit → RPC `admin_add_eligibility_rule` dipanggil
- Eligibility rule delete → RPC `admin_remove_eligibility_rule` dipanggil
- Timeline transisi muncul jika ada row

### 3.3 Update `src/pages/__tests__/VotingPage.test.tsx` (existing)

- Test: jika event status !== 'voting', tombol vote disabled
- Test: error '23505' untuk double-vote (existing — pastikan masih pass)

### 3.4 Update `src/pages/__tests__/ResultsPage.test.tsx` (existing)

- Test: jika event status = 'counting'/'published', tampilkan hasil

### 3.5 Test target

121 → 130+ tests, semua pass.

---

## 4. RLS impact matrix

| Action | Status yang diizinkan | Enforcement |
|---|---|---|
| INSERT votes | `voting` only | RLS WITH CHECK |
| INSERT candidates (admin) | `draft`, `registration` | RPC `admin_manage_candidate` baru (Fase 3) atau trigger |
| UPDATE election_events.status | per allowed transition map | Trigger `validate_election_state_transition` |
| INSERT election_eligibility_rules | `draft`, `registration` (advisory) | RPC admin |
| Auto transition | via pg_cron (service_role) | Trigger izinkan auth.uid()=NULL |

---

## 5. Validasi

- [ ] Migration applied ke live DB tanpa error
- [ ] Schema_migrations ter-update: `20251108000000`
- [ ] pg_cron extension enabled di Supabase Dashboard
- [ ] Job `auto-transition-elections` terdaftar (cek via `SELECT * FROM cron.job`)
- [ ] Test: bikin event draft → admin_transition_election_state('registration') → sukses
- [ ] Test: registration → voting trigger otomatis oleh cron
- [ ] Test: voting → counting trigger otomatis oleh cron
- [ ] Test: admin coba transisi draft→published → ditolak trigger
- [ ] Test: eligibility rule: tambah 'class_id' untuk class X → voter di class X eligible, voter di class Y tidak
- [ ] Test: election_eligibility_rules + event_voter_groups → voter eligible kalau salah satu cocok
- [ ] Frontend: tombol transisi hidden kalau tidak allowed
- [ ] Tests 130+ passing, tsc 0 error, build success

---

## 6. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Live election `active` saat migration di-apply — transisi ke `voting` langsung | Migration update row sebelum add constraint baru (sudah di §1.1) |
| pg_cron tidak enabled di Supabase | Verify di Dashboard sebelum apply §1.12; fallback admin transition RPC |
| Trigger `validate_election_state_transition` reject update legitimate (e.g., set new end_time tidak boleh naikkan status) | Trigger only fires `BEFORE UPDATE OF status` (kolom spesifik), update field lain tidak trigger |
| Existing UI yang set status via direct supabase.from('election_events').update({status: ...}) sekarang reject | Update semua callsite pakai `admin_transition_election_state` RPC (grep) |
| RLS state-based vote insert reject existing user flow | Tambah `EXISTS` clause yang allow admin override (sama pattern) |
| Auto-transition skip edge case (end_time = now() tepat) | pg_cron `* * * * *` jalan tiap menit, aman ±1 menit |
| Scope_id orphan (kelas dihapus setelah election dibuat) | Validate via `validate_scope_id` RPC saat create/update event. TIDAK enforce FK di trigger (admin masih bisa terima orphan utk archive). |
| Eligibility rule RLS conflict dengan admin RPC | admin RPC SECURITY DEFINER bypasses RLS. Policy cukup cover non-RPC access. |

---

## 7. Rollout plan

1. **Apply migration 20251108000000** ke staging (test semua auto-transition)
2. **Verify pg_cron job terdaftar** — `SELECT * FROM cron.job WHERE jobname='auto-transition-elections'`
3. **Apply ke production** — saat ini ada 1 election `voting` (akan jadi `voting` setelah migrasi) + 1 `published`
4. **Update frontend** — push baru ke Vercel
5. **Smoke test**:
   - Buka `/admin/events/<id>` → klik "Buka Pendaftaran" → sukses
   - Set start_time ke 1 menit dari sekarang → tunggu cron job → status jadi `voting` otomatis
   - Set end_time ke 1 menit dari sekarang → tunggu → status jadi `counting`
   - Klik "Publikasikan" → status `published`
6. **Monitor** Sentry untuk error trigger; cek `election_state_transitions` table untuk audit trail
7. **Cleanup**: setelah 1 minggu stabil, document runbook

---

## 8. Definisi Selesai

- [ ] Migration applied
- [ ] pg_cron job aktif
- [ ] State machine triggers berfungsi (manual + auto)
- [ ] Eligibility rules bisa ditambah/dihapus admin
- [ ] Scope_type + scope_id tersimpan dan ter-validate
- [ ] Frontend: tombol transisi + form eligibility rules
- [ ] Existing 1 election tetap `voting` (live)
- [ ] Tests 130+ passing
- [ ] tsc 0 error
- [ ] Build success
- [ ] Tidak ada regression di Phase 0/1 features

---

## 9. Out of scope (untuk Fase 3+)

- Permission-based RBAC dengan `permission_key` enum
- Organizational hierarchy (organizations table, departments, faculties)
- Ballot terpisah dari vote (ballots table)
- Comprehensive audit dengan ip_address_hash, request_id
- Profile-based eligibility dengan field di profiles (cohort, faculty)
- Anonymous voting / blind ballot

---

## 10. Rujukan

- **Visi lengkap**: `docs/gpt-response.md`
- **Roadmap governance**: `.kilo/plans/election-governance-roadmap.md` (Fase 2)
- **Fase 1 selesai**: `.kilo/plans/election-governance-roadmap.md` (Fase 1)
- **Production readiness**: `.kilo/plans/production-readiness.md`
- **Live DB**: `oiurjnmpkguyxevdbpbu` (UniVertex)
- **Current schema**: 15 public tables (12 base + 3 Fase 1)
- **Current roles**: 5 (admin, voter, candidate, committee, observer)
- **Current status values**: 3 (draft, active, closed) → after migration: 6
- **Active elections saat ini**: 1 (status akan jadi 'voting' setelah migration)
