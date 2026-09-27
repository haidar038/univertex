> **ANNEX BISNIS — bukan gate produksi.** Dokumen pembiayaan/institusional, tetap relevan untuk kontrak/pilot, tapi bukan acuan teknis. Acuan teknis: `AGENTS.md`.
---
Menurutku, titik masalah UniVertex sekarang bukan **“bagaimana membuat pricing SaaS?”**, melainkan **“bagaimana mengubah project yang awalnya bootstrap menjadi layanan software yang dapat dibiayai institusi.”**

Dan konteksmu sebenarnya sudah berubah cukup signifikan:

> UniVertex awalnya adalah innovation project yang kamu biayai sendiri → sekarang ada universitas yang ingin menggunakannya untuk event nyata dalam waktu dekat.

Pada titik ini, **jangan lagi memperlakukan UniVertex sebagai project gratis milik tim mahasiswa**. Ia sudah masuk kategori **institutional software deployment**.

## 1. Model yang paling cocok untuk UniVertex

Untuk kondisi sekarang, aku merekomendasikan model:

### **One-Time Implementation + Event License + Operational Support + Infrastructure**

Bukan:

* subscription SaaS bulanan untuk mahasiswa,
* fee per voter,
* revenue sharing,
* atau jual source code sekaligus.

Strukturnya kira-kira seperti ini:

| Komponen                                      | Dibayar untuk                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| **Production Readiness / Implementation Fee** | Hardening sistem, testing, security, deployment, konfigurasi           |
| **Event Deployment Fee**                      | Setup event universitas, data, kandidat, jadwal, branding, konfigurasi |
| **Operational Support Fee**                   | Monitoring dan support selama event                                    |
| **Infrastructure Cost**                       | Vercel, Supabase, domain, email/SMS jika ada                           |
| **Post-Event Maintenance**                    | Support dan maintenance setelah event                                  |
| **Source Code Buyout**                        | Opsional, hanya jika universitas ingin memiliki/mengambil alih kode    |

Ini jauh lebih natural daripada mencoba membuat pricing page untuk produk yang penggunaannya sangat spesifik.

---

# 2. Kenapa bukan SaaS pricing dulu?

Karena universitas tidak sedang membeli:

> “akses ke UniVertex selama RpX/bulan.”

Mereka sebenarnya membeli:

> **“sistem pemilihan digital yang siap digunakan untuk event kami, dikonfigurasi sesuai kebutuhan kami, dan ada developer yang bertanggung jawab ketika event berlangsung.”**

Nilai utamanya bukan database, dashboard atau UI-nya.

Nilai utamanya adalah:

**risk reduction + operational readiness.**

Misalnya event berlangsung hari Sabtu pukul 09.00–15.00.

Universitas tidak terlalu peduli apakah kamu menggunakan:

* Vite,
* React,
* Supabase,
* Vercel,
* TypeScript.

Yang mereka pedulikan:

> “Apakah mahasiswa bisa login?”

> “Apakah satu mahasiswa hanya bisa memilih sekali?”

> “Apakah hasilnya valid?”

> “Apa yang terjadi kalau server bermasalah?”

> “Siapa yang kami hubungi kalau ada masalah?”

> “Apakah hasil voting bisa direkap?”

Itulah sebenarnya produk yang kamu jual.

---

# 3. Kamu sudah punya alasan yang sah untuk mulai mengenakan biaya

Ini bagian yang menurutku paling penting.

Sebelumnya:

> **Haidar → mengembangkan UniVertex sebagai bootstrap innovation project.**

Sekarang:

> **Universitas → menggunakan UniVertex untuk kebutuhan operasional nyata.**

Maka secara bisnis, sangat wajar jika terjadi titik transisi:

### Development phase

Kamu menanggung:

* engineering,
* hosting,
* domain,
* development tools,
* testing,
* maintenance,
* opportunity cost.

### Institutional deployment phase

Institusi mulai menanggung:

* infrastructure,
* deployment,
* customization,
* support,
* operational risk,
* maintenance.

