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
├── database/
│   ├── schema.sql          # Database schema + RLS policies + seed data
│   └── migrations/         # Updates for existing projects
└── supabase/
    └── functions/
        └── admin-create-user/ # Secure admin-only account creation
```

### Why use Supabase Edge Functions?

The application uses a static frontend with Supabase Auth and PostgreSQL. Creating Auth users requires the Supabase Admin API, so it is handled by the `admin-create-user` Edge Function. Its service-role key stays in Supabase and is never sent to the browser.

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
- Configure Row Level Security policies, including admin-only role changes and deletes
- Set up auto-profile trigger on user signup
- Insert default patrol checkpoints (28 items across 7 categories)

For an **existing project**, run `database/migrations/20261023_security_hardening.sql` in Supabase SQL Editor before deploying the updated frontend. This migration restricts profile visibility, prevents users from changing their own role, makes the signup trigger assign only the caretaker role, enforces disabled-account access rules, and keeps admin controls working without recursive RLS checks.

### Step 3: Configure Authentication

1. Left menu → **Authentication** → **Settings**
2. Disable public sign-ups if accounts should be created only by administrators. The Edge Function uses the Admin API and can create users when public sign-ups are disabled.

### Step 4: Create Admin Account

1. Left menu → **Authentication** → **Users** → **Add user**
2. Fill in:
   - **Email**: `admin@regency.com`
   - **Password**: Set a strong password and save it
3. Expand **User Metadata** and enter only the display name:
   ```json
   {"display_name": "System Admin"}
   ```
4. Click **Create user**
5. The trigger creates the profile with the safe default `caretaker` role.
6. In Supabase SQL Editor, promote this first account:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE username = 'admin@regency.com';
   ```
   Run this only for the trusted first administrator. Do not accept roles from user metadata.

### Step 5: Create User Accounts

Create and assign users through the live application's **Admin → Add User** form after deploying the Edge Function below. New accounts receive the selected role through the trusted server function; passwords must be at least 8 characters.

### Step 6: Get API Keys

1. Left menu → **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g. `https://xxx.supabase.co`)
   - **publishable/anon key** (copy the key shown for this project)

### Step 7: Configure Frontend

1. Copy `js/config.example.js` to `js/config.js`
2. Set your project URL and publishable/anon key in `js/config.js`:
   ```javascript
   window.ENV = {
       SUPABASE_URL: 'https://your-project.supabase.co',
       SUPABASE_ANON_KEY: 'your-publishable-key'
   };
   ```
   `js/config.js` is excluded from Git; do not remove it from `.gitignore` or put a service-role key in it.

### Step 8: Launch

#### Option A: Local (Simplest)
Serve the project with a local static web server and open `index.html`. Account creation also requires the deployed Supabase Edge Function.

#### Option B: Vercel (Recommended)
1. Push the folder to GitHub
2. Import in Vercel → Deploy

#### Option C: Netlify
1. Drag `patrolling-checklist` folder to [Netlify Drop](https://app.netlify.com/drop)
2. Done!

### Deploy the Supabase Edge Function

Install the Supabase CLI, then link this repository to your Supabase project and deploy the account-creation function:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-create-user
```

Supabase provides the function's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Never add a service-role key to frontend code or commit it to GitHub. The function verifies the caller's session and active admin profile before creating an account.

---

## User Guide

### Caretaker Workflow

```
Login -> Today's Patrol ->
  ① Confirm date and enter caretaker name
  ② Record observations and actions for patrol areas
  ③ Enter signature
-> Save Patrol
```

### Admin Features
- View all caretakers' patrol submissions
- Create caretaker or admin accounts through the secured Edge Function
- View the user list and patrol history

---

## Mapping from Paper Form

| Paper Form Field | System Feature |
|---|---|
| Date | Selected in the patrol form |
| Security/Caretaker Name | Entered in the patrol form |
| Patrol Area(s) | Listed in the patrol form |
| Observation/Incident | Text input |
| Action Taken | Text input |
| Signature | Signature input |

---

## Security Notes

- All data stored in **Supabase Cloud** (US region or Singapore)
- Each caretaker **sees only their own records and profile**
- Admin can see all records
- Passwords are managed by Supabase Auth, never stored client-side
- Only admins can grant roles or delete patrol records
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
A: The form can be filled locally, but saving requires an active connection to Supabase.

**Q: Can data be lost?**
A: Data is stored in Supabase cloud with automatic backups. No data loss.

**Q: Can I print the patrol record?**
A: Yes! Press Ctrl+P in the browser to print or save as PDF.

---

*Built for The Regency Strata · 701 7995 Westminster Hwy, Richmond BC*