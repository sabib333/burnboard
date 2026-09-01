# BURNBOARD — Master Launch Kit

Everything you need to launch BURNBOARD to #1 on Product Hunt and reach 1M users.

---

## 📋 Quick Links

| Resource | File | Status |
|----------|------|--------|
| Product Hunt Launch | `PRODUCTHUNT.md` | ✅ Ready |
| Twitter Thread | `LAUNCH_TWITTER.md` | ✅ Ready |
| Reddit Posts | `LAUNCH_REDDIT.md` | ✅ Ready |
| Launch Checklist | `LAUNCH_CHECKLIST.md` | ✅ Ready |
| Screenshot Guide | `SCREENSHOTS.md` | ✅ Ready |
| SEO Engine | `src/lib/seo.ts` | ✅ Built |
| Share Component | `src/components/ShareRoast.tsx` | ✅ Built |
| OG Card Generator | `src/components/OgCardModal.tsx` | ✅ Built |
| Premium Badge | `src/components/PremiumBadge.tsx` | ✅ Built |
| Sitemap | `public/sitemap.xml` | ✅ Updated |
| Robots | `public/robots.txt` | ✅ Exists |
| PH Thumbnail | `public/producthunt/thumbnail.svg` | ✅ Created |

---

## 🚀 Launch Sequence (Copy-Paste)

### 1 Week Before
1. Deploy to production
2. Take 5 screenshots (see `SCREENSHOTS.md`)
3. Create PH account, schedule launch for Tuesday 12:01 AM PST
4. Warm up Twitter account with 3-5 tweets
5. Prepare 20 hunter comments

### Launch Day
1. **12:01 AM** — Submit to Product Hunt
2. **6:00 AM** — Post Twitter thread (7 tweets from `LAUNCH_TWITTER.md`)
3. **8:00 AM** — Post Reddit threads (4 subreddits from `LAUNCH_REDDIT.md`)
4. **10:00 AM** — LinkedIn post
5. **12:00 PM** — Email blast + Hacker News
6. **2:00 PM** — Reply to every PH comment
7. **4:00 PM** — Share in communities
8. **8:00 PM** — Thank supporters + share stats

### Post-Launch
1. Reply to all remaining comments
2. Share "best of" roasts on social
3. Fix bugs reported by users
4. Submit to BetaList, AlternativeTo, etc.

---

## 📊 Metrics to Track

### Day 1
- Product Hunt rank and upvotes
- Twitter thread impressions
- Reddit post engagement
- New profiles created
- New roasts submitted

### Week 1
- Total unique visitors
- Total roasts
- PWA installs
- OG card downloads (shares)
- Referral sources

---

## 🎯 SEO Strategy

### Static Pages (in sitemap.xml)
- `/` — Homepage (priority 1.0)
- `/top` — Leaderboard (priority 0.9)
- `/battle` — Battles (priority 0.9)
- `/explore` — Discovery (priority 0.85)
- `/#roast/linkedin` — LinkedIn roasts (priority 0.9)
- `/#roast/github` — GitHub roasts (priority 0.9)
- `/#roast/twitter` — Twitter roasts (priority 0.9)
- `/#roast/instagram` — Instagram roasts (priority 0.85)
- `/#roast/tiktok` — TikTok roasts (priority 0.8)
- `/#roast/reddit` — Reddit roasts (priority 0.8)

### Dynamic Pages (generated per profile)
- `/#post/{profileId}` — Individual profile pages
- `/#u/{username}` — User profile pages

### Structured Data
- WebSite schema (in index.html)
- Organization schema (in index.html)
- Person schema (generated per profile)
- CollectionPage schema (generated per platform)

### OG Images
- Default: `/og-image.png` (1200x630)
- Per profile: `/api/og?username={name}&platform={platform}&count={count}`

---

## 🔗 Share URLs

### Twitter
```
https://twitter.com/intent/tweet?text={encoded_text}&url={encoded_url}
```

### LinkedIn
```
https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}
```

### Reddit
```
https://reddit.com/submit?url={encoded_url}&title={encoded_title}
```

### Copy Link
```
https://burnboard.app/#post/{profileId}
```

---

## 📱 PWA Install

BURNBOARD is installable as a Progressive Web App:
- Android: Chrome → "Add to Home Screen"
- iOS: Safari → "Add to Home Screen"
- Desktop: Chrome → "Install BURNBOARD"

---

## 🛡️ Security Checklist

- [ ] Supabase RLS active on all tables
- [ ] XSS protection (HTML stripping)
- [ ] Rate limiting (5 roasts/10 min)
- [ ] Honeypot anti-bot
- [ ] CSP headers in index.html
- [ ] Admin password changed from default

---

## 💰 Monetization Ready

- **PRO Tier ($5/mo):** Custom cards, no watermark, priority feed
- **Waitlist:** `PremiumBadge.tsx` collects emails
- **Sponsored Slots:** `AdSlot.tsx` component ready
- **Affiliate:** Can add platform referral links

---

## 📈 Growth Levers

1. **Viral Share Cards** — Every roast can be shared as a 1200x630 image
2. **SEO Chambers** — Platform-specific pages rank for "linkedin roast", "github roast"
3. **Gamification** — Karma, levels, streaks keep users coming back
4. **Anonymous** — Zero barrier to participate
5. **Real-time** — Supabase Realtime makes the feed feel alive
6. **PWA** — Installable, push notifications, offline support

---

*Built with 🔥 by BURNBOARD. No AI. Just humans.*
