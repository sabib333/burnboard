# 🔥 BURNBOARD — Final Launch Checklist

## Pre-Launch (Do These First)

### Database & Backend
- [ ] Run `supabase/schema.sql` in Supabase SQL Editor
- [ ] Verify all 7 tables created (profiles, roasts, battles, reports, blocked_ips, email_subscribers, daily_winner)
- [ ] Verify Realtime enabled on roasts, profiles, battles
- [ ] Run `node scripts/seed.js` to populate demo data (20 profiles + 100 roasts)

### Environment Variables
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://burnboard.app` in Vercel
- [ ] (Optional) Set `RESEND_API_KEY` if using email notifications

### Security
- [ ] Set `ADMIN_PASSWORD` (strong random) in every environment — admin surfaces fail closed (503) without it; there is no default
- [ ] Set `CRON_SECRET` (strong random) so scheduled endpoints stay fail-closed
- [ ] Verify content filter blocks slurs and hate speech
- [ ] Test rate limiting (30s cooldown between roasts)

---

## PWA & Mobile

- [ ] PWA manifest loads correctly (`/manifest.json`)
- [ ] Service worker registers (check DevTools → Application)
- [ ] App installs on iOS (Add to Home Screen works)
- [ ] App installs on Android (Install prompt appears)
- [ ] Offline page shows when network disconnected
- [ ] Bottom mobile nav works on small screens
- [ ] Pull-to-refresh works on mobile
- [ ] Haptic feedback (vibration) works on upvote/vote

---

## Branding & Design

- [ ] OG image loads on social media share previews
- [ ] Favicon shows in browser tab
- [ ] Logo SVG renders at `/brand/logo.svg`
- [ ] Color theme consistent: `#0a0a0a` background, `#ff4d00` accent
- [ ] Typography: Inter/Plus Jakarta Sans loaded
- [ ] All platform icons render (LinkedIn blue, GitHub dark, X black, Instagram gradient)

---

## Features Verification

### Core Features
- [ ] Main feed loads with profiles
- [ ] Can submit new roast target
- [ ] Can write and submit roasts (280 char limit)
- [ ] Upvote system works
- [ ] Emoji reactions (😂 💀 😭) work
- [ ] Roast of the Day shows in feed
- [ ] Search by username/platform works
- [ ] Sort by Trending/Fresh/Brutal works

### Leaderboard & Battles
- [ ] Hall of Fame leaderboard loads
- [ ] Roast Battle voting works with confetti
- [ ] Next Battle matchup generates
- [ ] Battle history shows previous results

### World & Stats
- [ ] World Map leaderboard shows country data
- [ ] Platform filter on world map works
- [ ] Global Stats page loads with charts
- [ ] Hourly activity bar chart renders
- [ ] Platform brutality index shows

### Karma & Gamification
- [ ] Karma badges show next to anonymous IDs
- [ ] KarmaBar shows in profile detail
- [ ] Daily challenges display in sidebar
- [ ] Streak counter shows in navbar
- [ ] Language switcher works (EN/BN/HI)

### Legal Pages
- [ ] Privacy Policy page renders
- [ ] Terms of Service page renders
- [ ] Footer links work

---

## SEO & Marketing

- [ ] Meta title tag correct: "BURNBOARD - Get Roasted by Real Humans"
- [ ] OG title + description + image set
- [ ] Twitter card meta tags present
- [ ] Sitemap generates at `/sitemap.xml`
- [ ] Robots.txt allows crawling
- [ ] JSON-LD structured data renders
- [ ] All SEO chamber pages work (`/roast/linkedin`, `/roast/github`, etc.)

---

## Launch Day

### Product Hunt
- [ ] Product Hunt launch scheduled
- [ ] Product Hunt badge renders on site
- [ ] Gallery images ready (1080x1080 roast cards)
- [ ] Tagline: "No AI. Just Humans Roasting Humans."
- [ ] First comment draft ready

### Social Media
- [ ] 5 launch tweets scheduled
- [ ] Reddit posts ready (r/SideProject, r/webdev, r/indiehackers)
- [ ] Twitter/X thread about building in public
- [ ] LinkedIn post (ironic, for the roast content)

### Community
- [ ] Discord/Slack community invite link ready
- [ ] GitHub repo public with README
- [ ] GitHub FUNDING.yml configured

---

## Post-Launch (First 48 Hours)

- [ ] Monitor Supabase dashboard for data
- [ ] Check Vercel function logs for errors
- [ ] Respond to Product Hunt comments
- [ ] Share first user-submitted roasts on social
- [ ] Post daily roast winner
- [ ] Track analytics (zero-cost localStorage tracking)

---

## Emergency

- [ ] Know how to access admin panel (`/#admin`)
- [ ] Have Supabase dashboard bookmarked
- [ ] Know how to ban IPs from admin
- [ ] Have backup export JSON ready

---

*BURNBOARD v2.0 — From 0 to Global Startup 🚀*
*No AI. Just Humans Roasting Humans.*
