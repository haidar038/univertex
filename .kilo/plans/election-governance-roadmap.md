# Roadmap: Governance & Role Model untuk UniVertex

> **Sumber visi:** `docs/gpt-response.md` (17 section, analisis arsitektur e-election)
> **Status saat ini:** 3 role (`admin`/`voter`/`candidate`), governance terpusat di admin
> **Fokus utama:** memenuhi kebutuhan operasional lapangan (panitia/observer di-invite admin, tidak bisa ubah data, hanya validasi & monitoring) + cetak biru jangka panjang

---

## 0. Diagnosis keadaan sekarang (verifikasi live DB)

| Aspek | Keadaan | Bukti |
|---|---|---|
| Role platform | 3 enum | `app_role = {admin, voter, candidate}` di `pg_enum` |
| Role per-election | ❌ tidak ada | `user_roles` global, tidak terikat event_id |
| Committee/panitia | ❌ tidak ada | tidak ada tabel `election_committees` |
| Observer | ❌ tidak ada | tidak ada role atau tabel |
| Scope election | ❌ tidak ada | `election_events` tidak punya `scope_type`/`scope_id` |
| Eligibility rules | parsial | hanya `event_voter_groups(class_id)` — tidak ada rule eksplisit |
| State machine | parsial | `status = {draft, active, closed}` (3 state, tanpa validasi transisi) |
| Permission matrix | ❌ tidak ada | hanya `has_role(uid, 'admin'::app_role)` — boolean per role |
| Ballot vs Vote | ❌ tidak ada | `votes` langsung (voter_id, event_id, candidate_id) — tidak ada tabel ballot terpisah |
| Audit log | ✅ ada | `public.audit_log` (global) — belum ada per-election audit view |

**Implikasi:** untuk pemilihan lapangan yang proper, gpt-response.md benar bahwa fondasi governance perlu dibangun ulang secara bertahap — bukan rewrite total, tapi **evolusi terstruktur**.

---

## 1. Prinsip desain utama

### D1: Hindari rewrite total
Schema existing dipakai sebagai basis. Setiap fase:
- **Backward-compatible**: `app_role` enum ditambah (bukan diganti), kolom baru nullable/default
- **Idempotent**: migration bisa di-apply ulang dengan aman
- **Optional adoption**: fitur baru bisa diaktifkan per-election

### D2: Role platform ≠ role per-election
- **Platform role** (saat ini `admin`) → kelola sistem, user management, audit global
- **Election role** (baru: `committee`, `observer`) → terikat election tertentu via `election_committees`
- User yang sama bisa punya role berbeda untuk event berbeda (committee di Event A, voter di Event B)
- `voter`/`candidate` tetap global (per user, bukan per election) — `user_roles` existing dipakai; role per-election ditambahkan via `election_committees`

### D3: Permission-based, bukan role-based scattered
Daripada `if (role === 'admin')` di seluruh codebase, pakai centralized helper:
- `public.has_election_role(uid, event_id, 'committee')` — cek apakah user adalah committee di event tertentu
- `public.can_manage_election(uid, event_id)` — admin ATAU committee chair
- `public.can_view_election_audit(uid, event_id)` — admin, committee chair, observer

### D4: Committee read-only by default
Sesuai requirement lapangan: panitia **tidak bisa ubah data inti** (kandidat, votes, event settings) — hanya:
- Read semua data event
- Flag/log observation
- Validate (khusus verifier/verifikator): tandai voter "hadir" atau kandidat "layak"
- Add monitoring notes (tabel baru `election_observations`)

### D5: Auditability = prioritas #1
Setiap aksi committee/observer/admin yang signifikan HARUS tercatat di `audit_log` dengan:
- `actor_id` (siapa)
- `action` (apa)
- `target_type`/`target_id` (terkait apa)
- `election_id` (kolom baru — saat ini belum ada!)
- `metadata` (konteks tambahan)

---

## 2. Roadmap fase implementasi

