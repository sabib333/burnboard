# BURNBOARD Brand Guidelines

## Logo

### Primary Logo
The primary logo consists of the 🔥 fire emoji followed by the word "BURNBOARD" in bold uppercase.

```
🔥 BURNBOARD
```

### Logo Usage Rules
- Always use the fire emoji (🔥) before the brand name
- Never stretch, distort, or rotate the logo
- Maintain minimum clear space of 16px around the logo
- On dark backgrounds, use the white/orange variant

## Colors

### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Background Dark | `#0a0a0a` | Primary background, body |
| Surface Dark | `#111` | Cards, panels |
| Surface Mid | `#1a1a1a` | Hover states, secondary surfaces |
| Burn Orange | `#ff4d00` | Primary accent, CTAs, fire effects |
| Burn Orange Hover | `#ff6622` | Button hover states |

### Secondary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Amber | `#f59e0b` | Daily winner, streaks, hot seat |
| Text Primary | `#f0f0f0` | Main body text |
| Text Secondary | `#a1a1aa` (zinc-400) | Descriptions, meta |
| Text Muted | `#71717a` (zinc-500) | Timestamps, labels |
| Border | `#262626` (zinc-800) | Card borders, dividers |
| Success | `#10b981` (emerald-500) | Online indicators |
| Danger | `#ef4444` (red-500) | Reports, warnings |

### Platform Brand Colors
| Platform | Color | Hex |
|----------|-------|-----|
| LinkedIn | Blue | `#0077b5` |
| GitHub | Dark | `#1f2328` |
| X (Twitter) | Black | `#000000` |
| Instagram | Gradient | `#dc2743` → `#bc1888` |

## Typography

### Font Stack
```css
font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
```

### Monospace Font
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

### Type Scale
| Element | Size | Weight | Style |
|---------|------|--------|-------|
| H1 Hero | 2xl-3xl (1.5rem-1.875rem) | 900 (Black) | Uppercase, Tight tracking |
| H2 Section | sm-base (0.875rem-1rem) | 700 (Bold) | Uppercase, Wider tracking |
| Body | xs-sm (0.75rem-0.875rem) | 400 (Normal) | Sentence case |
| Meta/Labels | 10px-11px | 600 (SemiBold) | Monospace, Uppercase |
| Tags/Badges | 10px-11px | 700 (Bold) | Monospace |

## Spacing & Layout
- **Border Radius:** Cards: `rounded-2xl` (16px), Buttons: `rounded-xl` (12px), Tags: `rounded-lg` (8px)
- **Card Padding:** `p-4 sm:p-5` (16px-20px)
- **Section Gap:** `space-y-4` to `space-y-6` (16px-24px)
- **Max Content Width:** `max-w-7xl` (1280px)

## Brand Voice & Tone

### Voice
- **Brutal but fun** — We roast, but we're not mean-spirited
- **Sharp & witty** — Intelligence over vulgarity
- **Anonymous & equal** — Everyone gets roasted, no one is safe
- **100% human** — No AI-generated content, ever

### Tone Examples
✅ "Your LinkedIn bio has more buzzwords than actual production commits."
✅ "Cybertruck looks like a low-poly PS1 model."
❌ Generic insults, hate speech, or personal attacks

### Taglines
- "No AI. Just Humans Roasting Humans."
- "Get Roasted by Real Humans."
- "The Anonymous Social Roast Platform."

## Shadows & Effects
- **Card Shadow:** `shadow-md` to `shadow-xl`
- **CTA Glow:** `shadow-[0_0_15px_rgba(255,77,0,0.5)]`
- **Fire Pulse:** `animate-pulse` on fire icons
- **Gradient Card Headers:** `bg-gradient-to-r from-[#1c1200] via-[#111] to-[#0a0a0a]`

## Icons
- **Primary:** Lucide React (Flame, Swords, Trophy, Shield, etc.)
- **Fire Icon:** Always `fill-[#ff4d00]` with `text-black` for emphasis
- **Platform Icons:** Custom SVG components (see `src/components/PlatformIcon.tsx`)

## Animation Guidelines
- **Hover Transitions:** `transition-all duration-200`
- **Active/Click:** `active:scale-95` for press feedback
- **Pulse:** Fire icons and live indicators: `animate-pulse`
- **Bounce:** Battle swords: `animate-bounce`
- **Spin:** Loading: `animate-spin`

---

*BURNBOARD © 2025 — Built with hate ❤️*
