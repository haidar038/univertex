Untuk mengonfigurasi Multi-Factor Authentication (MFA) berbasis TOTP (Time-based One-Time Password) di Supabase, prosesnya dibagi menjadi dua bagian: konfigurasi di Dashboard (yang secara bawaan sudah aktif untuk layanan cloud) dan implementasi kode di sisi client (frontend).
Berikut adalah panduan langkah demi langkah menggunakan [Supabase JavaScript Client SDK](https://supabase.com/docs/guides/auth/auth-mfa/totp): [1] 
------------------------------
## Alur Kerja (Workflow) MFA TOTP
Proses MFA di Supabase terbagi menjadi 3 tahap utama:

   1. Enroll (Pendaftaran): Membuat faktor keamanan baru (TOTP) untuk pengguna dan menghasilkan kode QR.
   2. Challenge (Tantangan): Membuat permintaan verifikasi resmi berdasarkan faktor tersebut.
   3. Verify (Verifikasi): Memvalidasi kode 6 digit dari aplikasi autentikator pengguna (seperti Google Authenticator atau Authy). [1, 2] 

------------------------------
## 1. Proses Pendaftaran & Membuat Kode QR (Enroll)
Ketika pengguna ingin mengaktifkan MFA, panggil fungsi enroll untuk mendapatkan data qr_code (dalam format SVG) dan secret. [1, 3] 

const enrollMFA = async () => {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'NamaAplikasiAnda' // Akan muncul sebagai label di Google Authenticator
  });

  if (error) {
    console.error("Gagal mendaftarkan MFA:", error.message);
    return;
  }

  // Ambil ID faktor untuk proses verifikasi nanti
  const factorId = data.id;
  
  // Ambil string SVG kode QR untuk ditampilkan di UI frontend Anda
  const qrCodeSvg = data.totp.qr_code; 
  
  // Kunci manual jika pengguna tidak bisa memindai kode QR
  const secretKey = data.totp.secret; 

  return { factorId, qrCodeSvg, secretKey };
};

Tampilkan qrCodeSvg ke layar agar pengguna dapat memindainya menggunakan aplikasi autentikator mereka. [1] 
------------------------------
## 2. Memverifikasi Kode Pertama Kali (Challenge & Verify)
Setelah pengguna memindai kode QR, Anda harus memastikan bahwa aplikasi mereka sinkron dengan meminta kode 6 digit pertama. Proses ini mengaktifkan status MFA pengguna dari unverified menjadi verified. [1] 

const verifyAndEnableMFA = async (factorId, userEnteredCode) => {
  // 1. Buat tantangan (challenge) berdasarkan factorId
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factorId
  });

  if (challengeError) {
    console.error("Gagal membuat tantangan:", challengeError.message);
    return;
  }

  // 2. Verifikasi kode yang dimasukkan pengguna
  const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factorId,
    challengeId: challengeData.id,
    code: userEnteredCode // Kode 6 digit dari aplikasi autentikator
  });

  if (verifyError) {
    console.error("Kode salah atau kadaluwarsa:", verifyError.message);
    return;
  }

  console.log("MFA Berhasil diaktifkan!", verifyData);
};

------------------------------
## 3. Menangani Login dengan MFA (AAL2)
Ketika pengguna yang sudah mengaktifkan MFA melakukan login biasa (menggunakan email/password atau OAuth), level autentikasi mereka di dalam JWT token adalah aal1 (Assurance Level 1). Anda harus memeriksa status ini dan meminta kode MFA untuk meningkatkan levelnya ke aal2 (Assurance Level 2). [4] 
Cara mengecek status level autentikasi setelah login:

const checkMFAStatus = async () => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    console.error(error);
    return;
  }

  // Jika level saat ini (currentLevel) berbeda dengan level maksimum yang bisa dicapai (nextLevel)
  // Berarti pengguna memiliki MFA yang aktif dan harus memasukkan kode TOTP
  if (data.currentLevel !== data.nextLevel && data.nextLevel === 'aal2') {
    // Arahkan pengguna ke halaman input kode MFA
    showMFAPrompt();
  }
};

Proses verifikasi saat login (Mirip langkah ke-2):
Lakukan challenge dan verify menggunakan factorId aktif pengguna untuk menaikkan level token menjadi aal2. [1, 4] 
------------------------------
## 4. Proteksi Data Menggunakan Row Level Security (RLS)
Keunggulan utama Supabase adalah Anda bisa membatasi akses data langsung di database PostgreSQL menggunakan kebijakan RLS berdasarkan level MFA pengguna. [3, 5] 
Contoh kebijakan SQL untuk memastikan tabel hanya bisa diakses oleh pengguna yang sudah melawati verifikasi MFA (aal2):

alter table "nama_tabel_rahasia" enable row level security;
create policy "Hanya akses jika sudah verifikasi MFA"on "nama_tabel_rahasia"for allto authenticatedusing (auth.jwt() ->> 'aal' = 'aal2');

Apakah Anda sedang membangun aplikasi ini menggunakan framework tertentu (seperti React, Next.js, Vue, atau Flutter) agar saya bisa memberikan contoh komponen UI yang sesuai?
Jika Anda menggunakan Self-Hosted Supabase (Docker), beri tahu saya karena ada beberapa konfigurasi berkas .env tambahan yang perlu disesuaikan. [6, 7] 

[1] [https://supabase.com](https://translate.google.com/translate?u=https://supabase.com/docs/guides/auth/auth-mfa/totp&hl=id&sl=en&tl=id&client=sge)
[2] [https://hexdocs.pm](https://hexdocs.pm/supabase_gotrue/mfa_guide.html)
[3] [https://www.youtube.com](https://www.youtube.com/watch?v=He7LI2mv9v0&t=119)
[4] [https://supabase.com](https://supabase.com/features/multi-factor-authentication)
[5] [https://dev.to](https://dev.to/kanta13jp1/supabase-auth-mfa-guide-adding-totp-and-otp-to-flutter-apps-202p)
[6] [https://supabase.com](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa)
[7] [https://www.supascale.app](https://www.supascale.app/blog/multifactor-authentication-for-selfhosted-supabase-totp-setu)