```
FASE 1 (JANGKA PENDEK — 2-4 minggu)   → memenuhi kebutuhan lapangan
FASE 2 (JANGKA MENENGAH — 1-2 bulan)  → state machine & scope
FASE 3 (JANGKA PANJANG — 3-6 bulan)   → RBAC + hierarki organisasi + ballot
```

---

# FASE 1: Committee & Observer (JANGKA PENDEK)

> **Tujuan:** admin bisa invite panitia & observer per-election; mereka punya dashboard khusus untuk monitoring & validasi; tidak bisa ubah data inti.

## 1.1 Schema migration

### M1: Extend `app_role` enum
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'observer';
```

Catatan: `ADD VALUE` ke enum di PostgreSQL tidak bisa di-wrap dalam transaction yang sama dengan penggunaan nilai baru (limitation PG). Jadi migration ini berdiri sendiri.

### M2: Tabel `election_committees` (assignment per-election)
```sql
CREATE TYPE public.committee_role AS ENUM (
  'chair',         -- ketua panitia, bisa approve final
  'secretary',     -- sekretaris, adminstrasi
  'verifier',      -- verifikator, validasi data lapangan
  'technical',     -- teknis IT, monitoring sistem
  'member'         -- anggota biasa
);

CREATE TABLE IF NOT EXISTS public.election_committees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  committee_role  public.committee_role NOT NULL,
  appointed_by    UUID REFERENCES public.profiles(id),
  appointed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE(election_id, user_id, committee_role)
);

CREATE INDEX IF NOT EXISTS idx_election_committees_election
  ON public.election_committees(election_id);
CREATE INDEX IF NOT EXISTS idx_election_committees_user
  ON public.election_committees(user_id) WHERE revoked_at IS NULL;
```

### M3: Tambah `election_id` ke `audit_log`
```sql
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS election_id UUID REFERENCES public.election_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_election
  ON public.audit_log(election_id, created_at DESC);
```

### M4: Tabel `election_observations` (catatan monitoring)
```sql
CREATE TABLE IF NOT EXISTS public.election_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  observer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN
                    ('attendance', 'irregularity', 'technical', 'voter_question', 'other')),
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  description     TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observations_election
  ON public.election_observations(election_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_unresolved
  ON public.election_observations(election_id) WHERE resolved_at IS NULL;
```

### M5: Helper functions
```sql
-- Apakah user adalah committee/observer pada event tertentu?
CREATE OR REPLACE FUNCTION public.has_election_role(
  p_user_id     UUID,
  p_election_id UUID,
  p_role        public.app_role
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.election_committees ec
    WHERE ec.user_id = p_user_id
      AND ec.election_id = p_election_id
      AND ec.revoked_at IS NULL
      AND (
        (p_role = 'committee'::public.app_role AND ec.committee_role IN ('chair','secretary','verifier','technical','member'))
        OR (p_role = 'observer'::public.app_role AND ec.committee_role = 'member') -- observers stored as 'member' with separate flag? No, see M6
      )
  );
$$;
```

**Revisi M5:** observer disimpan sebagai role `observer` (bukan committee_role). Lebih bersih: `committee_role` hanya untuk committee, observer pakai flag terpisah. Tapi observer tetap di tabel yang sama:

```sql
-- Revisi: tambah kolom is_observer atau pakai role terpisah
-- Lebih bersih: pakai tabel berbeda ATAU kolom 'observer' di committee_role
-- Saya pilih: election_committees sudah khusus untuk committee. Observer pakai tabel TERPISAH.

CREATE TABLE IF NOT EXISTS public.election_observers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointed_by    UUID REFERENCES public.profiles(id),
  appointed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE(election_id, user_id)
);
```

```sql
-- Helper final
CREATE OR REPLACE FUNCTION public.has_election_role(
  p_user_id     UUID,
  p_election_id UUID,
  p_role        TEXT  -- 'committee' | 'observer'
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role = 'committee' THEN EXISTS (
      SELECT 1 FROM public.election_committees
      WHERE user_id = p_user_id AND election_id = p_election_id AND revoked_at IS NULL
    )
    WHEN p_role = 'observer' THEN EXISTS (
      SELECT 1 FROM public.election_observers
      WHERE user_id = p_user_id AND election_id = p_election_id AND revoked_at IS NULL
    )
    ELSE FALSE
  END;
$$;

-- Admin selalu dianggap punya semua election role
CREATE OR REPLACE FUNCTION public.can_access_election(
  p_user_id     UUID,
  p_election_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'admin'::app_role)
    OR public.has_election_role(p_user_id, p_election_id, 'committee')
    OR public.has_election_role(p_user_id, p_election_id, 'observer');
$$;
```

### M6: RLS untuk tabel baru
```sql
ALTER TABLE public.election_committees ENABLE ROW LEVEL SECURITY;

-- Admin: all
CREATE POLICY "Admins manage committees"
  ON public.election_committees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Committee user: SELECT row miliknya sendiri
CREATE POLICY "Committee members can view their assignments"
  ON public.election_committees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Chair bisa lihat semua committee di event yang sama
CREATE POLICY "Chairs can view all committee of their events"
  ON public.election_committees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.election_committees ec2
      WHERE ec2.election_id = election_committees.election_id
        AND ec2.user_id = auth.uid()
        AND ec2.committee_role = 'chair'
        AND ec2.revoked_at IS NULL
    )
  );

