# 🔥 BURNBOARD — Final Production Launch Version

> **No AI. Just Humans Roasting Humans.**  
> The brutal, anonymous social media roast platform. Submit profiles from LinkedIn, X, GitHub, and Instagram, write high-IQ human burns, vote in live 1v1 roast battles, and export viral 1080x1080 social cards.

---

## ⚡ Tech Stack

- **Framework**: React 19 / Vite + Next.js App Router compatible structure
- **Styling**: Tailwind CSS 4, Motion animations, Lucide Icons
- **Database & Realtime**: Supabase (PostgreSQL, Realtime websocket channels, Row Level Security)
- **Analytics**: `@vercel/analytics` + Zero-Cost Event Funnel Tracker
- **Sharing & OG**: Dynamic HTML5 Canvas 1080x1080 card rendering engine
- **Monetization**: Support Bar ($0-to-first-$ Buy Me a Coffee), Weekly Sponsored Ad Slots ($10/wk) with "10-Roast Ad Free" unlock
- **Deployment Target**: Vercel (`vercel --prod`) & Cloud Run

---

## 🛠️ Supabase SQL Database Schema

Run this in your **Supabase SQL Editor** to bootstrap the tables and realtime replication:

```sql
-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  bio TEXT NOT NULL,
  avatar_letter TEXT NOT NULL,
  avatar_color TEXT,
  tagline TEXT,
  roast_count INTEGER DEFAULT 0,
  total_upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROASTS TABLE
CREATE TABLE IF NOT EXISTS roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  reaction_haha INTEGER DEFAULT 0,
  reaction_brutal INTEGER DEFAULT 0,
  reaction_cry INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BATTLES TABLE
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  votes1 INTEGER DEFAULT 0,
  votes2 INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NOTIFICATIONS TABLE (Subscribers)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE roasts;
ALTER PUBLICATION supabase_realtime ADD TABLE battles;
```

---

## 🚀 Quick Setup & Local Run

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.local.example .env.local
```
Fill in your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Run the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

---

## 📦 Vercel Deploy Command

Deploy directly to Vercel in seconds:

```bash
vercel --prod
```

Set the following environment variables in your Vercel Project Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (e.g. `https://burnboard.app`)

---

## 👑 Features Breakdown

1. **SEO Domination**:
   - Dynamic platform pages: `/roast/linkedin`, `/roast/github`, `/roast/x`, `/roast/instagram`
   - XML Sitemap generator (`/sitemap.xml`)
   - Google Rich Results JSON-LD WebSite & Organization structured data

2. **Monetization Engine**:
   - Top Support Bar: "Buy us a coffee to keep it brutal ☕" (once per session)
   - AdSlot after every 5 profiles in feed ($10/week sponsor banner)
   - Ad-free unlock if user submits > 10 roasts
   - "Advertise here" direct sponsor inquiries

3. **Viral Growth & Retention Kit**:
   - 1080x1080 high-res quote cards for 𝕏 and Reddit
   - Post-roast "Invite 2 friends" share challenge modal
   - "Get Notified" alerts for target threads
   - Hall of Fame for top anonymous roasters

4. **Analytics & Admin Dashboard**:
   - `/admin` dashboard — gated by the `ADMIN_PASSWORD` environment variable
     (fail-closed: no default password; see `.env.example`)
   - Real-time event tracking (`profile_submitted`, `roast_submitted`, `upvote_clicked`, `battle_voted`, `share_clicked`)
   - Vercel Analytics integration

5. **Moderation & Safety**:
   - Profanity & hate speech blacklist checking
   - Report queue & right-to-be-forgotten deletion modal

---

## ⚖️ License
Built with hate ❤️. No AI. 100% Human Roasts.
