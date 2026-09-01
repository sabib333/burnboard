# BURNBOARD — Screenshot Guide for Product Hunt

Take these 5 screenshots after deploying to production. Use browser DevTools to set viewport to 1280x800 for consistent sizing.

---

## Screenshot 1: Feed with Real Roasts + Stories Bar
**Page:** Main feed (`burnboard.app`)
**What to show:**
- Stories bar at top (if populated)
- 2-3 profile cards with real roasts visible
- "Roast of the Day" banner
- For You / Following tabs
- Platform badges (LinkedIn, GitHub, etc.)

**Tips:**
- Make sure there are real roasts showing
- Use dark mode (default)
- Scroll slightly so the feed is centered

---

## Screenshot 2: Battle VS with Real Profiles
**Page:** Battle view (`burnboard.app/#battle`)
**What to show:**
- Two profile cards side by side
- Vote buttons with counts
- VS flame animation in center
- "Battle History" section below

**Tips:**
- Wait for a battle to load with real profiles
- Make sure vote counts are visible

---

## Screenshot 3: Reels Vertical Feed
**Page:** Explore/Reels (`burnboard.app/#explore`)
**What to show:**
- Vertical scrolling feed
- Velocity badges on hot profiles
- Hot / Rising / Fresh / Brutal tabs
- Real profile cards with roast counts

---

## Screenshot 4: Profile with Karma + Followers
**Page:** User profile (`burnboard.app/#u/{username}`)
**What to show:**
- Username and avatar
- Karma level badge (Newbie/Roaster/Brutal/Savage)
- Follower/following counts
- Stats (roasts given, upvotes received)
- Activity feed

**Tips:**
- Use a profile with 10+ roasts for social proof
- Make sure karma badge is visible

---

## Screenshot 5: OG Share Card Example
**Page:** OG Card Modal (click Share → Download Card on any roast)
**What to show:**
- The 1200x630 viral share card
- BURNBOARD branding
- Target username and platform
- Roast text
- Upvote count

**Tips:**
- Use a roast with 5+ upvotes for credibility
- Show the modal with the canvas preview
- This demonstrates the viral sharing feature

---

## Screenshot Specs

- **Format:** PNG
- **Viewport:** 1280x800 (desktop) or 390x844 (mobile for some)
- **Browser:** Chrome with dark theme
- **Extensions:** Disable all for clean screenshots
- **Resolution:** At least 2x for retina displays

---

## Thumbnail (240x240)

- Background: #0a0a0a (BURNBOARD dark)
- Center: 🔥 fire emoji, large (120px)
- Bottom: "BURNBOARD" text, white, bold, 24px
- No other text or elements
- Clean, minimal, recognizable at small sizes

---

## Quick Screenshot Commands

After deploying, open browser and:

1. `Ctrl+Shift+P` → "Capture full size screenshot" for full page
2. Use browser DevTools "Capture screenshot" for viewport
3. For OG card: Right-click the canvas → "Save image as"
