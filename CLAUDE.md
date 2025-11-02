# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UniVertex is an election/voting platform built with React, TypeScript, Vite, and Supabase. The application supports multiple user roles (admin, voter, candidate) with role-based access control and separate UI layouts for each role type.

## Commands

### Development
```bash
npm run dev          # Start development server on port 8080
npm run build        # Production build
npm run build:dev    # Development build with source maps
npm run preview      # Preview production build locally
npm run lint         # Run ESLint on all files
npm run setup:admin  # Create default admin user
```

### Testing
```bash
npm run test         # Run tests with Vitest
npm run test:ui      # Run tests with Vitest UI
```

Note: Test setup file is configured at `./src/test/setup.ts` with jsdom environment.

### Database (Supabase)
The project uses Supabase with migrations stored in `supabase/migrations/`. Database changes are managed through Supabase migrations:
- Project ID: `oiurjnmpkguyxevdbpbu`
- Migrations use SQL files with timestamps
- Generate types: `npx supabase gen types typescript --project-id oiurjnmpkguyxevdbpbu > src/integrations/supabase/types.ts`

## Architecture

### Authentication & Authorization

**Role-Based Access Control (RBAC):**
- Roles are stored in `user_roles` table with many-to-many relationship
- Available roles: `admin`, `voter`, `candidate`
- Users can have multiple roles simultaneously
- Default role on signup: `voter` (automatically assigned via database trigger)

**Authentication Flow:**
1. `useAuth` hook (`src/hooks/useAuth.ts`) manages auth state
2. Fetches user session and profile data (including roles) from Supabase
3. `ProtectedRoute` component handles route protection and role-based redirects
4. Admin routes require `admin` role, general app routes accept any authenticated user

**Key Auth Files:**
- `src/hooks/useAuth.ts` - Central auth hook with profile/role fetching
- `src/components/ProtectedRoute.tsx` - Route wrapper for auth checks
- `src/integrations/supabase/client.ts` - Supabase client configuration

### Routing Structure

**Two Main Route Hierarchies:**
1. **Admin Routes** (`/admin/*`):
   - Wrapped in `AdminLayout` component with sidebar navigation
   - Requires `admin` role
   - Routes: dashboard, events, events/:id, users, classes

2. **Voter/Candidate Routes** (`/app/*`):
   - Wrapped in `VoterLayout` component
   - Accessible to all authenticated users
   - Routes: dashboard, vote/:eventId, results/:eventId, profile, candidate-settings

**Public Routes:** `/login`, `/signup`, `/reset-password`

### Database Schema

**Core Tables:**
- `profiles` - User profile data (full_name, student_id, department, class_id)
- `user_roles` - User role assignments (many-to-many)
- `classes` - Class/faculty data
- `election_events` - Election events with status (draft, active, closed), election type (open/closed), and visibility settings
- `event_voter_groups` - Many-to-many relationship between events and classes
- `candidates` - Candidate registrations per event (with vision/mission, photo, approval status, admin_notes)
- `candidate_notifications` - Notifications for candidate status changes
- `votes` - Vote records (unique constraint on voter_id + event_id)

**Key Relationships:**
- Users → Profiles (1:1, created via trigger on signup)
- Users → Roles (many-to-many via user_roles)
- Events → Voter Groups (many-to-many via event_voter_groups)
- Events → Candidates (1:many)
- Candidates → Profiles (many:1)
- Candidates → Notifications (1:many)
- Votes → Candidates, Events, Voters (foreign keys with constraints)

**Election Types:**
- `open` - Results visible in real-time, publicly accessible
- `closed` - Results only visible after election ends, controlled by `show_results_after_voting` and `public_results` flags

### UI Components

**Component Library:** shadcn/ui (Radix UI primitives)
- All UI components in `src/components/ui/`
- Uses Tailwind CSS with custom design tokens
- Theme: Supports dark mode via `next-themes`

**Custom Components:**
- `AdminLayout.tsx` - Admin sidebar navigation layout
- `VoterLayout.tsx` - Voter/candidate navigation layout
- `ProtectedRoute.tsx` - Authentication wrapper

**Feature-Specific Components (in `src/components/admin/`):**
- `users/` - User management dialogs (create, edit, delete, reset password, bulk import)
- `events/` - Event management dialogs (create, edit, delete, status change, candidate approval)
- `classes/` - Class management dialogs (create, edit, delete, bulk assign users)

### State Management

- **React Query** (@tanstack/react-query) for server state
- **Supabase client** for data fetching and real-time subscriptions
- **Local state** with useState/useEffect for component-level state
- **Auth state** managed globally via `useAuth` hook

### Styling

- **Tailwind CSS** with custom configuration
- Path alias: `@/` maps to `src/`
- Custom color system using CSS variables (HSL format)
- Custom gradients and shadows defined in theme
- Typography plugin available (@tailwindcss/typography)

### TypeScript Configuration

- Strict mode disabled for flexibility (noImplicitAny: false)
- Path aliases configured: `@/*` → `./src/*`
- Type definitions auto-generated from Supabase schema in `src/integrations/supabase/types.ts`

## Key Patterns

### Data Fetching
Use Supabase client with async/await:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```

### Role Checking
Access role information via `useAuth` hook:
```typescript
const { profile, isAdmin, isVoter, isCandidate } = useAuth();
// profile.roles is an array of role strings
```

### Navigation
Use React Router's `Link` component and `useNavigate` hook. Admin and app routes use separate layouts.

### Toast Notifications
Use `sonner` for toast notifications:
```typescript
import { toast } from 'sonner';
toast.success('Message');
toast.error('Error message');
```

### Forms
Use `react-hook-form` with `zod` for validation via `@hookform/resolvers`.

## Development Notes

- Dev server runs on port 8080 (not default 5173)
- ESLint configured with TypeScript support, unused vars warnings disabled
- Lovable.dev integration for AI-assisted development
- Date formatting uses `date-fns` library
- Indonesian language strings used throughout UI
- Vercel deployment configured with SPA rewrites and security headers

## Admin Setup

To create the default admin user:
```bash
# Set environment variables (use .env.local or export)
VITE_SUPABASE_URL=https://oiurjnmpkguyxevdbpbu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run setup script
npm run setup:admin
```

Default credentials:
- Email: `admin@univertex.com`
- Password: `UniVertex.02025`
- **Important:** Change password after first login

See `docs/SETUP_ADMIN.md` for detailed instructions.

## Key Features

### Candidate Approval System
- Candidates must be approved by admins before appearing in elections
- Approval workflow in `src/components/admin/events/ApproveCandidateDialog.tsx`
- Admin can approve, reject (with reason), or add notes
- Automatic notifications sent to candidates on status change

### Election Type System
- **Open Elections**: Results visible in real-time, publicly accessible on landing page
- **Closed Elections**: Results only visible after event closes, with optional public access
- Visibility controlled by `election_type`, `show_results_after_voting`, and `public_results` fields

### Voter Eligibility
- Events can be restricted to specific classes via `event_voter_groups`
- Voters only see elections they're eligible for (based on their class)
- Bulk user assignment to classes supported

## Documentation

Comprehensive docs available in `docs/`:
- `FEATURES_SUMMARY.md` - Complete feature reference
- `SETUP_ADMIN.md` - Admin user setup guide
- `CANDIDATE_APPROVAL_SYSTEM.md` - Candidate approval workflow
- `BULK_IMPORT_USERS_GUIDE.md` - User import instructions
- `EVENT_RESULTS_GUIDE.md` - Results visibility logic
- `TROUBLESHOOTING_FIXES.md` - Common issues and solutions
