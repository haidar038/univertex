# 🔐 Setup Admin User - UniVertex E-Voting

Panduan lengkap untuk membuat user admin default pada platform UniVertex.

## 📋 Informasi Admin Default

```
Email:       admin@univertex.com
Password:    UniVertex.02025
Student ID:  admin
Role:        admin
```

## 🚀 Cara Setup Admin User

### Metode 1: Menggunakan Setup Script (Direkomendasikan)

Script otomatis untuk membuat admin user telah disediakan.

#### Langkah-langkah:

1. **Pastikan database migrations sudah dijalankan:**
   ```bash
   supabase db push
   ```

2. **Siapkan credentials Supabase:**
   - Buka Supabase Dashboard
   - Pilih project Anda
   - Buka: Project Settings > API
   - Copy:
     - Project URL
     - service_role key (⚠️ JANGAN commit ke git!)

3. **Jalankan setup script:**

   **Windows (CMD):**
   ```cmd
   set VITE_SUPABASE_URL=https://oiurjnmpkguyxevdbpbu.supabase.co
   set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   npm run setup:admin
   ```

   **Windows (PowerShell):**
   ```powershell
   $env:VITE_SUPABASE_URL="https://oiurjnmpkguyxevdbpbu.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
   npm run setup:admin
   ```

   **Linux/Mac:**
   ```bash
   VITE_SUPABASE_URL=https://oiurjnmpkguyxevdbpbu.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here \
   npm run setup:admin
   ```

4. **Login ke admin panel:**
   - Buka: http://localhost:8080/login
   - Email: `admin@univertex.com`
   - Password: `UniVertex.02025`
   - Redirect otomatis ke: `/admin/dashboard`

### Metode 2: Manual via Supabase Dashboard

Jika Anda lebih suka membuat user secara manual:

1. **Buka Supabase Dashboard**
   - Masuk ke project: https://supabase.com/dashboard/project/oiurjnmpkguyxevdbpbu

2. **Buat User Baru:**
   - Pilih: Authentication > Users
   - Klik: "Add User" / "Invite User"
   - Isi form:
     - Email: `admin@univertex.com`
     - Password: `UniVertex.02025`
     - Auto Confirm User: ✅ (centang)
   - Klik: "Create User"

3. **Jalankan SQL Query untuk assign role admin:**
   - Pilih: SQL Editor
   - Copy user ID dari daftar users
   - Jalankan query berikut:

   ```sql
   -- Ganti 'USER_ID_DISINI' dengan ID user yang baru dibuat
   DO $$
   DECLARE
     v_user_id UUID := 'USER_ID_DISINI';
   BEGIN
     -- Update profile
     UPDATE public.profiles
     SET full_name = 'Administrator', student_id = 'admin'
     WHERE id = v_user_id;

     -- Assign admin role
     INSERT INTO public.user_roles (user_id, role)
     VALUES (v_user_id, 'admin')
     ON CONFLICT (user_id, role) DO NOTHING;
   END $$;
   ```

   Atau lebih sederhana:

   ```sql
   -- Assign admin role by email
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin'::app_role
   FROM auth.users
   WHERE email = 'admin@univertex.com'
   ON CONFLICT (user_id, role) DO NOTHING;

   -- Update profile
   UPDATE public.profiles
   SET full_name = 'Administrator', student_id = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@univertex.com');
   ```

### Metode 3: Via Supabase CLI

Jika Anda menggunakan Supabase CLI untuk local development:

```bash
# Create user
supabase auth users create admin@univertex.com --password UniVertex.02025

# Lalu jalankan SQL untuk assign admin role (gunakan SQL dari Metode 2)
```

## ✅ Verifikasi Setup

Setelah setup selesai, verifikasi dengan:

1. **Login Test:**
   - Buka: http://localhost:8080/login
   - Login dengan credentials admin
   - Pastikan redirect ke `/admin/dashboard`

2. **Cek Database:**
   ```sql
   -- Cek user ada di auth.users
   SELECT id, email, created_at FROM auth.users WHERE email = 'admin@univertex.com';

   -- Cek profile
   SELECT * FROM public.profiles WHERE student_id = 'admin';

   -- Cek role
   SELECT ur.role, p.full_name, p.student_id
   FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'admin@univertex.com');
   ```

3. **Test Akses Admin:**
   - Dashboard: `/admin/dashboard`
   - Manage Events: `/admin/events`
   - Manage Users: `/admin/users`
   - Manage Classes: `/admin/classes`

## 🔍 Troubleshooting

### Error: "User already exists"

Jika user sudah ada, cukup assign role admin:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin@univertex.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Error: "Profile not found"

Buat profile manual:

```sql
INSERT INTO public.profiles (id, full_name, student_id)
SELECT id, 'Administrator', 'admin'
FROM auth.users
WHERE email = 'admin@univertex.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Administrator', student_id = 'admin';
```

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"

- Pastikan environment variable sudah di-set dengan benar
- Service role key harus dari: Project Settings > API > service_role
- Jangan gunakan anon key untuk setup script

### Login Redirect ke /app bukan /admin

Cek apakah role admin sudah di-assign:

```sql
SELECT * FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@univertex.com');
```

Jika tidak ada hasil, jalankan:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'admin@univertex.com';
```

## 📚 Referensi

- **Migration Files:** `supabase/migrations/`
- **Setup Script:** `scripts/setup-admin.js`
- **Database Schema:** `database/schema.sql`
- **Auth Hook:** `src/hooks/useAuth.ts`
- **Protected Routes:** `src/components/ProtectedRoute.tsx`

## 🔒 Security Notes

⚠️ **PENTING:**

1. **Ganti password default** setelah login pertama kali
2. **Jangan commit** file `.env.local` atau credentials ke git
3. **Service role key** memberikan akses penuh - jangan share!
4. Di **production**, gunakan password yang lebih kuat
5. Enable **2FA** jika tersedia di Supabase

## 💡 Tips

- **Multi-role support:** User bisa memiliki role `admin`, `voter`, dan `candidate` sekaligus
- **Admin UI:** Terpisah dari voter UI (layout berbeda)
- **Default role:** Semua user baru otomatis dapat role `voter` via trigger
- **RLS Policies:** Admin bypass banyak restrictions via `has_role()` function

---

Dibuat untuk UniVertex E-Voting Platform
