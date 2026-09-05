# BURNBOARD Production Deployment Guide (Scaling to 10k+ Users)

This guide walks you through deploying **BURNBOARD** to production using Vercel, Supabase (Free Tier), and Resend (Free 100/day tier) with automated anti-spam shields and daily cleanup cron jobs.

---

## 🚀 1. Supabase Database Setup (Free Tier)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Open the **SQL Editor** tab.
3. Paste and run the entire contents of `supabase/schema.sql`.
4. Copy your **Project URL** (`https://xyz.supabase.co`) and **Anon Key** from `Project Settings -> API`.

---

## 📧 2. Resend Email Notifications Setup (Free Tier)
1. Go to [resend.com](https://resend.com) and create a free account.
2. Create an API Key in **API Keys**.
3. (Optional) Verify your sending domain, or use the default test sender.

---

## ⚡ 3. Deploying to Vercel
Deploy with 1 command or via GitHub connection:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy directly to production
vercel --prod
```

### Environment Variables to add in Vercel Dashboard:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RESEND_API_KEY=re_123456789
RATE_LIMIT_SALT=burnboard_secure_salt_2024
CRON_SECRET=generate-a-long-random-value
ADMIN_PASSWORD=generate-a-long-random-value
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

The admin dashboards (`/admin`, `/admin/growth`, `/admin/financials`,
`/admin/infrastructure`, `/admin/security`) **fail closed**: if
`ADMIN_PASSWORD` is not set, they return `503 admin_not_configured` — there
is no default password (see `docs/security/SECURITY_MODEL.md`).

---

## ⏰ 4. Automated Cleanup Cron Jobs
`vercel.json` contains a pre-configured daily cron schedule:
```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```
This automatically runs daily at 00:00 UTC to:
- Purge roasts marked as violations (`isClean = false`).
- Purge ghost target profiles with 0 roasts that are older than 7 days.
- Keep table indexes slim and lightning fast.

---

## 🛡️ 5. Scaling & Anti-Spam Architecture
- **30-Second Client Shield**: Prevents rapid clicking and rate limit fatigue.
- **IP Hashing & 5 Burns / 10 Min Window**: Halts bot-driven DDoS attempts.
- **1-Hour Duplicate Detection**: Forces unique, original burns per victim.
- **Admin dashboards**: gated by the `ADMIN_PASSWORD` environment variable (fail-closed, server-verified — no default) with live metric feeds and one-click JSON database backups.