-- (Observer, observations: similar)
```

### M7: Extend invitation intent
```sql
-- invitations.intent sudah punya 'register', 'candidate', 'voter_group'
-- Tambah: 'committee', 'observer'
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_intent_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_intent_check CHECK (
    intent IN ('register', 'candidate', 'voter_group', 'committee', 'observer')
  );
```

Extend `accept_invitation_and_register`: setelah user dibuat, kalau `intent='committee'`, insert ke `election_committees` dengan role yang ditentukan di invitation metadata. Sama untuk `intent='observer'`.

### M8: Update `admin_create_user` signature (optional)
Tidak wajib. Admin bisa membuat user biasa, lalu assign sebagai committee via UI/separate RPC.

Lebih baik: RPC baru `admin_assign_committee(p_user_id, p_election_id, p_committee_role)` dan `admin_assign_observer(p_user_id, p_election_id)`.

## 1.2 Frontend

### F1: Admin UI — Kelola Panitia per Event
- `/admin/events/[id]/committee` (tab baru di EventDetail)
- Tabel: nama, NIM, role (chair/secretary/verifier/technical/member), status aktif, tanggal ditunjuk
- Tombol: "Undang Panitia" → buka `CreateInvitationDialog` dengan `intent='committee'`
- Tombol: "Undang Observer" → `intent='observer'`
- Aksi: revoke (set `revoked_at`), ganti role (hanya chair oleh admin)

### F2: Extend `CreateInvitationDialog`
Tambah field:
- intent dropdown: register / candidate / committee / observer
- kalau committee: committee_role dropdown + event selector
- kalau observer: event selector

### F3: Committee dashboard
Route baru: `/committee`
- Layout dengan sidebar (VoterLayout-style)
- Daftar election yang di-assign
- Klik election → detail:
  - Live vote count (read-only)
  - Daftar voter eligible (read-only, dengan status kehadiran)
  - Daftar kandidat (read-only)
  - Audit log election (read-only, filtered by `election_id`)
  - Form tambah observation
  - Kalau role=verifier: tombol "Tandai Voter Hadir" (insert ke tabel baru `voter_attendance` atau cukup audit log entry)
  - Kalau role=chair: tombol approval final (placeholder Fase 2)

### F4: Observer dashboard
Route baru: `/observer`
- Sama dengan committee tapi read-only total
- Tidak ada tombol aksi
- Hanya lihat data + tambah observation

### F5: Update `useAuth`
Tambah:
```ts
isCommittee: profile?.roles?.includes('committee') ?? false
isObserver: profile?.roles?.includes('observer') ?? false
```

Tambah helper `dashboardPathFor`:
```ts
if (profile.roles.includes('admin')) return '/admin/dashboard'
if (profile.roles.includes('committee')) return '/committee'
if (profile.roles.includes('observer')) return '/observer'
return '/app/dashboard'
```

### F6: ProtectedRoute
Tambah wrapper `<CommitteeRoute>` dan `<ObserverRoute>` yang cek role.

## 1.3 RPC baru untuk governance

```sql
-- Assign committee
CREATE OR REPLACE FUNCTION public.admin_assign_committee(
  p_user_id      UUID,
  p_election_id  UUID,
  p_role         public.committee_role
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can assign committee' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.election_committees (election_id, user_id, committee_role, appointed_by)
  VALUES (p_election_id, p_user_id, p_role, auth.uid())
  ON CONFLICT (election_id, user_id, committee_role) DO NOTHING
  RETURNING id INTO v_id;

  -- Audit
  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id,
                                description, election_id, metadata, severity)
  VALUES (auth.uid(), 'committee.assign', 'admin', 'election_committees', v_id::TEXT,
          'Committee member appointed', p_election_id,
          jsonb_build_object('assigned_user', p_user_id, 'role', p_role::TEXT), 'info');

  RETURN v_id;
