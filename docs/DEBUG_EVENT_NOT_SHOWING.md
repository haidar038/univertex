# Debug Guide: Events Not Appearing

## Problem: Events don't show on landing page or voter/candidate dashboard even though they're active

---

## Step-by-Step Debugging

### Step 1: Check Browser Console

1. **Press F12** to open Developer Tools
2. Go to **Console** tab
3. Look for logs when you open the dashboard

**What to look for:**
```
Fetching events for user: {userId: "...", classId: "...", fullName: "..."}
Eligible groups fetch: {classId: "...", eligibleGroups: [...], error: null}
Eligible event IDs: ["event-id-1", "event-id-2"]
```

**Common Issues:**
- ❌ `classId: null` → User has no class assigned
- ❌ `eligibleGroups: []` → No events assigned to this class
- ❌ `error: {...}` → Database or permission error

---

### Step 2: Verify Database Tables

Open **Supabase Dashboard → SQL Editor** and run these queries:

#### Query 1: Check if event exists and is active
```sql
SELECT id, title, status, start_time, end_time
FROM election_events
WHERE status = 'active';
```

**Expected:** Should return at least 1 row with your event
**If empty:** Event is not active or doesn't exist

#### Query 2: Check if user has a class
```sql
SELECT
  p.id,
  p.full_name,
  p.student_id,
  p.class_id,
  c.name as class_name
FROM profiles p
LEFT JOIN classes c ON p.class_id = c.id
WHERE p.student_id = 'YOUR_NIM_HERE';
-- Replace YOUR_NIM_HERE with actual NIM
```

**Expected:** `class_id` should NOT be null
**If null:** User has no class assigned

#### Query 3: Check if class is assigned to event
```sql
SELECT
  ee.id as event_id,
  ee.title as event_title,
  ee.status,
  c.id as class_id,
  c.name as class_name
FROM event_voter_groups evg
JOIN election_events ee ON evg.event_id = ee.id
JOIN classes c ON evg.class_id = c.id
WHERE ee.status = 'active';
```

**Expected:** Should show your class linked to your event
**If empty:** No classes assigned to any active events

#### Query 4: Check specific user's eligible events
```sql
-- Replace USER_ID with actual user ID
WITH user_class AS (
  SELECT class_id FROM profiles WHERE id = 'USER_ID'
)
SELECT
  ee.id,
  ee.title,
  ee.status,
  c.name as class_name
FROM event_voter_groups evg
JOIN election_events ee ON evg.event_id = ee.id
JOIN classes c ON evg.class_id = c.id
WHERE evg.class_id = (SELECT class_id FROM user_class)
  AND ee.status = 'active';
```

**Expected:** Should return active events for user's class
**If empty:** User's class is not assigned to any active event

---

### Step 3: Check Admin Setup

Go through this checklist as **Admin**:

#### ✅ Checklist 1: Class Created
1. Go to `/admin/classes`
2. Verify class exists (e.g., "Informatika 2022")
3. Note the class name

#### ✅ Checklist 2: User Assigned to Class
1. Go to `/admin/users`
2. Find the user
3. Check "Kelas" column - should show class name
4. If empty:
   - Click Edit (pencil icon)
   - Select class from dropdown
   - Save

#### ✅ Checklist 3: Event Created and Active
1. Go to `/admin/events`
2. Find your event
3. Check status badge:
   - ✅ Green "Aktif" = Active
   - ⚠️ Gray "Draft" = Not active (need to activate)
   - 🔴 Red "Selesai" = Closed

**If Draft:**
1. Click ⋮ (three dots) on the event
2. Select "Ubah Status"
3. Change to "Active"
4. Save

#### ✅ Checklist 4: Class Assigned to Event
**This is the MOST COMMONLY MISSED step!**

1. Go to `/admin/events/:id` (click on your event)
2. Click tab **"Pemilih (DPT)"**
3. Check if your class is listed
4. **If empty or class not listed:**
   - Click button **"Kelola Grup Pemilih"**
   - Find your class in the list
   - Check the checkbox next to it
   - Click **"Simpan"**

**This creates entries in `event_voter_groups` table!**

---

### Step 4: Common Scenarios & Solutions

#### Scenario A: "I created an event but voters can't see it"

**Cause:** Event status is "draft" OR no classes assigned to event

**Solution:**
1. Activate event: `/admin/events` → ⋮ → Ubah Status → Active
2. Assign classes: `/admin/events/:id` → Tab "Pemilih" → Kelola Grup Pemilih

#### Scenario B: "Events show on landing page but not in voter dashboard"

**Cause:** User has no class OR user's class not assigned to event

