# Konfigurasi Redirect Supabase Auth

Kode klien mengirim reset-password ke `${window.location.origin}/reset-password`.
Supabase hanya memakai URL ini jika origin tersebut terdaftar pada konfigurasi
Auth; jika tidak, ia kembali ke **Site URL** (biasanya landing page).

Di Supabase Dashboard, buka **Authentication → URL Configuration** lalu:

1. Set **Site URL** ke origin aplikasi produksi, misalnya
   `https://univertex.example.com` (tanpa path).
2. Tambahkan setiap origin aplikasi pada **Redirect URLs** dengan pola berikut:

   - `https://univertex.example.com/**`
   - `http://localhost:5173/**`

3. Tambahkan pola origin preview bila Vercel preview dipakai untuk pengujian.

Link konfirmasi yang dibuat dari Dashboard/Auth akan kembali ke Site URL. Aplikasi
kemudian membaca sesi hasil konfirmasi dan mengarahkan pengguna ke dashboard sesuai
role. Link reset dari aplikasi dan dialog admin kembali langsung ke
`/reset-password`, tempat pengguna dapat menyetel password baru.