END;
$$;

-- Revoke committee
CREATE OR REPLACE FUNCTION public.admin_revoke_committee(
  p_committee_id UUID,
  p_reason       TEXT DEFAULT 'admin_revoke'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_election UUID; v_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins' USING ERRCODE = '42501';
  END IF;

  SELECT election_id, user_id INTO v_election, v_user
    FROM public.election_committees WHERE id = p_committee_id;

  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Committee assignment not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_committees
     SET revoked_at = now()
   WHERE id = p_committee_id AND revoked_at IS NULL;

  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id,
                                description, election_id, severity)
  VALUES (auth.uid(), 'committee.revoke', 'admin', 'election_committees', p_committee_id::TEXT,
          'Committee revoked: ' || COALESCE(p_reason, ''), v_election, 'warning');
END;
$$;

-- Add observation
CREATE OR REPLACE FUNCTION public.add_election_observation(
  p_election_id  UUID,
  p_category     TEXT,
  p_severity     TEXT,
  p_description  TEXT,
  p_metadata     JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  -- Hanya admin, committee, atau observer dari event tsb
  IF NOT public.can_access_election(auth.uid(), p_election_id) THEN
    RAISE EXCEPTION 'Not authorised to observe this election' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.election_observations (election_id, observer_id, category, severity, description, metadata)
  VALUES (p_election_id, auth.uid(), p_category, p_severity, p_description, p_metadata)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id,
                                description, election_id, metadata, severity)
  VALUES (auth.uid(), 'election.observe', 'election', 'election_observations', v_id::TEXT,
          p_description, p_election_id, p_metadata, p_severity);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_election_observation(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
```

## 1.4 RLS untuk data read-only committee

Committee perlu SELECT ke `election_events`, `candidates`, `votes`, `event_voter_groups` SCOPED ke event mereka. Tapi RLS existing untuk tabel ini sudah cukup permisif (admin all) atau terlalu ketat (voter hanya sendiri). Solusi: tambah policy berbasis `can_access_election`:

```sql
-- candidates: committee bisa SELECT kandidat di event mereka
CREATE POLICY "Committee can view candidates of their elections"
  ON public.candidates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE e.id = candidates.event_id
        AND public.can_access_election(auth.uid(), e.id)
    )
  );
-- (candidates existing policy "Everyone can view candidates" sudah SELECT true,
--  jadi ini redundant. Cukup pastikan votes punya policy.)

-- votes: committee bisa SELECT votes di event mereka
CREATE POLICY "Committee can view votes of their elections"
  ON public.votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE e.id = votes.event_id
        AND public.can_access_election(auth.uid(), e.id)
    )
  );
