# BURNBOARD Data Backup & Disaster Recovery Guide

BURNBOARD provides multiple zero-cost mechanisms to backup, snapshot, and restore your platform data.

---

## 💾 1. Instant One-Click JSON Backup (Admin Dashboard)
1. Go to the Admin dashboard: `/#admin`
2. Enter the admin key (`burn2024`)
3. Click the **"Export Backup"** / **"Export JSON"** button in the top right.
4. A full JSON snapshot will download with:
   - `profiles`
   - `roasts` (with upvotes and reaction counts)
   - `battles`
   - `reports`
   - `blocked_ips`
   - `analytics_events`

---

## 🗄️ 2. Supabase Cloud Database Backups
### Method A: Supabase Dashboard
1. Go to your Supabase Project Dashboard -> **Database** -> **Backups**.
2. Supabase automatically creates daily point-in-time snapshots on the free tier.

### Method B: PostgreSQL CLI Dump (`pg_dump`)
```bash
pg_dump "postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
  --schema public \
  --data-only \
  > burnboard_backup_$(date +%Y%m%d).sql
```

---

## 🔄 3. Restoring from JSON Backup
If migrating to a new Supabase project or testing locally:
1. Open the SQL Editor in Supabase and run `supabase/schema.sql` to initialize tables.
2. Use the Supabase Table Editor or a script to import the JSON arrays from your exported backup file.