Ini bukan berarti kamu “meminta bayaran untuk project yang dulu gratis”.

Ini adalah:

> **perubahan status project dari prototype/innovation project menjadi deployed institutional system.**

---

# 4. Siapa yang sebenarnya harus membayar?

Menurutku, **universitas/institusi yang menggunakan UniVertex**, bukan mahasiswa yang dulu mengajakmu membuat project.

Ini penting.

Awalnya hubunganmu adalah:

**Haidar ↔ mahasiswa calon MAWAPRES**

Tetapi penggunaan baru adalah:

**Haidar/Binary Verse ↔ universitas/event committee**

Mahasiswa tersebut bisa tetap menjadi:

* initiator,
* product partner,
* project collaborator,
* pihak yang mengenalkan UniVertex ke universitas.

Tetapi **pihak yang menikmati operational benefit dan meminta sistem digunakan untuk event seharusnya menjadi pihak kontraktual**.

Jadi jangan membuat skema:

> “Karena dulu kita kerja sama gratis, sekarang saya kasih gratis juga ke universitas.”

Itu justru membuat biaya bootstrap kamu terus mensubsidi institusi.

---

# 5. Model pricing yang menurutku masuk akal

Aku tidak akan menggunakan angka seolah-olah itu “harga pasar resmi”. Anggap ini **framework pricing untuk kamu susun berdasarkan scope dan effort**.

### A. Production Readiness

Misalnya:

**Rp5–10 juta**

Mencakup:

* production hardening,
* security review,
* database/RLS review,
* authentication hardening,
* testing,
* error handling,
* backup strategy,
* logging,
* deployment configuration,
* production environment.

---

### B. Event Deployment

Misalnya:

**Rp3–7 juta**

Mencakup:

* setup universitas,
* branding,
* election configuration,
* candidate setup,
* voter setup/import,
* schedule,
* admin configuration,
* staging environment,
* UAT,
* training admin/operator.

---

### C. Event Operational Support

Misalnya:

**Rp3–8 juta/event**

Mencakup:

* monitoring,
* technical support,
* troubleshooting,
* incident response,
* result verification,
* post-event report,
* developer standby pada waktu yang disepakati.

---

### D. Infrastructure

**Jangan kamu subsidi lagi.**

Pada kondisi produksi, sebaiknya:

> **Universitas memiliki akun infrastrukturnya sendiri.**

Contoh:

```text
University
   │
   ├── Vercel Organization
   │
   ├── Supabase Organization
   │
   ├── Domain
   │
   └── Billing
          │
          ▼
       UniVertex
          │
          ▼
   Haidar / Binary Verse
       as Technical Provider
```

Per September 2026, Vercel Hobby secara eksplisit ditujukan untuk penggunaan personal/non-komersial, sedangkan Pro berharga $20/bulan. Jadi deployment universitas yang sudah menjadi penggunaan institusional sebaiknya tidak bergantung pada akun Hobby pribadimu. ([Vercel][1])

Untuk Supabase, Free plan memang tersedia, tetapi project Free dapat dipause setelah satu minggu inactivity dan tidak menyediakan automatic backups; Pro mulai $25/bulan, dengan daily backups 7 hari, quota yang lebih besar, dan tanpa project pausing. ([Supabase][2])

Artinya baseline subscription untuk:

```text
Vercel Pro       $20/month
Supabase Pro     $25/month
---------------------------
Base             $45/month
```

belum termasuk usage tambahan dan pajak.

Untuk event kampus yang benar-benar akan digunakan publik, biaya ini sangat kecil dibanding risiko operational failure, dan sebaiknya dibebankan ke institusi.

---

# 6. Bahkan lebih baik: infrastructure atas nama universitas

Ini salah satu keputusan arsitektural/business yang paling penting.

Jangan:

```text
Haidar's Vercel
   └── UniVertex

Haidar's Supabase
   └── UniVertex
```

Lebih baik:

```text
University Vercel
   └── UniVertex Production

University Supabase
   └── UniVertex Production DB
```

Kemudian kamu diberikan role:

```text
University
    │
    ├── owns infrastructure
    ├── owns billing
    ├── owns domain
    └── owns institutional data
             │
             ▼
       Haidar / Provider
       develops + operates
```

Keuntungannya besar.

Kalau suatu hari kamu:

* berhenti maintain,
* tidak available,
* pindah pekerjaan,
* membangun tim,
* atau universitas ingin mengambil alih,

sistem tidak runtuh hanya karena infrastrukturnya berada di akun personalmu.

Ini jauh lebih profesional.

---

# 7. Jangan langsung menjual source code

Menurutku ini justru harus dipisahkan dengan jelas.

Ada tiga asset berbeda:

### 1. UniVertex Core Software

Kode, architecture, components, logic, database model, dan framework.

### 2. Institutional Configuration

Misalnya:

```text
University A
2026 Rector Election
Candidates
Voters
Branding
Schedule
Election Rules
```

### 3. Institutional Data

Data mahasiswa, voter records, voting records, result data, audit logs, dll.

Jangan mencampur ketiganya.

Model yang sehat:

```text
UniVertex Core
      │
      │ licensed
      ▼
University
      │
      ├── configuration
      └── election data
```

Jadi universitas mendapatkan **hak menggunakan UniVertex**, bukan otomatis membeli seluruh intellectual property.

---

# 8. Ini juga menyelesaikan masalah “project gratis dari awal”

Kamu bisa mendefinisikan:

### R&D / Bootstrap Phase

> UniVertex dikembangkan sebagai innovation initiative dengan biaya development ditanggung developer.

Kemudian:

### Institutional Deployment Phase

> Deployment UniVertex pada lingkungan universitas merupakan layanan komersial yang mencakup production preparation, institutional configuration, deployment, dan operational support.

Dengan begitu, masa lalu dan masa depan tidak tercampur.

---

# 9. Jangan gunakan “harga software” saja

Ini kesalahan yang sering terjadi pada solo developer.

Misalnya developer berpikir:

> “Aplikasi ini cuma React + Supabase. Berarti mungkin Rp3 juta.”

Padahal yang dijual bukan source code.

Misalnya event itu membutuhkan:

* 2 minggu hardening,
* testing,
* database preparation,
* security review,
* deployment,
* configuration,
* training,
* monitoring,
* standby saat event,
* troubleshooting.

Yang dibayar sebenarnya:

> **engineering + responsibility + operational availability.**

Jadi pricing sebaiknya dihitung:

```text
Development effort
+
Production hardening
+
Deployment effort
+
Operational risk
+
Support
+
Infrastructure
+
Margin
```

bukan:

```text
"berapa biaya hosting?"
```

---

# 10. Aku justru menyarankan paket seperti ini

Untuk UniVertex sekarang, kamu bisa membuat satu offering sederhana:

## UniVertex Institutional Deployment

### 01 — Setup & Production Readiness

**One-time**

Includes:

* production hardening
* security configuration
* database configuration
* authentication
* testing
* deployment
* monitoring setup

### 02 — Election Deployment

**Per event**

Includes:

* institution configuration
* candidate configuration
* voter configuration
* branding
* election schedule
* UAT
* administrator training

### 03 — Event Operations

**Per event**

Includes:

* monitoring
* technical support
* incident handling
* election-day support
* result verification
* post-event technical report

### 04 — Infrastructure

**Billed to institution**

Includes:

* Vercel
* Supabase
* domain
* email/SMS provider, jika digunakan
* other third-party services

### 05 — Maintenance

**Optional recurring**

Includes:

* bug fixes
* security updates
* dependency updates
* database maintenance
* minor improvements
* technical support

---

# 11. Untuk event pertama, aku akan menggunakan model “pilot deployment”

Ini menurutku paling cocok dengan situasimu.

Jangan langsung menjual:

> “UniVertex SaaS”

Tetapi:

> **UniVertex Institutional Pilot — [Nama Universitas]**

Misalnya struktur ekonominya:

```text
Institutional Pilot
─────────────────────────────
Production readiness     Rp X
Institution deployment   Rp X
Event operation          Rp X
─────────────────────────────
Total                    Rp XX

Infrastructure           paid separately
```

Setelah event pertama berhasil:

```text
Pilot
   │
   ▼
Evaluation
   │
   ├── another election
   │
   ├── annual license
   │
   └── institutional deployment
```

Ini jauh lebih mudah dijual ke universitas daripada langsung meminta mereka berlangganan SaaS yang belum punya pricing model.

---

# 12. Untuk UniVertex, annual license justru bisa muncul setelah pilot

Misalnya universitas ternyata menggunakan UniVertex untuk beberapa kegiatan:

* pemilihan mahasiswa,
* pemilihan organisasi,
* pemilihan ketua himpunan,
* pemilihan BEM,
* survei kampus,
* election event lainnya.

Baru kemudian kamu bisa berubah menjadi:

### Annual Institutional License

Contoh struktur:

```text
Annual License
├── unlimited election configurations
├── hosting
├── updates
├── technical support
├── backups
└── X hours/month support
```

Jadi evolusinya:

```text
Bootstrap
   ↓
Paid Pilot
   ↓
Institutional Deployment
   ↓
Recurring Maintenance
   ↓
Annual Institutional License
   ↓
Multi-Tenant SaaS
```

**Jangan lompat langsung ke tahap terakhir.**

---

# 13. Ada satu model yang justru tidak aku rekomendasikan

### Fee per voter

Misalnya:

> Rp500/voter

Secara teori menarik.

Namun untuk universitas:

```text
50.000 voters
×
Rp500
=
Rp25.000.000
```

Ini justru bisa menyulitkan karena procurement menjadi aneh:

> “Apakah ini software purchase? SaaS? service? transaction fee?”

Untuk event election, **per-event fixed fee jauh lebih mudah dianggarkan dan dipertanggungjawabkan**.

Jadi untuk tahap sekarang:

**fixed project/event pricing > per-user pricing.**

---

# 14. Payment term juga harus berubah

Kamu bilang biasanya mengerjakan project lalu dibayar ketika siap.

Untuk UniVertex, jangan menggunakan pola itu lagi.

Karena sekarang kamu akan menanggung:

* development,
* cloud,
* deployment,
* operational preparation,
* deadline risk.

Minimal:

### 50 / 50

```text
50%
Upon agreement / kickoff

50%
Before production go-live
```

Atau untuk project yang lebih besar:

```text
40%
Contract / kickoff

30%
Staging + UAT

30%
Production go-live
```

Yang penting:

> **jangan sampai kamu membiayai deployment production sampai selesai baru menunggu universitas membayar.**

---

# 15. Contract-nya harus membedakan empat hal

Ini sangat penting sebelum sistem benar-benar digunakan.

| Area               | Harus ditentukan                          |
| ------------------ | ----------------------------------------- |
| **Software**       | Siapa pemilik IP/core code                |
| **Data**           | Siapa pemilik data mahasiswa/voting       |
| **Infrastructure** | Siapa pemilik akun Vercel/Supabase/domain |
| **Support**        | Sampai kapan dan apa yang termasuk        |

Tambahkan juga:

* scope pekerjaan,
* acceptance criteria,
* deployment date,
* event date,
* SLA/support window,
* incident handling,
* backup,
* data retention/deletion,
* change request,
* cancellation,
* payment milestones,
* liability limitations.

Untuk sistem voting, ini bukan sekadar administrasi. Auditability, integrity, access control, dan data handling harus masuk scope kontrak dan technical design.

---

# 16. Ada satu hal pada repo yang perlu kamu perhatikan

Aku melihat repository UniVertex saat ini masih berupa **public repository** dan README-nya masih membawa struktur/template proyek Lovable. Repository juga memuat source aplikasi dan konfigurasi development yang cukup jelas. ([GitHub][3])