```

Untuk INSERT/UPDATE/DELETE pada `votes` dan `candidates` — committee TIDAK BOLEH. Existing policies:
- votes INSERT: hanya `voter_id = auth.uid()` → committee tidak bisa insert (committee role bukan voter di event tsb kecuali diizinkan)
- votes UPDATE/DELETE: tidak ada policy → default deny
- candidates: hanya admin → committee tidak bisa

Cukup. Tidak perlu policy tambahan untuk block committee (existing sudah block).

## 1.5 Test plan

- `admin_assign_committee` RPC: admin bisa assign, non-admin gagal
- Committee login → /committee dashboard
- Committee akses event di luar assignment → 404 / unauthorized
- Committee tidak bisa INSERT ke votes (test via API attempt)
- Observer bisa lihat data tapi tidak ada tombol aksi
- `add_election_observation` tercatat di audit_log dengan `election_id` benar

## 1.6 Validasi Fase 1
- [ ] Migration applied: 7 tabel baru + 2 enum value + 3 RPC + 2 function helper + 4 RLS policy
- [ ] Admin UI: invite committee, assign role, lihat list, revoke
- [ ] Committee UI: dashboard, election detail, live count, observation form
- [ ] Observer UI: read-only dashboard
- [ ] Audit log: semua aksi committee tercatat dengan election_id
- [ ] Test: 100+ tests passing, tsc 0 error

---

# FASE 2: State Machine & Scope (JANGKA MENENGAH)

> **Tujuan:** election punya lifecycle yang proper dengan permission berbeda per fase; support election di berbagai scope (kelas, angkatan, fakultas, dll.)

## 2.1 Election state machine

Perluas `election_events.status`:
```
DRAFT
  ↓ (admin/owner)
REGISTRATION
  ↓ (auto: start_time reached)
VOTING
  ↓ (auto: end_time reached atau admin force close)
COUNTING
  ↓ (admin publishes)
PUBLISHED
  ↓ (admin archives)
ARCHIVED
```

Realisasi:
- Pakai `TEXT CHECK` constraint (existing sudah `TEXT`, tambah CHECK dengan allowed values)
- Tabel `election_state_transitions` untuk audit trail setiap perubahan status
- Trigger `tg_validate_election_state_transition` untuk enforce transisi valid
- View `current_election_state` untuk konsolidasi

## 2.2 Scope & eligibility

```sql
-- Tipe scope
CREATE TYPE public.election_scope_type AS ENUM (
  'university', 'faculty', 'department', 'program', 'cohort', 'class', 'organization'
);

ALTER TABLE public.election_events
  ADD COLUMN IF NOT EXISTS scope_type public.election_scope_type,
  ADD COLUMN IF NOT EXISTS scope_id UUID;

-- Tabel eligibility rules (fleksibel, tidak hardcode class)
CREATE TABLE IF NOT EXISTS public.election_eligibility_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL,  -- 'class_id', 'department', 'cohort', 'custom'
  rule_value      TEXT NOT NULL,  -- nilai (UUID, string, atau JSON untuk custom)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Voter eligibility check function:
```sql
CREATE OR REPLACE FUNCTION public.is_eligible_voter(p_user_id UUID, p_election_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class_id UUID;
  v_event_voter BOOLEAN;
BEGIN
  -- Cek explicit assignment dulu (event_voter_groups)
  SELECT class_id INTO v_class_id FROM public.profiles WHERE id = p_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.event_voter_groups evg
    WHERE evg.event_id = p_election_id AND evg.class_id = v_class_id
  ) INTO v_event_voter;

  IF v_event_voter THEN RETURN TRUE; END IF;

  -- Cek eligibility rules
  RETURN EXISTS (
    SELECT 1 FROM public.election_eligibility_rules r
    WHERE r.election_id = p_election_id
      AND (
        (r.rule_type = 'class_id' AND r.rule_value = v_class_id::TEXT)
        OR (r.rule_type = 'profile_id' AND r.rule_value = p_user_id::TEXT)
      );
  );
END;
$$;
```

## 2.3 State-specific permissions

