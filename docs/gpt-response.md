Ya. Masalah utama dari skema sekarang bukan pada konsep **voter/candidate**, tetapi pada **governance dan lifecycle sebuah election**.

Saat ini `Admin` terlalu dominan:

> Admin membuat kelas → memasukkan peserta → menentukan kandidat → membuka pemilihan → voter memilih.

Untuk sistem university election yang proper, sebaiknya aplikasi tidak memodelkan **“admin mengelola pemilihan”**, tetapi **“sebuah election memiliki organisasi penyelenggara, struktur kepanitiaan, aturan, tahapan, dan scope peserta sendiri.”**

## 1. Ubah model mental: User ≠ Role Election

Ini bagian paling penting.

Jangan terlalu mengikat role ke user seperti:

```text
User
 ├── voter
 └── candidate
```

Lebih baik bedakan:

### Platform Role

Siapa yang mengelola sistem secara keseluruhan.

```text
SUPER_ADMIN
SYSTEM_ADMIN
```

Misalnya hanya bertanggung jawab terhadap:

* university/organization
* konfigurasi sistem
* user management
* security
* audit
* tenant/organization

### Election Role

Siapa seseorang **di dalam suatu election tertentu**.

```text
ELECTION_OWNER
ELECTION_ADMIN
COMMITTEE
VERIFIER
OBSERVER
VOTER
CANDIDATE
```

Seorang user bisa memiliki kombinasi role yang berbeda pada election berbeda.

Contoh:

```text
Haidar
Platform Role:
  SYSTEM_ADMIN

Election A:
  COMMITTEE
  CANDIDATE

Election B:
  VOTER

Election C:
  ELECTION_OWNER
  VOTER
```

Ini jauh lebih scalable.

---

# 2. Struktur organisasi yang lebih proper

Saya akan membuat hierarchy seperti ini:

```text
University / Organization
        │
        ├── Academic Structure
        │      ├── Faculty
        │      ├── Department
        │      ├── Program
        │      ├── Class / Cohort
        │      └── Student
        │
        └── Elections
               ├── Election A
               ├── Election B
               └── Election C
```

Kemudian setiap election punya governance sendiri.

```text
Election
│
├── Election Committee
│    ├── Chairperson
│    ├── Secretary
│    ├── Treasurer
│    ├── Technical
│    └── Members
│
├── Candidates
│
├── Voters
│
├── Rules
│
├── Timeline
│
├── Voting
│
└── Results
```

Dengan begitu **Admin platform tidak perlu ikut campur dalam setiap event**.

---

# 3. Role yang saya rekomendasikan

Untuk tahap awal, jangan membuat 15 role. Gunakan beberapa role yang jelas.

| Role               | Tanggung jawab                        |
| ------------------ | ------------------------------------- |
| `SYSTEM_ADMIN`     | Mengelola platform                    |
| `ELECTION_OWNER`   | Pemilik/pihak yang membentuk election |
| `ELECTION_MANAGER` | Mengelola operasional election        |
| `COMMITTEE`        | Panitia pelaksana                     |
| `VERIFIER`         | Memverifikasi voter/candidate         |
| `OBSERVER`         | Melihat progress/audit                |
| `VOTER`            | Memberikan suara                      |
| `CANDIDATE`        | Peserta kandidat                      |

Kemudian tambahkan **organizational role** terpisah.

Misalnya:

```text
Student
Class Leader
Head of Cohort
Department Representative
Committee Member
Election Chair
```

Ini penting karena:

> **“Ketua tingkat” bukan necessarily role sistem global.**

Dia adalah seseorang yang memegang jabatan tertentu pada scope tertentu.

---

# 4. Jangan jadikan "Ketua Tingkat" sebagai role permanen

Misalnya:

```text
Haidar
role = KETUA_TINGKAT
```

Ini kurang bagus.

Karena tahun berikutnya bisa saja orang berbeda.

Lebih proper:

```text
Person
   ↓
Position Assignment
   ↓
Cohort 2026
   ↓
Position: Ketua Tingkat
```

Contoh:

```text
Haidar
└── Class Membership
      └── Class: TI-2026-A

Haidar
└── Organization Position
      ├── Position: Ketua Tingkat
      ├── Scope: TI-2026-A
      └── Active: true
```

Dengan demikian sistem dapat mengetahui:

> “Siapa ketua tingkat TI-2026-A sekarang?”