Itu tidak otomatis menjadi masalah untuk demo.

Tetapi untuk **production deployment universitas**, aku akan memisahkan:

```text
univertex
   │
   ├── Public demo repository
   │      └── demonstration
   │
   └── Private production repository
          ├── production configuration
          ├── migrations
          ├── deployment config
          ├── security configuration
          └── institutional deployment
```

Terutama karena production akan membawa data institusi.

Dan satu hal penting:

> **Public GitHub repository ≠ source code otomatis menjadi open-source.**

Kalau repository tidak secara eksplisit memiliki lisensi yang memberikan hak tertentu, jangan menganggap pihak lain otomatis memiliki hak untuk menggunakan, memodifikasi, atau menjual ulang kode tersebut.

---

# 17. Kalau aku yang menyusun posisi bisnis UniVertex sekarang

Aku akan memposisikannya sebagai:

> **UniVertex — Digital Election Platform for Educational Institutions**

bukan:

> “aplikasi voting mahasiswa”.

Kemudian bisnis model awalnya:

```text
                 UniVertex
                    │
          Institutional Software
                    │
      ┌─────────────┼─────────────┐
      │             │             │
  Deployment      License       Support
      │             │             │
  one-time        per-event     recurring
```

Dan nantinya:

```text
             UniVertex Platform
                    │
        ┌───────────┴───────────┐
        │                       │
 Institutional Deployment    SaaS
        │                       │
 Universities             Multiple Institutions
```

---

# 18. Jadi, keputusan yang menurutku paling rasional untuk situasimu sekarang

### **Jangan membuat pricing SaaS terlebih dahulu.**

Lakukan ini:

**1. Jadikan universitas sebagai customer institusional.**

**2. Tawarkan UniVertex sebagai paid pilot/deployment untuk event tersebut.**

**3. Pisahkan fee menjadi:**

```text
Production Readiness
+
Institutional Deployment
+
Event Operations
+
Infrastructure
```

**4. Infrastructure dibayar universitas dan idealnya berada di account universitas.**

**5. Core source code/IP tetap berada padamu kecuali ada kontrak buyout.**

**6. Gunakan pembayaran bertahap, bukan “bayar setelah selesai”.**

**7. Setelah event pertama berhasil, baru tawarkan annual maintenance/license.**

---

## Kalau dibuat sangat konkret

Aku akan mengarahkan transaksi pertama UniVertex menjadi seperti ini:

```text
UNIVERTEX
Institutional Pilot Deployment
──────────────────────────────────────

One-time
Production Readiness       Rp X
Institution Setup          Rp X
Deployment & UAT           Rp X
Event Operations           Rp X
                           ────────
Project Fee                Rp XX

Infrastructure
Vercel                     Client-paid
Supabase                   Client-paid
Domain                     Client-paid

Post Event
Maintenance                Optional
Annual License             Optional
Source Code Buyout         Separate
```

Dengan demikian, **uang yang kamu keluarkan selama masa bootstrap berhenti menjadi biaya pribadi**, tetapi tetap mempertahankan UniVertex sebagai asset/product milikmu yang bisa digunakan untuk universitas lain.

Dan menurutku ini justru titik yang menarik: **UniVertex tidak perlu langsung menjadi SaaS untuk mulai menghasilkan uang.** Ia bisa terlebih dahulu menjadi **software product yang dijual melalui institutional deployment**, kemudian product-market fit-nya divalidasi lewat deployment universitas pertama.

Untuk platform seperti ini, model tersebut juga jauh lebih cocok dengan siklus pengadaan dan penggunaan institusi daripada consumer SaaS self-service.

[1]: https://vercel.com/pricing?utm_source=chatgpt.com "Vercel Pricing: Hobby, Pro, and Enterprise plans"
[2]: https://supabase.com/pricing?utm_source=chatgpt.com "Pricing & Fees | Supabase"
[3]: https://github.com/haidar038/univertex "GitHub - haidar038/univertex · GitHub"