| State | Admin | Chair | Committee | Observer | Voter |
|---|---|---|---|---|---|
| DRAFT | full | edit | view | view | — |
| REGISTRATION | full | edit | view | view | register |
| VOTING | read | read | read+validate | read+log | vote |
| COUNTING | read | read+tally | read | read | — |
| PUBLISHED | full | full | view | view | view result |
| ARCHIVED | read | read | read | read | view result |

## 2.4 RLS update

```sql
CREATE POLICY "State-based candidate visibility"
  ON public.candidates FOR SELECT TO authenticated
  USING (
    status = 'approved' OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE e.id = candidates.event_id
        AND e.status = 'draft'
        AND auth.uid() = candidates.user_id  -- candidate bisa lihat draft mereka sendiri
    )
  );
```

---

# FASE 3: RBAC & Organizational Hierarchy (JANGKA PANJANG)

> **Tujuan:** permission-based authorization penuh, hierarki organisasi proper, ballot terpisah dari vote, audit trail komprehensif.

## 3.1 Permission system

```sql
CREATE TYPE public.permission_key AS ENUM (
  'election.view', 'election.update', 'election.publish', 'election.delete',
  'candidate.create', 'candidate.review', 'candidate.approve', 'candidate.reject',
  'voter.verify', 'voter.manage',
  'vote.cast', 'vote.view', 'vote.count',
  'committee.manage', 'observer.manage',
  'result.review', 'result.publish',
  'audit.view', 'system.manage'
);

CREATE TABLE public.role_permissions (
  role          public.app_role NOT NULL,
  permission    public.permission_key NOT NULL,
  PRIMARY KEY (role, permission)
);

-- Seed default permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'system.manage'), ('admin', 'election.delete'), ('admin', 'audit.view'),
  ('committee', 'election.view'), ('committee', 'voter.verify'),
  ('committee', 'candidate.review'), ('committee', 'audit.view'),
  ('observer', 'election.view'), ('observer', 'audit.view'),
  ('voter', 'vote.cast'),
  ('candidate', 'candidate.create');
```

Helper:
```sql
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id UUID, p_permission public.permission_key
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Admin bypass
  SELECT CASE
    WHEN public.has_role(p_user_id, 'admin'::app_role) THEN TRUE
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = p_user_id AND rp.permission = p_permission
    )
  END;
$$;
```

Ganti semua `if (role === 'admin')` di frontend dengan `await supabase.rpc('has_permission', { p_permission: 'election.update' })`.

## 3.2 Organizational hierarchy

```sql
CREATE TABLE public.organizations (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('university', 'faculty', 'department', 'program')),
  parent_id   UUID REFERENCES public.organizations(id),
  UNIQUE(name, type, parent_id)
);

-- Tabel terpisah untuk positions (ganti role permanen)
CREATE TABLE public.organizational_positions (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  position    TEXT NOT NULL,  -- 'ketua_tingkat', 'kepala_jurusan'
  scope       JSONB NOT NULL DEFAULT '{}',  -- misal {cohort: 2026, class: 'TI-A'}
  start_date  DATE NOT NULL,
  end_date    DATE,  -- NULL = masih aktif
  appointed_by UUID REFERENCES public.profiles(id)
);
```

## 3.3 Ballot vs Vote (separated model)

```sql
CREATE TABLE public.ballots (
  id              UUID PRIMARY KEY,
  election_id     UUID NOT NULL REFERENCES public.election_events(id),
  voter_id        UUID NOT NULL REFERENCES public.profiles(id),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,  -- NULL = belum digunakan
  status          TEXT NOT NULL CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
  UNIQUE(election_id, voter_id)  -- 1 voter 1 ballot per election
);

-- votes ref ballots bukan voter_id
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS ballot_id UUID REFERENCES public.ballots(id);

-- Backward compat: voter_id tetap ada untuk sementara
```

**Keuntungan:** admin bisa tahu siapa yang punya hak memilih (ada ballot) vs siapa yang sudah memilih (ballot.used_at IS NOT NULL). Untuk confidentiality, bahkan correlation voter ↔ choice bisa dilemahkan dengan hash + salted vote (untuk blind ballot).

