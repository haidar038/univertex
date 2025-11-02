/**
 * Setup Admin User Script (JavaScript)
 *
 * This script creates the default admin user for UniVertex E-Voting Platform
 *
 * Usage:
 * 1. Set your Supabase credentials as environment variables:
 *    Windows: set VITE_SUPABASE_URL=your_url && set SUPABASE_SERVICE_ROLE_KEY=your_key && node scripts/setup-admin.js
 *    Linux/Mac: VITE_SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/setup-admin.js
 *
 * 2. Or create a .env.local file with:
 *    VITE_SUPABASE_URL=your_supabase_url
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
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
    console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nYou can find these in your Supabase project settings:');
    console.error('- VITE_SUPABASE_URL: Project Settings > API > Project URL');
    console.error('- SUPABASE_SERVICE_ROLE_KEY: Project Settings > API > service_role key');
    process.exit(1);
  }

  // Create Supabase admin client with service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🚀 Starting admin user setup for UniVertex...\n');

  try {
    // Step 1: Check if admin user already exists
    console.log('📝 Step 1: Checking if admin user exists...');
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users.find(u => u.email === ADMIN_EMAIL);

    let userId;

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists with email:', ADMIN_EMAIL);
      userId = existingAdmin.id;
      console.log('   User ID:', userId);
    } else {
      // Step 2: Create admin user
      console.log('👤 Step 2: Creating new admin user...');
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
      console.log('   User ID:', userId);
    }

    // Step 3: Ensure profile exists and is updated
    console.log('\n📄 Step 3: Updating user profile...');
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // Create profile if it doesn't exist (shouldn't happen due to trigger)
      console.log('   Creating profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: ADMIN_FULL_NAME,
          student_id: ADMIN_STUDENT_ID,
        });

      if (insertError) {
        console.warn('⚠️  Profile creation warning:', insertError.message);
      } else {
        console.log('✅ Profile created');
      }
    } else {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: ADMIN_FULL_NAME,
          student_id: ADMIN_STUDENT_ID,
        })
        .eq('id', userId);

      if (updateError) {
        console.warn('⚠️  Profile update warning:', updateError.message);
      } else {
        console.log('✅ Profile updated');
      }
    }

    // Step 4: Assign admin role
    console.log('\n🔐 Step 4: Assigning admin role...');
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (existingRoles && existingRoles.length > 0) {
      console.log('✅ Admin role already assigned');
    } else {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
        });

      if (roleError) {
        // Try to handle the case where the user already has the role
        if (roleError.code === '23505') {
          console.log('✅ Admin role already assigned');
        } else {
          throw new Error(`Failed to assign admin role: ${roleError.message}`);
        }
      } else {
        console.log('✅ Admin role assigned successfully');
      }
    }

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('✨ Admin user setup completed successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 Admin Credentials:');
    console.log('   Email:       ' + ADMIN_EMAIL);
    console.log('   Password:    ' + ADMIN_PASSWORD);
    console.log('   Student ID:  ' + ADMIN_STUDENT_ID);
    console.log('   Full Name:   ' + ADMIN_FULL_NAME);
    console.log('\n🔗 Login URL: /login');
    console.log('🎯 Admin Panel: /admin/dashboard\n');

  } catch (error) {
    console.error('\n❌ Error during admin setup:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the setup
setupAdminUser();
