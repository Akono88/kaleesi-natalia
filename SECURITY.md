# Kaleesi Natalia — Security Setup

## Row-Level Security (RLS) — REQUIRED for production

The Supabase anon key is embedded in `index.html` so the app can work without a backend. Without RLS policies, anyone with the anon key could read/write your data directly.

### Enable RLS on the `kaleesi_data` table

Run these SQL statements in the Supabase SQL editor:

```sql
-- Enable RLS
ALTER TABLE kaleesi_data ENABLE ROW LEVEL SECURITY;

-- Option A (simplest): Block all anon access entirely.
-- Requires switching the app to use Supabase Auth sessions.

-- Option B (pragmatic): Only block access to the sensitive users row.
CREATE POLICY "anon can read non-sensitive rows"
  ON kaleesi_data FOR SELECT TO anon
  USING (id NOT IN ('kaleesi-users', 'kaleesi-audit'));

CREATE POLICY "anon can write non-sensitive rows"
  ON kaleesi_data FOR INSERT TO anon
  WITH CHECK (id NOT IN ('kaleesi-users', 'kaleesi-audit'));

CREATE POLICY "anon can update non-sensitive rows"
  ON kaleesi_data FOR UPDATE TO anon
  USING (id NOT IN ('kaleesi-users', 'kaleesi-audit'));
```

> **Note:** Option B leaves passwords/audit protected only if you migrate user management to an Edge Function with the service role key. Until then, anyone with your anon key technically can't read those rows but also can't log in. For true security, migrate to Supabase Auth (`sb.auth.signInWithPassword`) — that will take a follow-up iteration.

### Rotate keys if compromised

1. Go to Supabase dashboard → Settings → API
2. Click "Regenerate anon key"
3. Update `SUPABASE_KEY` in `index.html` (line ~1931)
4. Commit and push

### Also enable RLS on other tables

```sql
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON schedule FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON push_subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);
```

## Default admin

On first load, a default admin account is seeded:
- Username: `admin`
- Password: `admin`

**Change this immediately** via the ADMIN tab → Reset password.