## 3.4 Comprehensive audit

```sql
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS election_id UUID,
  ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,  -- hashed untuk privacy
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS request_id UUID;

-- View untuk per-election audit
CREATE VIEW public.election_audit_trail AS
  SELECT al.*, p.full_name AS actor_name, p.student_id AS actor_student_id
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE al.election_id IS NOT NULL;
```

---

# 3. Checklist migrasi & rollout

| Tahap | Tabel baru | Enum baru | RPC baru | Migration | Frontend |
|---|---|---|---|---|---|
| **Fase 1** | 3 (`election_committees`, `election_observers`, `election_observations`) | 2 (committee_role + 2 app_role value) | 4 (assign/revoke committee, assign/revoke observer, add observation) | `20251106000000_*.sql` ×2 | Committee + Observer dashboard |
| **Fase 2** | 2 (`election_state_transitions`, `election_eligibility_rules`) | 1 (election_scope_type) | 2 (transition, is_eligible_voter) | `20251107000000_*.sql` | State machine UI di event admin |
| **Fase 3** | 5+ (`organizations`, `organizational_positions`, `ballots`, `role_permissions`, ...) | 1 (permission_key) | banyak | `20251108000000_*.sql` ×3+ | RBAC middleware, ballot issuance flow |

---

# 4. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Rewrite schema = kehilangan data | Backward-compatible migration; kolom baru nullable/default |
| Committee leak data cross-event | RLS scope via `can_access_election` per event_id |
| Observer accidentally modify data | RLS block + tidak ada tombol aksi di UI |
| Enum value ADD VALUE tidak bisa dalam transaction | Pisahkan migration khusus ALTER TYPE |
| Ballot redesign = invasive | Tabel ballots baru, votes.voter_id tetap ada sementara |
| Permission check jadi bottleneck | Cache di session; function SECURITY DEFINER + STABLE |
| User kebingungan dengan multiple dashboard | Clear routing di `dashboardPathFor`; auto-redirect |

---

# 5. Definisi Selesai per fase

## Fase 1
- [ ] Admin bisa invite panitia & observer via invitation
- [ ] Committee dashboard menampilkan data event yang ditugaskan
- [ ] Committee tidak bisa INSERT/UPDATE/DELETE data event (RLS block)
- [ ] Observer punya dashboard read-only
- [ ] Semua aksi tercatat di audit_log dengan election_id
- [ ] Tests passing, dokumentasi updated

## Fase 2
- [ ] Election state machine valid (transisi ilegal ditolak trigger)
- [ ] Scope-based election (university/faculty/etc) supported
- [ ] Eligibility rules fleksibel (tidak hardcode class)
- [ ] State-specific permissions tested

## Fase 3
- [ ] Permission-based authorization di seluruh frontend
- [ ] Organizational hierarchy lengkap
- [ ] Ballot issuance & vote recording terpisah
- [ ] Comprehensive audit trail dengan per-election filtering
- [ ] Confidential voting (optional: blind ballot)

---

# 6. Rujukan cepat

- **Visi lengkap**: `docs/gpt-response.md` (17 section)
- **Fix kritis sebelumnya**: `.kilo/plans/fix-critical-issues.md` (17 task, selesai)
- **Update dokumentasi**: `docs/Update_September_2026.md`, `docs/Update_Kritis_Fixes_September_2026.md`
- **Current schema**: 12 public tables (lihat §0)
- **Current role**: 3 (admin, voter, candidate)
- **Live DB**: `oiurjnmpkguyxevdbpbu` (UniVertex project)

> **Catatan akhir:** Fase 1 (committee + observer) adalah **quick win** yang langsung memenuhi kebutuhan operasional lapangan tanpa perlu redesign besar. Investasi ~1-2 minggu development, dampak langsung ke governance lapangan. Fase 2 dan 3 bisa direncanakan terpisah dengan diskusi requirement lebih lanjut.
