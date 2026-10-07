# Patrol Checklist System

**The Regency** — 701 7995 Westminster, Richmond BC

A digital patrol checklist system that replaces the paper Patrol Log Book. Caretakers log in daily to record their patrol observations.

---

## Project Structure

```
patrolling-checklist/
├── index.html              # Main SPA application
├── admin-preview.html      # Visual preview of the admin page
├── .env.example            # Environment variable template
├── .gitignore              # Git exclusion rules
│
├── js/
│   ├── supabase-client.js  # Supabase database operations layer
│   └── auth.js             # Authentication module
│
└── database/
    └── schema.sql          # Database schema + RLS policies + seed data
```

### Why no backend server?

This is a pure frontend + Supabase architecture:
- No server to maintain — Supabase handles auth, database, and permissions
- Works instantly — just configure your Supabase project
- Secure — Row Level Security (RLS) ensures users see only their own data

---

## Deployment Guide

### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) → **Start your project**
2. Log in and click **New project**
3. Fill in:
   - **Name**: `patrol-checklist` (or any name)
   - **Database Password**: Set a strong password and save it
   - **Region**: Choose **Singapore** (US West is also fine for Vancouver)
4. Click **Create new project** (takes ~2 minutes)

### Step 2: Run the Database Schema

1. In Supabase Dashboard, go to **SQL Editor** (left menu)
2. Click **New Query** → **New SQL Query**
3. Open `database/schema.sql` from this project, **copy all content** (Ctrl+A → Ctrl+C)
4. Paste into SQL Editor → Click **Run**
5. Wait for green success message

This SQL will:
- Create 4 tables (profiles, patrols, checklist_items, patrol_results)
- Configure Row Level Security policies
- Set up auto-profile trigger on user signup
- Insert default patrol checkpoints (28 items across 7 categories)

### Step 3: Configure Authentication

1. Left menu → **Authentication** → **Settings**
2. Under **SIGN UP / SIGN IN**:
   - **Disable** "Enable email confirmations" (for internal team use)
3. Under **Security**:
   - Ensure users can register without email confirmation

### Step 4: Create Admin Account

1. Left menu → **Authentication** → **Users** → **Add user**
2. Fill in:
   - **Email**: `admin@regency.com`
   - **Password**: Set a strong password (e.g. `Admin123!`)
3. Expand **User Metadata** and enter:
   ```json
   {"display_name": "System Admin", "role": "admin"}
   ```
4. Click **Create user**
5. The trigger auto-creates a profile in the `profiles` table
6. Verify: Go to **Table Editor** → `profiles` table → check role is "admin"

### Step 5: Create Caretaker Accounts

1. In **Authentication** → **Users** → **Add user**
2. Fill in caretaker info:
   - **Email**: `alex@regency.com`
   - **Password**: e.g. `123456`
   - **User Metadata**:
     ```json
     {"display_name": "Alex Chen", "role": "caretaker"}
     ```
3. Repeat for each caretaker

### Step 6: Get API Keys

1. Left menu → **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g. `https://xxx.supabase.co`)
   - **anon public key** (e.g. `eyJhbGciOiJ...`)

### Step 7: Configure Frontend

1. Open `js/supabase-client.js`
2. Find `SUPABASE_CONFIG` and paste your values:
   ```javascript
   const SUPABASE_CONFIG = {
       url: 'https://your-project.supabase.co',
       anonKey: 'your-anon-public-key'
   };
   ```

### Step 8: Launch

#### Option A: Local (Simplest)
Just double-click `index.html` to open in your browser. Data is stored in Supabase cloud.

#### Option B: Vercel (Recommended)
1. Push the folder to GitHub
2. Import in Vercel → Deploy

#### Option C: Netlify
1. Drag `patrolling-checklist` folder to [Netlify Drop](https://app.netlify.com/drop)
2. Done!

---

## User Guide

### Caretaker Workflow

```
Login -> Today's Patrol -> Add Patrol Entry ->
  ① Select date and time range
  ② Check patrol areas (Garbage Area / Parkade-P1~P6 / Other)
  ③ Enter observations and actions taken
  ④ Sign
  (Add multiple entries per day if needed)
-> Fill Daily Summary
-> Sign -> Submit
```

### Daily Summary Fields
- Any unusual activities observed?
- Unauthorized individuals noticed?
- Damages, lights out, or safety hazards?

### Admin Features
- View all caretakers' patrol submissions
- Add / Edit / Disable caretaker accounts
- Statistics overview (today / this week / this month)

---

## Mapping from Paper Form

| Paper Form Field | System Feature |
|---|---|
| Date | Auto-recorded on submission |
| Security/Caretaker Name | Auto-detected from login |
| Patrol Area(s) | Checkbox selection |
| Observation/Incident | Text input |
| Action Taken | Text input |
| Signature | Signature input |
| Daily Summary | 3-field summary form |

---

## Security Notes

- All data stored in **Supabase Cloud** (US region or Singapore)
- Each caretaker **sees only their own records**
- Admin can see all records
- Passwords are managed by Supabase Auth, never stored client-side
- Back up your database regularly (Supabase Dashboard → Database → Backups)

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Supabase Auth | User authentication |
| Supabase PostgreSQL | Data storage |
| Supabase RLS | Access control |
| HTML + CSS + JS | Frontend interface |
| Vercel / Netlify | Hosting |

---

## FAQ

**Q: What do caretakers need to install?**
A: Nothing! Just a browser. Works on phone, tablet, and computer.

**Q: What if the internet goes down?**
A: Drafts are auto-saved to browser local storage. Submit when connection resumes.

**Q: Can data be lost?**
A: Data is stored in Supabase cloud with automatic backups. No data loss.

**Q: Can I print the patrol record?**
A: Yes! Press Ctrl+P in the browser to print or save as PDF.

---

*Built for The Regency Strata · 701 7995 Westminster Hwy, Richmond BC*