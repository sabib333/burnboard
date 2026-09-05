# BurnBoard Localization & Internationalization

## 1. Current state

- **`lib/lang.js`** — lightweight i18n with **en / bn / hi** and English as
  the automatic fallback for missing keys. User-facing strings go through
  `t('key')`; user-generated content is never translated by the platform.
- **Language selection** — persisted in localStorage (`burnboard_lang`);
  `navigator.language` drives the initial choice.
- **Bangla/Hindi product depth** — Hot Seat, roast, categories, challenges,
  battles, notifications, safety language and onboarding are translated.

## 2. Locale architecture (added in MP18)

- **`user_profiles.locale`** — coarse, server-side, signup-time locale
  (en/bn/hi from `Accept-Language` at the auth callback; fail-soft). Used for
  **regional analytics** (growth dashboard) and as the seed for future
  server-side locale-aware UX. Never precise location; never updated
  continuously.
- The product separates LANGUAGE / LOCALE / REGION / COUNTRY conceptually:
  `locale` is the coarse language bucket today; region/country layers are a
  future addition only when regional content delivery justifies them.

## 3. i18n foundation rules

- Translation keys, pluralization (`notif_unread`/`notif_unread_plural`),
  and language fallback exist. Dates/numbers currently use JS defaults —
  locale-aware formatting is a follow-up when a market needs it.
- Text expansion: Bengali/Hindi strings are longer than English; layouts must
  tolerate it (already handled in the main flows).
- RTL: not required yet (no RTL languages in the supported set); any future
  RTL market requires layout review.
- **Never embed user-facing strings in logic** — everything routes through
  `lib/lang.js` keys.

## 4. Multilingual onboarding & local discovery

- Onboarding should offer language selection and localized interests; local
  creators and Communities surface through the recommendation system's
  community/topic affinity.
- **Balance global vs local vs personal interest in the feed** — relevance
  (the existing ranking), never turning every user's feed into only-local
  content.

## 5. Regional trends

Trending is global today (`/api/trending`, cached). The regional trend layer
is a documented next step: trend buckets by language/region built on
`ai_content_metadata.language` (MP17) with the same safety filtering and
anti-spam protection as global trending. **Trends must have a clear data
basis — never manipulated.**

## 6. Localization quality

- Translation is cultural, not literal — especially for roast humor and
  safety language. Safety/reporting strings require quality review per
  language before a market launch (see MARKET_EXPANSION.md §10).
- Track quality differences across languages (machine understanding is not
  equally accurate everywhere — see AI docs) before relying on translated
  AI/classification output in a market.