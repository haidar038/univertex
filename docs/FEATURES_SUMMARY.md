# 🎯 UniVertex - Features Summary

Quick reference guide untuk semua fitur yang tersedia di UniVertex E-Voting System.

---

## 👥 User Roles

### 1. **Admin** 👨‍💼
**Access:** Full system control
- Manage users, events, classes
- Approve/reject candidates
- Monitor voting progress
- View all results
- System configuration

### 2. **Voter** 🗳️
**Access:** Voting & results viewing
- Vote in eligible elections
- View election information
- See results (based on settings)
- Manage profile

### 3. **Candidate** 🏆
**Access:** Candidate profile management
- Register for elections
- Manage vision & mission
- Upload profile photo
- View performance statistics
- Receive notifications

**Note:** Users can have multiple roles simultaneously.

---

## 🎨 Features by Module

### 📊 **Admin Dashboard**
```
✅ Statistics Overview
   - Total users, events, votes
   - Active elections count
   - Recent activity feed

✅ Quick Actions
   - Create event
   - Add user
   - Manage classes
```

### 🗳️ **Election Management**
```
✅ Create Election
   - Title & description
   - Start/end time
   - Status (draft/active/closed)
   - Election type (open/closed)
   - Show results after voting
   - Public results toggle

✅ Manage Elections
   - Edit event details
   - Change status
   - Delete events
   - View participants

✅ Voter Groups
   - Assign classes to events
   - Class-based eligibility
   - Multiple group support
```

### 👤 **User Management**
```
✅ View Users
   - List all users
   - Filter by role
   - Search functionality

✅ Create User
   - Manual user creation
   - Assign roles
   - Assign to class

✅ Edit User
   - Update profile
   - Change roles
   - Reassign class
   - Delete user
```

### 🏫 **Class Management**
```
✅ Manage Classes
   - Create class/faculty
   - Edit class info
   - View students
   - Delete class
```

### 🎭 **Candidate Management**
```
✅ Approval System
   - Review pending candidates
   - Approve candidates
   - Reject with reason
   - Add admin notes

✅ Notifications
   - Auto-notify on status change
   - View notification history
```

### 🗳️ **Voting Features**
```
✅ Voter Dashboard
   - View active elections (class-eligible)
   - Election type indicator
   - Already voted badge
   - Quick access to voting

✅ Voting Process
   - View candidate profiles
   - Read vision & mission
   - See candidate photos
   - Select & confirm vote
   - Duplicate vote prevention

✅ Results Viewing
   - Vote counts
   - Percentages
   - Winner highlight
   - Progress bars
   - Access control (based on settings)
```

### 🏆 **Candidate Features**
```
✅ Candidate Dashboard
   - Registration status
   - Vote statistics
   - Rankings & performance
   - Notification inbox

✅ Profile Management
   - Upload photo
   - Edit vision & mission
   - View rejection reasons
   - Status tracking
```

### 🌐 **Public Features**
```
✅ Landing Page
   - Hero section
   - Feature highlights
   - Active elections
   - Public results section

✅ Public Results
   - View without login (if enabled)
   - Live results for open elections
   - Final results for closed (if public)
   - Access control with explanations
```

---

## ⚙️ Election Type Settings

### **Pemilihan Terbuka (Open)** 🔓
```
Hasil visible real-time untuk semua orang

✅ Voter bisa lihat hasil sebelum voting
✅ Hasil tampil di public landing page
✅ Live updates saat voting berlangsung
✅ Badge "Live" pada hasil
✅ Siapa saja bisa lihat tanpa login

Use case:
- Election dengan transparansi penuh
- Quick poll / survey
- Public opinion gathering
```

### **Pemilihan Tertutup (Closed)** 🔒
```
Hasil hanya tampil setelah pemilihan selesai

❌ Hasil TIDAK tampil selama voting
✅ Hasil tampil setelah status = closed
⚙️ Optional: Show results after voting
⚙️ Optional: Public results

Use case:
- Official elections
- Formal voting processes
- Prevent bandwagon effect
```

### **Konfigurasi Visibilitas**

| Setting | Active & Open | Active & Closed | Closed & Public | Closed & Private |
|---------|---------------|-----------------|-----------------|------------------|
| **Public dapat lihat** | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| **Voter sebelum vote** | ✅ Yes | ❌ No | N/A | N/A |
| **Voter setelah vote** | ✅ Yes | ⚙️ Optional | ✅ Yes | ✅ Yes (login) |
| **Landing page** | ✅ Yes | ❌ No | ✅ Yes | ❌ No |

