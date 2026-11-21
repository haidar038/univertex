Saya sudah membedah `main` branch repository UniVertex yang terakhir berubah pada **29 September 2026**, termasuk source React, 50 migration Supabase, RLS, RPC, test suite, CI, deployment config, dan dokumen go-live. Saya tidak menjadikan `univertex.vercel.app` sebagai bukti runtime karena live endpoint tidak berhasil saya akses dari browser tool; assessment di bawah berbasis codebase dan bukti testing yang tersimpan di repo.

[Repository UniVertex di GitHub](https://github.com/haidar038/univertex?utm_source=chatgpt.com)

# 1. Kesimpulan eksekutif

**UniVertex saat ini sudah jauh melewati level “demo aplikasi voting”.** Fondasinya sudah berupa sistem election-management yang cukup serius: ada lifecycle pemilihan, DPT/eligibility enforcement di database, RBAC berbasis permission, committee/observer, audit trail, session management, candidate approval, pair voting, automatic state transition, E2E testing, security testing, dan operational runbook.

Tetapi ada perbedaan besar antara:

> **“aplikasinya sudah berfungsi”**

dan

> **“sistemnya sudah pantas menjadi infrastructure pemilihan institusional.”**

Menurut kondisi repo saat ini, saya akan membaca statusnya seperti ini:

| Area penggunaan                                        | Kondisi saat ini                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Demo / testing internal                                | **Sudah**                                                                       |
| Digunakan oleh user terbatas untuk uji nyata           | **Secara teknis memungkinkan**                                                  |
| Controlled pilot kecil                                 | **Fondasi sudah ada, tetapi gate operasional masih belum seluruhnya terpenuhi** |
| Pemilihan lembaga yang membutuhkan secret ballot kuat  | **Belum**                                                                       |
| Production institutional election sebagai sistem utama | **Belum memenuhi seluruh requirement**                                          |
| Produk yang siap di-white-label ke banyak institusi    | **Belum**                                                                       |

Hal paling penting: repository sendiri masih menyatakan **P0-02 staging separation + restore drill belum selesai**, beberapa hardening Auth belum selesai, dan full load test belum terbukti. Bahkan `P0-Golive-Readiness-Plan.md` secara eksplisit menetapkan bahwa satu gate merah berarti pilot harus ditunda. [P0 Go-Live Readiness Plan](https://github.com/haidar038/univertex/blob/main/docs/P0-Golive-Readiness-Plan.md?utm_source=chatgpt.com)

Jadi, **bukan masalah bahwa UniVertex “belum jadi”**. Masalahnya adalah beberapa hal yang tersisa sekarang berada pada level **operational assurance dan election security**, bukan sekadar fitur UI.

---

# 2. Arsitektur UniVertex saat ini

Secara konseptual, arsitekturnya sekarang seperti ini:

```text
                         ┌─────────────────────┐
                         │       Vercel        │
                         │  Static SPA Hosting │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────┐
│                  React 19 + Vite SPA                    │
│                                                         │
│  Router / Layouts / Pages / Components / Hooks / Lib   │
│                                                         │
│  Admin     Voter/Candidate     Committee     Observer  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Supabase JS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                       Supabase                          │
│                                                         │
│ ┌─────────────┐   ┌──────────────────────────────────┐ │
│ │    Auth     │   │            PostgreSQL             │ │
│ │             │   │                                  │ │
│ │ login       │   │ elections / profiles / votes     │ │
│ │ sessions    │   │ candidates / DPT / RBAC          │ │
│ │ invitations │   │ committee / observer / audit     │ │
│ └─────────────┘   │ state machine / eligibility      │ │
│                   │ RPC / triggers / RLS              │ │
│                   └──────────────────────────────────┘ │
│                                                         │
│ Storage │ Realtime │ pg_cron                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │     Sentry       │
                 │ Observability    │
                 └──────────────────┘
```

Ini pada dasarnya adalah **serverless/BaaS architecture dengan PostgreSQL sebagai domain engine**.

Tidak ada conventional backend seperti Express/Nest/FastAPI. Business logic penting justru tersebar antara:

* React frontend
* Supabase Auth
* PostgreSQL RLS
* PostgreSQL RPC
* PostgreSQL trigger
* pg_cron

Untuk produk election platform, pendekatan ini masuk akal karena operasi kritis bisa dipaksa di database dan tidak hanya bergantung pada client.

---

# 3. Layer-by-layer architecture review

## A. Frontend

Stack saat ini cukup modern:

* Vite 5
* React 19
* TypeScript
* React Router
* Tailwind
* shadcn/Radix
* TanStack Query
* React Hook Form + Zod
* Sentry
* Vitest
* Playwright

`App.tsx` sudah punya pemisahan route berdasarkan domain:

```text
/public
/auth
/admin
/app
/committee
/observer
```

Dan layout pun dipisahkan:

```text
AdminLayout
VoterLayout
CommitteeLayout
ObserverLayout
```

Ini sudah lebih baik dibanding SPA CRUD biasa karena struktur produk mengikuti **bounded user roles**.

### Hal yang bagus

`ProtectedRoute` dan `RequirePermission` tidak hanya mengandalkan satu `role`.

Sudah ada permission model:

```text
election.*
candidate.*
vote.*
voter.*
committee.*
observer.*
audit.*
user.*
system.*
eligibility.*
```

Total ada **31 permission key** dalam sistem.

Jadi evolusinya sudah:

```text
Role-based
    ↓
Role + Permission
    ↓
Role + Permission + Election Scope
```

Ini fondasi yang benar kalau nanti UniVertex dipakai lebih banyak organisasi.

---

# 4. Database architecture adalah bagian paling kuat

Ini menurut saya bagian yang paling substantif dari UniVertex.

Database bukan hanya storage.

Ia sudah berfungsi sebagai **policy enforcement layer**.

## Election lifecycle

UniVertex mempunyai state machine:

```text
draft
   ↓
registration
   ↓
voting
   ↓
counting
   ↓
published
   ↓
archived
```

Dan transition tersebut ditegakkan di PostgreSQL, bukan hanya button frontend.

Ada:

* `election_state_transitions`
* trigger `validate_election_state_transition`
* `admin_transition_election_state`
* `auto_transition_elections`
* pg_cron setiap menit

Artinya seseorang tidak cukup hanya memanipulasi UI.

Frontend:

```text
"status = voting"
```

belum tentu cukup untuk membuat data menjadi voting karena database tetap mempunyai constraint/trigger.

Ini merupakan karakteristik penting untuk software election.

[Election state machine migration](https://github.com/haidar038/univertex/blob/main/supabase/migrations/20251108000000_phase2-state-machine-and-scope.sql?utm_source=chatgpt.com)

---

# 5. Vote integrity sudah jauh lebih serius daripada MVP

UniVertex sudah mempunyai beberapa lapisan:

### One voter → one vote

Ada database constraint:

```sql
UNIQUE (voter_id, event_id)
```

Jadi double-click atau race condition tidak hanya bergantung kepada frontend.

### Timeline enforcement

Database juga memastikan:

```text
status = voting
start_time <= now()
now() <= end_time
```

### Identity enforcement

Migration terbaru menambahkan:

```text
NEW.voter_id = auth.uid()
```

Jadi user tidak dapat mengirim:

```text
voter_id = orang lain
```

menggunakan client biasa.

### Eligibility enforcement

Sekarang ada:

```text
is_eligible_voter()
```

dan trigger:

```text
tg_enforce_vote_timeline()
```

yang memastikan DPT tetap diverifikasi di database.

Jadi flow-nya kurang lebih:

```text
UI check
   ↓
RLS check
   ↓
trigger
   ↓
eligibility check
   ↓
timeline check
   ↓
UNIQUE constraint
   ↓
INSERT vote
```

Ini bagus.

[Vote integrity migration](https://github.com/haidar038/univertex/blob/main/supabase/migrations/20251104000000_add_votes_unique_constraint_and_timeline_check.sql?utm_source=chatgpt.com)
[Eligibility enforcement migration](https://github.com/haidar038/univertex/blob/main/supabase/migrations/20260913000000_enforce_eligibility_on_vote.sql?utm_source=chatgpt.com)

---

# 6. Tetapi ada satu masalah arsitektur yang jauh lebih besar: secret ballot

Ini adalah hal yang paling perlu Anda bedakan.

Model data sekarang:

```text
votes
├── voter_id
├── event_id
├── candidate_id
└── pair_id
```

Dengan kata lain database menyimpan hubungan:

```text
User A → memilih Candidate B
```

Secara langsung.

Bahkan committee/observer tertentu memiliki akses read terhadap vote berdasarkan election scope.

Jadi:

> **private result ≠ secret ballot**

Misalnya election `closed` tidak menampilkan hasil kepada publik.

Itu tidak berarti pilihan voter secara kriptografis/unlinkably rahasia.

Kalau seseorang yang memiliki privileged database access atau role yang memiliki `vote.view` membaca dataset, hubungan voter → kandidat masih dapat direkonstruksi.

Ini konsisten dengan roadmap repo sendiri yang masih menunda:

> **Ballot vs Vote separation / redesign secrecy `ballots`**

Jadi secara desain sekarang UniVertex lebih tepat dianggap sebagai:

```text
Accountable digital voting system
```

daripada:

```text
Strong secret-ballot election system
```

Untuk pemilihan organisasi yang membutuhkan secrecy formal, ini merupakan gap fundamental.

---

# 7. DPT dan eligibility architecture

Ini sudah cukup sophisticated.

Ada dua mekanisme:

```text
event_voter_groups
```

dan:

```text
election_eligibility_rules
```

Konsepnya:

```text
Election
   │
   ├── Class
   ├── User/Profile
   ├── Department
   ├── Cohort
   ├── Organization
   └── Custom
```

Namun implementasinya belum sepenuhnya konsisten.

`election_eligibility_rules` memang menerima beberapa `rule_type`, tetapi `is_eligible_voter()` yang sekarang terutama mengimplementasikan:

```text
class_id
profile_id
```

sementara beberapa tipe lain masih belum benar-benar mempunyai resolver domain penuh.

Hal serupa terjadi pada `scope_type`:

```text
university
faculty
department
program
cohort
class
organization
```

tetapi `validate_scope_id()` belum mempunyai entity table untuk seluruh hierarchy tersebut.

Jadi secara arsitektur:

```text
schema designed for future hierarchy
```

lebih maju daripada:

```text
current domain implementation
```

Ini penting sebelum Anda menjual narasi "universal university election platform".

---

# 8. Governance architecture sudah mulai menarik

UniVertex sekarang bukan cuma:

```text
Admin
Voter
Candidate
```

tetapi:

```text
Admin
Voter
Candidate
Committee
Observer
```

Dan committee/observer sudah election-scoped.

Contoh:

```text
Election A
 ├── Committee Chair
 ├── Committee Verifier
 ├── Committee Technical
 └── Observer

Election B
 ├── Committee berbeda
 └── Observer berbeda
```

Ini merupakan desain yang tepat untuk operasional pemilihan sebenarnya karena **permission tidak lagi harus global**.

Ada juga:

* observation log
* committee assignment
* observer assignment
* election-scoped audit
* audit export

Artinya UniVertex mulai bergerak dari:

> "website untuk voting"

menjadi:

> "operational system untuk menyelenggarakan election."

Itu adalah pergeseran nilai produk yang cukup besar.

[Committee & Observer architecture](https://github.com/haidar038/univertex/blob/main/supabase/migrations/20251106000000_add_committee_observer_roles.sql?utm_source=chatgpt.com)

---

# 9. Audit architecture

Audit subsystem saat ini cukup matang.

Ada:

```text
audit_log
    ↓
request_id
ip_address_hash
schema_version
election_id
severity
metadata
actor
target
```

Lalu:

```text
audit.correction
```

untuk koreksi secara append-oriented.

Ada juga:

```text
audit_archive
```

dengan retention melalui `pg_cron`.

Export menggunakan RPC dengan permission:

```text
audit.export
```

dan limit export dibatasi.

Ini penting untuk lembaga karena setelah election selesai pertanyaan yang muncul biasanya bukan:

> "Apakah website bekerja?"

tetapi:

> "Siapa melakukan apa, kapan, terhadap election mana?"

UniVertex sudah mulai menyediakan jawabannya.

---

# 10. Security architecture

Ada cukup banyak defense-in-depth:

### Frontend

* Protected routes
* Permission gates
* Error boundary
* global error handler
* Sentry

### Supabase

* RLS
* SECURITY DEFINER RPC
* DB triggers
* explicit grants/revokes
* vote constraints
* session revocation
* eligibility enforcement

### Deployment

`vercel.json` sudah mengatur:

* HSTS
* CSP
* X-Frame-Options
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* immutable asset cache

### Testing

Repo mencatat:

* Vitest
* Playwright
* k6
* ZAP
* forced-vote test
* brute-force test
* non-DPT test
* double-vote test
* revoke-session test

Ini jauh lebih baik daripada aplikasi CRUD yang hanya punya `if (!user) return`.

---

# 11. Tetapi security posture masih punya beberapa masalah penting

## A. PII exposure

Current policy masih mempunyai model seperti:

```text
profiles SELECT = true
```

dan `profiles` menyimpan:

```text
full_name
student_id
department
```

Sementara `event_voter_groups` juga mempunyai access yang sangat luas.

Artinya ada kemungkinan informasi identitas mahasiswa dapat diakses lebih luas daripada yang sebenarnya diperlukan oleh public application.

Untuk sistem institusi, prinsip yang lebih tepat:

```text
Public
    ↓
minimum election metadata

Authenticated voter
    ↓
minimum own profile + eligible election

Committee
    ↓
minimum election-scoped operational data

Admin
    ↓
full administrative data
```

bukan:

```text
everyone → profiles
```

Ini salah satu hal yang saya anggap perlu dibereskan sebelum institutional deployment.

---

## B. Hardcoded default admin credential

Repository masih mempunyai default admin credential di:

```text
scripts/setup-admin.js
scripts/setup-admin.ts
```

Walaupun itu mungkin berasal dari fase awal development, credential tersebut tidak seharusnya tetap tertanam di source.

Minimal:

```text
remove hardcoded credential
rotate credential
use runtime env / one-time bootstrap
```

dan kalau credential tersebut pernah digunakan pada deployment nyata, perlakukan sebagai compromised credential dan lakukan rotation.

[Admin bootstrap script](https://github.com/haidar038/univertex/blob/main/scripts/setup-admin.js?utm_source=chatgpt.com)

---

# 12. Production engineering

Di sisi engineering process, repo sebenarnya cukup bagus.

Sudah ada CI:

```text
checkout
   ↓
npm ci
   ↓
typecheck
   ↓
unit test
   ↓
coverage
   ↓
lint
   ↓
build
   ↓
security audit
```

Ada juga preview workflow.

Tetapi terdapat satu detail:

```yaml
npm audit --audit-level=high
continue-on-error: true
```

Artinya security audit saat ini **tidak menjadi hard gate**.

Jadi:

```text
security issue
       ↓
CI warning
       ↓
merge tetap mungkin
```

Untuk production institution, biasanya lebih tepat membedakan:

```text
blocking vulnerabilities
vs
accepted risk
```

secara eksplisit.

[CI workflow](https://github.com/haidar038/univertex/blob/main/.github/workflows/ci.yml?utm_source=chatgpt.com)

---

# 13. Testing maturity

Ada bukti yang cukup kuat bahwa Anda memang menguji sistem, bukan sekadar menulis test untuk vanity.

Changelog menunjukkan:

* 7/7 skenario P1-01 hijau
* UAT 10/10
* force-vote test
* brute-force test
* ZAP tanpa High
* k6 smoke test
* TypeScript 0 error
* build sukses

Ini positif.

Tetapi jangan salah membaca angka coverage.

Coverage yang menjadi CI gate hanya mencakup:

```text
src/lib
src/hooks
VotingPage.tsx
```

bukan seluruh application.

Dokumentasi sendiri menyebut whole-app shadow coverage sekitar **15.66%**.

Jadi:

> **core security/domain logic cukup mendapat perhatian, tetapi UI/admin surface masih belum mempunyai coverage menyeluruh.**

Ini masuk akal untuk fase sekarang, tetapi menjadi concern ketika banyak administrator akan mengoperasikan sistem pada hari pemilihan.

---

# 14. Performance / scalability

Bukti yang ada sekarang:

```text
k6
2 VU
30 seconds
read-only
p95 132ms
max 199ms
```

Ini menunjukkan sistem dapat melayani smoke traffic dengan baik.

Tetapi belum membuktikan:

```text
200 users
500 users
1000 users
2000 concurrent users
```

pada election day.

Dan repo sendiri menyatakan test 200 VU dan stretch 2000 user **tidak dijalankan terhadap production**.

Itu keputusan yang benar secara safety, tetapi consequence-nya sederhana:

> **capacity envelope UniVertex belum terbukti.**

Untuk kampus kecil dengan ratusan voter, masalahnya kemungkinan bukan arsitektur fundamental. Tetapi belum ada evidence yang cukup untuk mengklaim kapasitas election-day tertentu.

---

# 15. Operasional adalah bottleneck utama saat ini

Ini bagian yang menurut saya paling penting.

Secara code:

```text
✅ authentication
✅ authorization
✅ vote enforcement
✅ audit
✅ election lifecycle
✅ session management
✅ E2E
✅ security testing
```

Tetapi infra operational:

```text
❌ staging environment terpisah
❌ full restore drill
❌ verified RTO/RPO
△ MFA
△ CAPTCHA
△ SMTP delivery consistency
△ full-load test
```

Repository sendiri masih menyatakan:

> production dan development masih berbagi project Supabase karena slot environment terbatas.

Ini berarti perubahan schema atau eksperimen database masih mempunyai blast radius ke environment yang sama.

Untuk aplikasi biasa itu sudah tidak ideal.

Untuk election system, itu merupakan risiko operasional yang jauh lebih besar.

---

# 16. Jadi apa sebenarnya value UniVertex?

Menurut saya value paling besar bukan pada fitur voting-nya sendiri.

Voting form sebenarnya mudah dibuat.

Value UniVertex ada pada **operational control layer di sekeliling voting**.

## Value 1 — Mengubah election dari event manual menjadi workflow digital

Daripada:

```text
Excel
WhatsApp
Google Form
manual recap
manual verification
```

UniVertex menyediakan:

```text
Create election
      ↓
Define eligibility
      ↓
Register candidates
      ↓
Candidate approval
      ↓
Assign committee/observer
      ↓
Open election
      ↓
Vote enforcement
      ↓
Automatic state transition
      ↓
Tally
      ↓
Publish
      ↓
Audit/export
      ↓
Archive
```

Itu jauh lebih bernilai daripada sekadar “website untuk memilih”.

---

## Value 2 — Enforcement berada di database

Ini salah satu differentiator teknis terbesar.

Misalnya frontend direkayasa buruk:

```js
button.disabled = false
```

hal itu tidak otomatis memungkinkan vote ilegal.

Database masih memeriksa:

```text
identity
eligibility
timeline
status
uniqueness
```

Ini adalah architecture yang jauh lebih defensible.

---

## Value 3 — Governance

Committee dan observer membuat platform lebih cocok untuk organisasi yang memiliki:

* panitia
* verifikator
* pengawas
* admin teknis
* dokumentasi insiden

Bukan hanya satu admin yang mengontrol semuanya.

---

## Value 4 — Auditability

Untuk institution, audit trail sering lebih berharga daripada dashboard yang cantik.

UniVertex sudah mempunyai:

```text
who
what
when
where/target
election
severity
metadata
```

plus export.

Ini membuat election dapat diperlakukan sebagai **auditable process**, bukan hanya database transaction.

---

## Value 5 — Reusability

Model:

```text
election_events
event_voter_groups
eligibility_rules
candidate_pairs
committee
observer
```

membuat satu installation dapat menjalankan banyak election.

Misalnya:

```text
2026 BEM Faculty
2026 HIMA
2026 Student Senate
2026 Election Committee
```

tanpa membuat aplikasi baru setiap kali.

---

# 17. Yang menurut saya membuat UniVertex belum institutional-ready

Ada 7 hal utama.

| Gap                             | Dampak                                                                      |
| ------------------------------- | --------------------------------------------------------------------------- |
| **Ballot secrecy**              | voter-choice relationship masih dapat direkonstruksi                        |
| **Staging separation**          | perubahan/testing berisiko ke environment yang sama                         |
| **Restore drill**               | disaster recovery belum benar-benar terbukti                                |
| **Auth hardening**              | MFA/CAPTCHA/SMTP belum seluruhnya selesai                                   |
| **PII RLS**                     | profile/DPT exposure terlalu luas                                           |
| **Eligibility/scope semantics** | beberapa rule/scope sudah ada di schema tetapi belum sepenuhnya implemented |
| **Capacity evidence**           | election-day concurrent load belum terbukti                                 |

Dua yang paling fundamental:

### Security model

```text
voter_id → vote → candidate
```

masih linkable.

### Operational model

```text
production
    =
development/shared Supabase
```

masih terlalu berisiko untuk election infrastructure.

---

# 18. Kalau saya tempatkan UniVertex pada lifecycle produk

Bukan dengan skor, tetapi berdasarkan kemampuan nyata:

```text
Prototype
   │
   ▼
Functional MVP
   │
   ▼
Production-shaped application
   │
   ▼
Controlled pilot
   │
   ▼
Institutional production
   │
   ▼
High-assurance election infrastructure
```

UniVertex saat ini sudah berada **setelah functional MVP** dan mempunyai banyak karakteristik production-shaped system.

Namun repository sendiri belum mendukung klaim bahwa ia sudah melewati seluruh requirement **controlled pilot/institutional production**, karena beberapa gate operasional masih merah. Dan untuk **high-assurance secret ballot**, arsitektur ballot saat ini belum memenuhi model tersebut.

---

# 19. Arsitektur yang saya sarankan untuk evolusi berikutnya

Saya tidak akan menyarankan rewrite.

Fondasi sekarang cukup bagus. Yang diperlukan adalah evolusi.

### Target domain model

```text
                    Election
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     Eligibility     Ballot       Governance
          │            │            │
       voter         issued       committee
       rules         used         observer
          │            │            │
          └────────────┼────────────┘
                       ▼
                     Vote
                       │
                       ▼
                     Tally
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         Publication           Audit
```

Yang sekarang:

```text
voter
  │
  └──────► votes ◄──── candidate
```

perlu berevolusi menjadi model yang memisahkan:

```text
eligibility / ballot issuance
              │
              ▼
          anonymous vote
              │
              ▼
            tally
```

sehingga Anda bisa mendapatkan:

```text
one-person-one-vote
+
eligibility enforcement
+
auditability
+
ballot secrecy
```

tanpa mempertahankan direct voter → candidate linkage.

---

# 20. Prioritas engineering berikutnya

Urutan teknis yang paling masuk akal menurut kondisi repo saat ini:

### Gate 1 — Operational isolation

```text
Supabase Production
        ≠
Supabase Staging
```

plus:

```text
Vercel Production → Production DB
Vercel Preview    → Staging DB
```

dan lakukan:

```text
backup
restore
measure RTO
measure RPO
```

### Gate 2 — Security boundary

Perketat:

```text
profiles
event_voter_groups
candidate data
audit views
```

agar public hanya mendapat data yang memang public.

### Gate 3 — Auth

Selesaikan:

```text
MFA admin
MFA committee/technical
CAPTCHA
SMTP
account recovery
session policy
```

serta hapus credential bootstrap hardcoded.

### Gate 4 — Ballot architecture

Ini adalah pekerjaan paling substantif untuk election security:

```text
eligibility
     ↓
ballot issuance
     ↓
anonymous vote
     ↓
tally
```

### Gate 5 — Capacity

Staging:

```text
50
100
200
500
1000
```

dan uji:

* login burst
* election page
* candidate list
* vote submission
* tally
* realtime
* DB connection / RPC saturation

### Gate 6 — Productization

Tambahkan:

```text
license
tenant/organization model
institution onboarding
domain configuration
data retention policy
formal backup procedure
incident response
operator handbook
```

---

# 21. Verdict teknis

Kalau saya mereduksinya menjadi satu kalimat:

> **UniVertex sudah merupakan software election-management yang nyata dan cukup serius, bukan lagi MVP biasa; tetapi belum seharusnya diposisikan sebagai infrastructure pemilihan institusional dengan security assurance tinggi sebelum operational isolation, auth hardening, privacy/RLS, disaster recovery, capacity validation, dan terutama ballot secrecy diselesaikan.**

Untuk **penggunaan user terbatas, testing, demonstrasi, dan controlled pilot**, codebase-nya sudah mempunyai fondasi yang relevan dan sebagian besar kontrol inti sudah benar.

Untuk **pemilihan lembaga yang konsekuensinya tinggi**, status repository saat ini sendiri masih memberi sinyal **belum selesai secara operational**: staging/restore masih pending, beberapa auth controls belum selesai, dan model vote masih linkable ke voter.

Dengan kata lain, **nilai terbesar UniVertex saat ini justru sudah bergeser dari “aplikasi voting” menjadi “platform operasional pemilihan”**. Tinggal satu lompatan arsitektural yang besar untuk membuatnya menjadi sistem yang benar-benar matang: memisahkan **identity/eligibility**, **ballot**, **vote**, **tally**, dan **audit** secara formal.

[CHANGELOG UniVertex — status testing & go-live gate](https://github.com/haidar038/univertex/blob/main/CHANGELOG.md?utm_source=chatgpt.com)
