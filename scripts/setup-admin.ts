/**
 * Setup Admin User Script
 *
 * This script creates the default admin user for UniVertex E-Voting Platform
 *
 * Usage:
 * 1. Set your Supabase credentials in .env.local:
 *    VITE_SUPABASE_URL=your_supabase_url
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *
 * 2. Run with: npx tsx scripts/setup-admin.ts
 *    or: bun scripts/setup-admin.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ADMIN_EMAIL = 'admin@univertex.com';
const ADMIN_PASSWORD = 'UniVertex.02025';
const ADMIN_FULL_NAME = 'Administrator';
const ADMIN_STUDENT_ID = 'admin';

async function setupAdminUser() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🚀 Starting admin user setup...\n');

  try {
    // Step 1: Check if admin user already exists
    console.log('📝 Checking if admin user exists...');
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users.find(u => u.email === ADMIN_EMAIL);

    let userId: string;

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      userId = existingAdmin.id;
    } else {
      // Step 2: Create admin user
      console.log('👤 Creating admin user...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: ADMIN_FULL_NAME,
          student_id: ADMIN_STUDENT_ID,
          role: 'admin', // Prevent auto-assign of voter role
        },
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      if (!newUser.user) {
        throw new Error('User creation returned no user object');
      }

      userId = newUser.user.id;
      console.log('✅ Admin user created successfully');
    }

    // Step 3: Update profile
    console.log('📄 Updating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: ADMIN_FULL_NAME,
        student_id: ADMIN_STUDENT_ID,
      })
      .eq('id', userId);

    if (profileError) {
      console.warn('⚠️  Profile update warning:', profileError.message);
    } else {
      console.log('✅ Profile updated successfully');
    }

    // Step 4: Check if admin role exists
    console.log('🔐 Checking admin role...');
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (existingRoles && existingRoles.length > 0) {
      console.log('✅ Admin role already assigned');
    } else {
      // Assign admin role
      console.log('🔐 Assigning admin role...');
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
        });

      if (roleError) {
        throw new Error(`Failed to assign admin role: ${roleError.message}`);
      }

      console.log('✅ Admin role assigned successfully');
    }

    console.log('\n✨ Admin user setup completed successfully!');
    console.log('\n📋 Admin Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Student ID: ${ADMIN_STUDENT_ID}`);
    console.log('\n🔗 You can now login at: /login');

  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  }
}

setupAdminUser();