tanpa hardcode role.

---

# 5. Election harus punya "scope"

Ini juga bagian yang sekarang belum terlihat pada desainmu.

Tidak semua election adalah election universitas.

Bisa ada:

```text
University Election
Faculty Election
Department Election
Program Election
Cohort Election
Class Election
Organization Election
```

Maka:

```text
Election
├── scope_type
└── scope_id
```

Contoh:

```text
Election:
  "Pemilihan Ketua Angkatan 2026"

scope_type:
  COHORT

scope_id:
  TI-2026
```

Sehingga sistem otomatis dapat menentukan:

```text
Eligible Voters
= members of TI-2026
```

Bukan admin memasukkan voter satu per satu.

---

# 6. Pisahkan "membership" dari "voting eligibility"

Ini kesalahan umum dalam election system.

Misalnya:

```text
User = mahasiswa TI 2026
```

Tidak otomatis berarti:

```text
eligible to vote
```

Kamu perlu:

```text
Election
      ↓
Eligibility Rule
      ↓
Eligible Voter
```

Contoh rule:

```text
Election:
Ketua Himpunan TI 2026

Eligibility:
- Program = Informatika
- Cohort = 2026
- Status = Active Student
- Registered before = 2026-09-01
```

Bisa diimplementasikan menjadi:

```text
Election Eligibility
├── organization_scope
├── faculty_id
├── department_id
├── program_id
├── cohort_id
├── class_id
└── custom_rule
```

Kemudian sistem menghasilkan voter list.

---

# 7. Candidate jangan ditentukan langsung oleh Admin

Ini salah satu perubahan terbesar yang saya sarankan.

Jangan:

```text
Admin
  ↓
Add Candidate
```

Lebih baik:

```text
Election
  ↓
Candidate Registration
  ↓
Candidate Application
  ↓
Verification
  ↓
Approved Candidate
```

Contohnya:

```text
Candidate Registration
        │
        ├── Submit
        │
        ├── Verify requirements
        │
        ├── Committee review
        │
        ├── Approved
        │
        └── Published
```

Candidate bisa mengajukan dirinya sendiri.

Atau bisa ada:

```text
Self nomination
Nomination by member
Nomination by representative
```

Kemudian panitia/verifier melakukan validasi.

---

# 8. Election lifecycle

Saya justru akan membuat election sebagai **state machine**.

Misalnya:

```text
DRAFT
  ↓
REGISTRATION
  ↓
CANDIDATE_VERIFICATION
  ↓
CAMPAIGN
  ↓
READY
  ↓
VOTING
  ↓
CLOSED
  ↓
COUNTING
  ↓
RESULT_REVIEW
  ↓
PUBLISHED
  ↓
ARCHIVED
```

Ini jauh lebih aman daripada sekadar:

```text
is_active = true
```

Karena setiap fase memiliki permission berbeda.

Contohnya:

### `DRAFT`

Panitia dapat:

* membuat aturan
* menentukan scope
* mengatur timeline
* menentukan eligibility

### `REGISTRATION`

Mahasiswa dapat:

* register sebagai voter
* submit candidate application

### `VERIFICATION`

Panitia dapat:

* approve/reject candidate
* verify voter
* resolve disputes

### `VOTING`

Hanya:

```text
Voter → Vote
```

Panitia **tidak boleh mengubah candidate** pada tahap ini.

### `CLOSED`

Voting berhenti.

### `RESULT_REVIEW`

Panitia/observer dapat memeriksa hasil dan audit.

### `PUBLISHED`

Hasil dipublikasikan.

---

# 9. Tambahkan konsep "Election Committee"

Ini akan menjawab kebutuhanmu mengenai ketua tingkat dan panitia.

Contohnya:

```text
Election
│
└── Committee
      │
      ├── Chair
      ├── Vice Chair
      ├── Secretary
      ├── Verification
      ├── Technical
      └── Member
```

Database conceptually:

```text
election_committee
------------------
id
election_id
user_id
committee_role
permissions
```

Misalnya:

```text
committee_role:
  CHAIR
  VICE_CHAIR
  SECRETARY
  VERIFIER
  TECHNICAL
  MEMBER
```

Kemudian permission tidak harus identik dengan role.

Contoh:

```text
CHAIR
  → manage_election
  → approve_candidate
  → publish_result

VERIFIER
  → verify_candidate
  → verify_voter

TECHNICAL
  → manage_election_config
  → monitor_system

OBSERVER
  → view_audit
  → view_progress
```

---

# 10. Election Owner

Menurut saya ini role yang sangat penting.

Karena:

> `SYSTEM_ADMIN` seharusnya tidak menjadi pihak yang menyelenggarakan election.

Misalnya:

```text
SYSTEM_ADMIN
       │
       └── creates organization
               │
               └── University
                       │
                       ├── Election Owner
                       │
                       └── Election Committee
```

Contoh:

```text
University
   ↓
Student Senate
   ↓
Election Owner
   ↓
Election Committee
```

Atau:

```text
Faculty
   ↓
Department
   ↓
Head of Cohort
   ↓
Election Committee
```

Jadi administrator platform hanya memastikan platform berjalan.

---

# 11. Alur yang saya rekomendasikan

Secara keseluruhan:

```text
                    UNIVERSITY
                        │
                        ▼
                  ORGANIZATION
                        │
                        ▼
                ELECTION OWNER
                        │
                        ▼
             CREATE ELECTION EVENT
                        │
                        ▼
              DEFINE ELECTION SCOPE
                        │
                        ▼
              DEFINE ELIGIBILITY RULE
                        │
                        ▼
                FORM COMMITTEE
                        │
                        ▼
              OPEN REGISTRATION
                    /       \
                   /         \
               VOTER       CANDIDATE
                 │              │
                 │              ▼
                 │        APPLICATION
                 │              │
                 │              ▼
                 │        VERIFICATION
                 │              │
                 │              ▼
                 │        APPROVED
                 │
                 ▼
            ELIGIBLE VOTER
                 │
                 └──────────────┐
                                ▼
                         VOTING PERIOD
                                │
                                ▼
                            VOTING CLOSED
                                │
                                ▼
                          RESULT COUNTING
                                │
                                ▼
                           RESULT REVIEW
                                │
                                ▼
                         RESULT PUBLISHED
                                │
                                ▼
                            ARCHIVED
```

Ini sudah mulai terlihat seperti **actual election management platform**, bukan sekadar voting app.

---

# 12. Bahkan voting-nya jangan langsung menyimpan "user → candidate"

Secara konsep, sebaiknya ada entitas:

```text
Election
ElectionBallot
Vote
```

Contoh:

```text
Election
   │
   └── Ballot
         │
         ├── voter_id
         ├── election_id
         ├── issued_at
         ├── used_at
         └── status
```

Kemudian:

```text
Vote
├── ballot_id
├── candidate_id
└── submitted_at
```

Tujuannya agar kamu bisa membedakan:

> **Siapa yang memiliki hak memilih**

dengan:

> **Siapa yang dipilih.**

Untuk election yang membutuhkan confidentiality lebih tinggi, relasi identitas voter dan pilihan suara bahkan perlu dipisahkan lebih jauh supaya administrator tidak bisa dengan mudah melakukan korelasi voter → candidate.

---

# 13. Audit log wajib ada

Karena ini sistem election.

Setiap tindakan penting harus tercatat:

```text
Audit Log

WHO
WHAT
WHEN
WHERE
TARGET
OLD VALUE
NEW VALUE
```

Contoh:

```text
User:
Haidar

Action:
APPROVE_CANDIDATE

Target:
Candidate #123

Time:
2026-09-07 15:31

Result:
SUCCESS
```

Contoh lain:

```text
Election Manager
→ changed voting end date

Election:
Student Council Election 2026

From:
10 Sept 18:00

To:
10 Sept 20:00
```

Untuk sistem voting, auditability jauh lebih penting daripada sekadar UI yang bagus.

---

# 14. Saya akan mengubah model data-mu menjadi kira-kira seperti ini

Secara konseptual:

```text
User
 │
 ├── Profile
 │
 ├── OrganizationMembership
 │
 ├── AcademicMembership
 │
 ├── OrganizationPosition
 │
 └── ElectionMembership
        │
        ├── VOTER
        ├── CANDIDATE
        ├── COMMITTEE
        ├── VERIFIER
        └── OBSERVER
```

Lalu:

```text
Organization
 ├── AcademicUnit
 ├── Class
 ├── Cohort
 └── Elections
```

Dan:

```text
Election
 ├── Scope
 ├── EligibilityRules
 ├── Committee
 ├── CandidateApplications
 ├── VoterEligibility
 ├── Ballots
 ├── Votes
 ├── Timeline
 ├── Results
 └── AuditLogs
```

---

# 15. Contoh konkret

Misalkan ada:

> **Pemilihan Ketua Tingkat Informatika 2026**

Maka flow-nya:

```text
University
    │
    └── Informatics Department
            │
            └── Cohort 2026
                    │
                    ├── 120 Students
                    │
                    └── Election
                          "Ketua Tingkat 2026"
```

Election owner:

```text
Ketua Departemen
```

Committee:

```text
Election Chair
Election Secretary
2 Verifiers
2 Technical Committee
```

Eligibility:

```text
Department = Informatics
Cohort = 2026
Student Status = Active
```

Candidate registration:

```text
Student A → Nominate
Student B → Nominate
Student C → Nominate
```

Committee:

```text
verify requirements
      ↓
approve A/B/C
```

Voting:

```text
120 eligible voters
        ↓
80 voters cast ballot
        ↓
A = 35
B = 28
C = 17
```

Result:

```text
A
Winner
```

Setelah itu:

```text
Result published
Election archived
```

Dan **SYSTEM_ADMIN tidak perlu menyentuh proses tersebut**, kecuali ada masalah sistem atau intervensi administratif.

---

# 16. Arsitektur permission yang menurut saya paling sehat

Jangan membuat:

```text
if role === "admin"
```

di seluruh aplikasi.

Buat permission-based authorization:

```text
Permission
```

Misalnya:

```text
election.view
election.update
election.publish

candidate.create
candidate.review
candidate.approve
candidate.reject

voter.verify
voter.manage

vote.cast
vote.view
vote.count

result.review
result.publish

audit.view
```

Kemudian role hanya menjadi kumpulan permission.

Contoh:

```text
COMMITTEE
    ↓
candidate.review
candidate.approve
voter.verify
election.view
```

Sedangkan:

```text
CHAIR
    ↓
candidate.review
candidate.approve
candidate.reject
election.update
result.review
result.publish
audit.view
```

Ini akan jauh lebih mudah dikembangkan.

---

# 17. Satu perubahan konseptual lagi: "Class" jangan menjadi pusat sistem

Pada desain sekarang, class terlihat seperti pusat organisasi:

```text
User → Class → Election
```

Saya sarankan:

```text
Organization
   ↓
Academic Structure
   ↓
Membership
   ↓
Election Scope
```

Karena nantinya bisa ada election:

```text
Class A
Cohort 2026
Program Studi
Department
Faculty
University
Student Organization
```

Jadi **class hanyalah salah satu academic scope**, bukan entitas yang menentukan seluruh election.

---

# Kesimpulan

Kalau saya redesign aplikasimu, saya akan menggesernya dari:

```text
ADMIN
  ↓
MANAGE USERS
  ↓
MANAGE CLASS
  ↓
MANAGE CANDIDATES
  ↓
VOTING
```

menjadi:

```text
UNIVERSITY / ORGANIZATION
          ↓
     ELECTION OWNER
          ↓
     ELECTION EVENT
          ↓
   ELECTION COMMITTEE
          ↓
 ┌────────┼──────────┐
 ↓        ↓          ↓
VOTERS  CANDIDATES  OBSERVERS
          ↓
      VERIFICATION
          ↓
        VOTING
          ↓
     RESULT REVIEW
          ↓
    RESULT PUBLISHED
```

Dengan tiga prinsip utama:

**1. Platform Admin ≠ Election Organizer**

**2. User Role ≠ Election Role**

**3. Election ≠ Voting Page — election adalah sebuah event dengan governance, scope, eligibility, lifecycle, dan audit trail.**

Menurut saya ini adalah arah yang jauh lebih tepat kalau target akhirnya bukan sekadar **“aplikasi untuk memilih kandidat”**, tetapi **platform digital election untuk lingkungan universitas** yang bisa menangani pemilihan tingkat kelas, angkatan, jurusan, fakultas, organisasi mahasiswa, sampai universitas.

Langkah berikutnya yang paling bernilai adalah mendesain **ERD/database schema + RBAC/permission matrix + state machine election** secara bersamaan, karena tiga hal itu akan menentukan apakah fondasi aplikasimu nanti benar-benar scalable atau cuma menambal sistem yang sekarang.