---

## 🔐 Security Features

```
✅ Row Level Security (RLS)
✅ Role-based access control
✅ Unique vote constraint
✅ Email verification
✅ Password hashing
✅ Secure API keys
✅ Protected routes
✅ Input validation
```

---

## 📱 Platform Support

| Platform | Support Level |
|----------|---------------|
| Desktop (Chrome/Edge) | ✅ Excellent |
| Desktop (Firefox) | ✅ Excellent |
| Desktop (Safari) | ✅ Good |
| Mobile (iOS) | ⚠️ Good (needs optimization) |
| Mobile (Android) | ⚠️ Good (needs optimization) |
| Tablet | ✅ Good |

---

## 🎨 UI Components

### **Available Components**
```
✅ Buttons (variants: default, outline, ghost, destructive)
✅ Cards (with header, content, footer)
✅ Badges (variants: default, secondary, outline, destructive)
✅ Dialogs & Alert Dialogs
✅ Forms (Input, Textarea, Select, Checkbox, Radio)
✅ Tables (with sorting)
✅ Toast Notifications
✅ Loading States
✅ Image Upload
✅ Navigation (Admin sidebar, Voter navbar)
```

### **Design System**
```
✅ Tailwind CSS
✅ Dark mode support
✅ Custom color palette (HSL)
✅ Responsive breakpoints
✅ Icon system (Lucide React)
✅ Typography scale
```

---

## 🔄 Workflow Examples

### **Admin Creates Election**
```
1. Login as Admin
2. Navigate to Events
3. Click "Buat Acara Baru"
4. Fill form:
   - Title, description, dates
   - Election type (open/closed)
   - Visibility settings
   - Status
5. Assign voter groups (classes)
6. Add candidates manually (or candidates self-register)
7. Approve candidates
8. Set status to "Active"
9. Monitor results
```

### **User Votes**
```
1. Login as Voter
2. Dashboard shows eligible elections
3. Click "Berikan Suara"
4. View candidate profiles
5. Select candidate
6. Confirm vote
7. [If enabled] View results
8. Return to dashboard
```

### **Candidate Registers**
```
1. Login with candidate role
2. Navigate to Candidate Settings
3. Upload photo
4. Enter vision & mission
5. Submit for approval
6. Wait for admin approval
7. Get notification on status change
8. [If approved] Profile visible to voters
9. Monitor performance on dashboard
```

---

## 📊 Database Schema Overview

### **Core Tables**
```sql
users (Supabase Auth)
├── profiles (1:1)
│   ├── user_roles (many:many)
│   └── classes (many:1)
│
├── election_events
│   ├── candidates (1:many)
│   ├── votes (1:many)
│   └── event_voter_groups (many:many with classes)
│
└── candidate_notifications
```

### **Key Relationships**
```
User → Profile (auto-created on signup)
User → Roles (can have multiple)
User → Class (optional)
Event → Candidates (multiple)
Event → Voter Groups (class-based)
Candidate → Votes (tracked)
Voter → Votes (unique per event)
```

---

## 🚀 Quick Start for Developers

### **Setup**
```bash
# 1. Clone & install
git clone <repo>
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Run development server
npm run dev

# 4. Build for production
npm run build
```

### **Common Commands**
```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Dev build with source maps
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### **Database Commands**
```bash
npx supabase db push                    # Push migrations
npx supabase gen types typescript ...   # Generate types
```

---

## 📞 Support & Resources

### **Documentation**
- `README.md` - Setup & installation
- `CLAUDE.md` - Development guidelines
- `PROJECT_PROGRESS_REPORT.md` - Full progress analysis
- `ADMIN_COMPONENTS_GUIDE.md` - Admin component usage

### **Tech Stack**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **UI:** shadcn/ui + Tailwind CSS
- **Forms:** React Hook Form + Zod
- **Routing:** React Router v6
- **State:** React Query + Local State

### **Key Dependencies**
```json
{
  "react": "^19.2.0",
  "typescript": "^5.8.3",
  "@supabase/supabase-js": "^2.78.0",
  "tailwindcss": "^3.4.17",
  "react-router-dom": "^6.30.1",
  "react-hook-form": "^7.61.1",
  "zod": "^3.25.76",
  "date-fns": "^3.6.0"
}
```

---

**Last Updated:** November 2, 2025
**Version:** 1.0.0