**Solution:**
1. Check user has class: `/admin/users` → Edit user → Select class
2. Assign class to event: `/admin/events/:id` → Tab "Pemilih" → Add class

#### Scenario C: "Some users see the event, others don't"

**Cause:** Users are in different classes, only some classes assigned to event

**Solution:**
1. Check which classes are assigned: `/admin/events/:id` → Tab "Pemilih"
2. Add missing classes: Click "Kelola Grup Pemilih" → Select all needed classes

#### Scenario D: "Candidate dashboard shows no events"

**Cause:** Candidates must ALSO be assigned to a class AND be registered as candidate in event

**Solution:**
1. Assign candidate to class (same as voter)
2. Register as candidate: `/admin/events/:id` → Tab "Kandidat" → Tambah Kandidat
3. Assign candidate's class to event (if not already)

---

### Step 5: Manual Database Fix (If needed)

If admin UI is not working, you can manually insert into `event_voter_groups`:

```sql
-- Get class ID
SELECT id, name FROM classes WHERE name = 'Informatika 2022';
-- Note the ID

-- Get event ID
SELECT id, title FROM election_events WHERE title LIKE '%BEM%';
-- Note the ID

-- Manually link class to event
INSERT INTO event_voter_groups (event_id, class_id)
VALUES (
  'YOUR-EVENT-UUID-HERE',
  'YOUR-CLASS-UUID-HERE'
)
ON CONFLICT (event_id, class_id) DO NOTHING;

-- Verify
SELECT
  ee.title as event,
  c.name as class
FROM event_voter_groups evg
JOIN election_events ee ON evg.event_id = ee.id
JOIN classes c ON evg.class_id = c.id;
```

---

### Step 6: Check RLS Policies

If data exists but still doesn't show, check Row Level Security:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('election_events', 'event_voter_groups', 'profiles');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('election_events', 'event_voter_groups')
ORDER BY tablename, policyname;
```

**Expected policies:**
- `election_events`: "Everyone can view active and closed events"
- `event_voter_groups`: Readable by authenticated users

---

## Quick Fix Workflow

### For Admin: Enable Event Visibility in 3 Steps

```
Step 1: Activate Event
/admin/events → ⋮ → Ubah Status → Active

Step 2: Assign Class to Event
/admin/events/:id → Tab "Pemilih (DPT)" → Kelola Grup Pemilih → ✓ Select classes → Simpan

Step 3: Verify
Log out → Log in as voter → Check dashboard
```

### For User: Verify Setup

```
Step 1: Check Console
F12 → Console tab → Look for logs

Step 2: Check Profile
/app/profile → Verify class is shown

Step 3: Contact Admin
If class is null or event not showing, contact admin to:
1. Assign you to a class
2. Link your class to the event
```

---

## Testing Checklist

After making changes, test in this order:

### As Admin:
- [ ] Event created and status = "active"
- [ ] At least one class exists
- [ ] At least one user assigned to that class
- [ ] Class assigned to event via "Kelola Grup Pemilih"
- [ ] SQL query shows event in `event_voter_groups`

### As Voter:
- [ ] Logout and login again
- [ ] Open dashboard
- [ ] Console shows correct classId
- [ ] Console shows eligible event IDs
- [ ] Event card appears on dashboard

### On Landing Page:
- [ ] Event appears in "Pemilihan yang Sedang Berlangsung"
- [ ] Event details (title, dates) are correct

---

## Still Not Working?

### Enable Debug Mode

Add this to browser console:
```javascript
localStorage.setItem('debug', 'true');
// Then refresh page
```

This will show more detailed logs.

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Click "Logs" in sidebar
3. Filter by:
   - Table: `election_events`, `event_voter_groups`
   - Error level: Errors

### Export Debug Info

Run this in browser console and share with developer:

```javascript
const debugInfo = {
  user: await supabase.auth.getUser(),
  profile: await supabase.from('profiles').select('*').eq('id', (await supabase.auth.getUser()).data.user.id).single(),
  events: await supabase.from('election_events').select('*').eq('status', 'active'),
  voterGroups: await supabase.from('event_voter_groups').select('*'),
  classes: await supabase.from('classes').select('*')
};
console.log(JSON.stringify(debugInfo, null, 2));
```

---

## Summary

**The #1 reason events don't show: Class not assigned to event!**

Always remember:
1. ✅ Create event
2. ✅ Activate event (change status to "active")
3. ✅ Create class
4. ✅ Assign users to class
5. ✅ **Assign class to event** ← Most commonly forgotten!

The last step is done via:
`/admin/events/:id` → Tab "Pemilih (DPT)" → "Kelola Grup Pemilih"

This creates the link in `event_voter_groups` table that connects classes to events!
