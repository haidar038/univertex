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
```

### Database (Supabase)
The project uses Supabase with migrations stored in `supabase/migrations/`. Database changes are managed through Supabase migrations:
- Project ID: `oiurjnmpkguyxevdbpbu`
- Migrations use SQL files with timestamps

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
- `election_events` - Election events with status (draft, active, closed)
- `candidates` - Candidate registrations per event (with vision/mission)
- `votes` - Vote records (unique constraint on voter_id + event_id)

**Key Relationships:**
- Users → Profiles (1:1, created via trigger on signup)
- Users → Roles (many-to-many via user_roles)
- Events → Candidates (1:many)
- Candidates → Profiles (many:1)
- Votes → Candidates, Events, Voters (foreign keys with constraints)

### UI Components

**Component Library:** shadcn/ui (Radix UI primitives)
- All UI components in `src/components/ui/`
- Uses Tailwind CSS with custom design tokens
- Theme: Supports dark mode via `next-themes`

**Custom Components:**
- `AdminLayout.tsx` - Admin sidebar navigation layout
- `VoterLayout.tsx` - Voter/candidate navigation layout
- `ProtectedRoute.tsx` - Authentication wrapper

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
