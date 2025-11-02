# UniVertex Setup Scripts

This directory contains utility scripts for setting up and managing the UniVertex E-Voting Platform.

## 📁 Available Scripts

### `setup-admin.js`

Creates the default admin user for the platform.

**Admin Credentials:**
- Email: `admin@univertex.com`
- Password: `UniVertex.02025`
- Student ID: `admin`

#### Prerequisites

1. Supabase project must be set up
2. Database migrations must be applied
3. You need your Supabase credentials:
   - Project URL
   - Service Role Key (from Project Settings > API)

#### Usage

**Option 1: Using npm script (recommended)**

```bash
npm run setup:admin
```

**Option 2: Direct execution with environment variables**

Windows (CMD):
```cmd
set VITE_SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
node scripts/setup-admin.js
```

Windows (PowerShell):
```powershell
$env:VITE_SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
node scripts/setup-admin.js
```

Linux/Mac:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/setup-admin.js
```

**Option 3: Using .env.local file**

1. Create `.env.local` in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

2. Run the script:
```bash
node scripts/setup-admin.js
```

#### What the script does

1. ✅ Checks if admin user already exists
2. 👤 Creates new admin user (if not exists)
3. 📄 Creates/updates user profile
4. 🔐 Assigns admin role
5. ✨ Displays success message with credentials

#### Troubleshooting

**Error: Missing Supabase credentials**
- Make sure you've set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Get these from Supabase Dashboard > Project Settings > API

**Error: Failed to create user**
- Check that your service role key is correct
- Ensure migrations have been applied to your database

**Error: Failed to assign admin role**
- The user_roles table should exist (check migrations)
- Verify RLS policies allow the operation

## 🔒 Security Notes

- **Never commit** your Service Role Key to version control
- The service role key bypasses Row Level Security - use with caution
- Only use these scripts in development or for initial setup
- In production, consider using Supabase Dashboard for user management

## 🚀 First Time Setup

1. Install dependencies:
```bash
npm install
```

2. Apply database migrations:
```bash
supabase db push
# or if using remote database
supabase db push --db-url your-database-url
```

3. Run admin setup script:
```bash
npm run setup:admin
```

4. Login to the admin panel:
- URL: `http://localhost:8080/login`
- Email: `admin@univertex.com`
- Password: `UniVertex.02025`

## 📝 Additional Information

For more information about the database schema and migrations, see:
- `supabase/migrations/` - Database migration files
- `database/schema.sql` - Schema reference
- `CLAUDE.md` - Project documentation
