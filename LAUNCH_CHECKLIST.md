# BURNBOARD — Launch Checklist

## Pre-Launch (1 Week Before)

### Deploy & Verify
- [ ] Deploy to production (burnboard.app or burnboard.xyz)
- [ ] Test sitemap.xml returns real profiles (curl https://burnboard.app/sitemap.xml)
- [ ] Test /robots.txt exists and is correct
- [ ] Test OG image generation (https://burnboard.app/api/og?username=test&platform=linkedin&count=5)
- [ ] Test all hash routes work: #top, #battle, #explore, #roast/linkedin
- [ ] Test PWA install prompt works on mobile
- [ ] Test Supabase Realtime (open 2 tabs, post a roast, see it appear)
- [ ] Verify RLS policies are active (Supabase dashboard → Authentication → Policies)
- [ ] Verify rate limiting works (spam 6 roasts in 1 min → should 429)
- [ ] Verify XSS blocking (submit `<script>alert(1)</script>` → should be stripped)

### Content Preparation
- [ ] Ensure at least 10+ real profiles exist in the database
- [ ] Ensure at least 50+ real roasts exist (no demo data)
- [ ] Create 5 real screenshots for Product Hunt
- [ ] Create Product Hunt thumbnail (240x240, 🔥 on dark background)
- [ ] Write Product Hunt description (260 chars max)
- [ ] Write first maker comment (see PRODUCTHUNT.md)

### Social Accounts
- [ ] Create Twitter/X account @burnboard
- [ ] Create Product Hunt maker profile
- [ ] Post 3-5 tweets before launch to warm up the account
- [ ] Follow 20-30 relevant people in indie hacker / comedy space

---

## Launch Day (Tuesday 12:01 AM PST)

### 12:01 AM — Go Live
- [ ] Submit to Product Hunt at exactly 12:01 AM PST
- [ ] Verify the PH page is live and correct
- [ ] Tweet the launch thread (7 tweets, see LAUNCH_TWITTER.md)

### 6:00 AM — Social Push
- [ ] Post Reddit threads (see LAUNCH_REDDIT.md):
  - [ ] r/roastme
  - [ ] r/IndieHackers
  - [ ] r/SideProject
  - [ ] r/linkedinlunatics
- [ ] Share in 3-5 relevant Discord communities
- [ ] Share in 2-3 relevant Slack groups

### 8:00 AM — Engagement
- [ ] Reply to EVERY Product Hunt comment (within 1 hour)
- [ ] Reply to every Reddit comment (within 1 hour)
- [ ] Retweet supportive tweets
- [ ] Post a "live update" tweet with current stats

### 12:00 PM — Midday Push
- [ ] Email blast to any waitlist (if exists)
- [ ] LinkedIn post (personal, about building this)
- [ ] Share in Hacker News "Show HN" (if comfortable)

### 4:00 PM — Afternoon Push
- [ ] Share in indie maker communities
- [ ] Reply to new PH comments
- [ ] Post an update tweet with real-time stats

### 8:00 PM — Wind Down
- [ ] Thank supporters publicly
- [ ] Share the best roast of the day
- [ ] Post "Day 1 stats" tweet

---

## Post-Launch (First Week)

### Day 2-3
- [ ] Reply to all remaining comments
- [ ] Share the "best of" roasts on social
- [ ] Reach out to 5 people who engaged for feedback
- [ ] Fix any bugs reported by users

### Day 4-7
- [ ] Post a "Week 1 recap" tweet with real stats
- [ ] Write a blog post about the launch experience
- [ ] Start building the next feature based on feedback
- [ ] Submit to additional directories (BetaList, AlternativeTo, etc.)

---

## Metrics to Track

### Real-Time (Day 1)
- [ ] Product Hunt upvotes
- [ ] Product Hunt comments
- [ ] Twitter impressions on launch thread
- [ ] Reddit post upvotes and comments
- [ ] New profiles created
- [ ] New roasts submitted
- [ ] OG card downloads (shares)

### Week 1
- [ ] Total unique visitors
- [ ] Total profiles created
- [ ] Total roasts submitted
- [ ] Total upvotes
- [ ] PWA installs
- [ ] Email signups (if any)
- [ ] Referral traffic sources

---

## Emergency Contacts

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Product Hunt Support:** support@producthunt.com
- **Twitter:** @burnboard

---

## Post-Mortem Template

After the first week, fill this out:

### What Worked
- [ ] ...

### What Didn't
- [ ] ...

### Key Metrics
- PH Rank: #
- Total visitors: 
- Total roasts: 
- Total profiles: 

### Next Steps
- [ ] ...
