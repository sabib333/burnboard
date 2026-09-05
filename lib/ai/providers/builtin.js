/**
 * BURNBOARD AI — Builtin Provider
 *
 * Rule-based implementations that need NO external AI. This is the permanent
 * fallback: if a provider is down, unconfigured, or a task is explicitly
 * routed to builtin, users still get useful, safe, deterministic output.
 *
 * Principles:
 *   - Never fabricates: every builtin output is derived from the input or
 *     from static curated rules.
 *   - Safe by construction: outputs pass through the same validation as
 *     external providers.
 *   - Cheap: zero network, zero cost — ideal for the batch tier and for
 *     cold-start fallbacks.
 */

// ── Language detection (heuristic, good enough for routing) ──
// Detect the dominant script of a short text. Returns an ISO 639-1 code or
// 'unknown'. Used by content understanding; never treated as ground truth.
const SCRIPT_PATTERNS = [
  { lang: 'bn', re: /[\u0980-\u09FF]/ },
  { lang: 'hi', re: /[\u0900-\u097F]/ },
  { lang: 'ar', re: /[\u0600-\u06FF]/ },
  { lang: 'zh', re: /[\u4E00-\u9FFF]/ },
  { lang: 'ja', re: /[\u3040-\u30FF]/ },
  { lang: 'ko', re: /[\uAC00-\uD7AF]/ },
  { lang: 'ru', re: /[\u0400-\u04FF]/ },
  { lang: 'es', re: /[áéíóúñ¿¡]/ },
  { lang: 'fr', re: /[àâçéèêëîïôûùœ]/ },
  { lang: 'de', re: /[äöüß]/ },
];

export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  for (const { lang, re } of SCRIPT_PATTERNS) {
    if (re.test(text)) return lang;
  }
  // Default to english for latin-script text (coarse, documented).
  return /[a-zA-Z]/.test(text) ? 'en' : 'unknown';
}

// ── Topic keyword classification ─────────────────────────────
// Deterministic keyword matching for content understanding. This is a
// foundation: when a provider (embeddings + classifier) is configured, the
// same job_type produces richer topics; builtin never blocks publishing.
const TOPIC_KEYWORDS = {
  tech: ['code', 'coding', 'developer', 'startup', 'ai', 'software', 'app', 'bug', 'github', 'tech', 'product', 'saas', 'dev'],
  gaming: ['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'gamer', 'esports', 'fps', 'rpg'],
  music: ['music', 'song', 'album', 'spotify', 'playlist', 'rap', 'hiphop', 'beat', 'band', 'concert'],
  sports: ['sports', 'football', 'soccer', 'cricket', 'basketball', 'nba', 'premier league', 'f1', 'match'],
  fitness: ['gym', 'workout', 'fitness', 'protein', 'lifting', 'cardio', 'yoga', 'running', 'marathon'],
  food: ['food', 'recipe', 'cooking', 'restaurant', 'pizza', 'burger', 'chef', 'eat', 'meal'],
  movies: ['movie', 'film', 'netflix', 'cinema', 'actor', 'director', 'hollywood', 'bollywood', 'series', 'show'],
  business: ['business', 'money', 'finance', 'invest', 'salary', 'job', 'interview', 'career', 'linkedin', 'resume', 'ceo', 'founder', 'marketing'],
  relationship: ['dating', 'relationship', 'crush', 'ex', 'girlfriend', 'boyfriend', 'marriage', 'tinder', 'breakup'],
  meme: ['meme', 'viral', 'trending', 'reddit', 'twitter', 'tiktok', 'instagram', 'influencer', 'followers'],
  life: ['life', 'advice', 'motivation', 'hustle', 'routine', 'productivity', 'sleep', 'morning', 'habits'],
};

export function classifyTopics(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const hits = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const matched = keywords.filter(k => lower.includes(k));
    if (matched.length) hits.push({ topic, confidence: Math.min(0.9, 0.4 + matched.length * 0.1) });
  }
  return hits.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

// ── Quality heuristic ────────────────────────────────────────
// Combined, explainable, non-mysterious quality score in [0, 1]. Built from
// cheap observable signals only; never used to suppress new creators.
export function qualityHeuristic({ textLength = 0, engagement = 0, authorKarma = 0, isFresh = true } = {}) {
  let score = 0.35; // neutral baseline — new creators are NOT penalized
  if (textLength >= 20) score += 0.15;
  if (textLength >= 60) score += 0.1;
  if (engagement > 0) score += Math.min(0.2, Math.log1p(engagement) * 0.05);
  if (isFresh) score += 0.05;
  return Math.max(0, Math.min(1, score));
}

// ── Embedding placeholder ────────────────────────────────────
// No external embedding model → deterministic bag-of-words hashing. This is
// NOT semantically meaningful; it exists so the pipeline, storage, and
// retrieval paths are real and testable before a real model is configured.
// source='builtin' on the metadata row makes this explicit.
export function builtinEmbedding(text, dim = 64) {
  if (!text) return new Array(dim).fill(0);
  const vec = new Array(dim).fill(0);
  const tokens = String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i += 1) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[Math.abs(h) % dim] += 1;
  }
  return vec;
}

// ── Assist rules (moved from lib/aiService.js, behavior unchanged) ──
export function builtinHotSeatPrompt(idea, category) {
  const suggestions = [];
  if (!idea || idea.length < 5) {
    suggestions.push('Try being more specific about what you want roasted.');
    suggestions.push('Example: "Roast my startup pitch that I spent 3 months on"');
  } else if (idea.length > 100) {
    suggestions.push('Consider making your prompt shorter and punchier.');
    suggestions.push('The best Hot Seats have clear, specific prompts.');
  } else {
    const categoryPrompts = {
      photo: [
        'Roast my profile photo — be honest about the vibe',
        'Destroy my selfie game. I need the truth.',
        'Rate my look and roast me accordingly',
      ],
      vibe: [
        'Roast my energy. What vibe am I giving off?',
        'Judge my aura and be brutally honest',
        'What does my vibe say about me? Destroy it.',
      ],
      bio: [
        "Roast my bio. I think it's clever but I need reality.",
        'Destroy my bio text. I spent way too long on it.',
        "Judge my bio and tell me what's wrong with it",
      ],
      idea: [
        'Roast my startup idea. I need honest feedback.',
        'Destroy my project idea. Be brutal but fair.',
        "Judge my concept and tell me why it might fail",
      ],
      dating_profile: [
        'Roast my dating profile. I need to know the truth.',
        "Destroy my dating game. What's wrong with my profile?",
        'Judge my dating profile honestly',
      ],
      music_taste: [
        "Roast my music taste. I know it's controversial.",
        'Judge my playlists and destroy me',
        'What does my music taste say about me? Be honest.',
      ],
      hot_take: [
        "Roast my hot take. I know it's controversial.",
        'Destroy my controversial opinion. Give me reality.',
        "Judge my hot take and tell me why I'm wrong",
      ],
      outfit: [
        'Roast my outfit. I think I look good but I need truth.',
        'Destroy my fashion choices. Be honest.',
        'Judge my fit and roast me accordingly',
      ],
    };
    const prompts = categoryPrompts[category] || categoryPrompts.vibe;
    suggestions.push(...prompts);
  }
  return { success: true, suggestions: suggestions.slice(0, 3), provider: 'builtin' };
}

export function builtinRoastStyle(text, style) {
  if (!text) return { success: false, error: 'Text is required' };
  const variations = [];
  if (style === 'playful') {
    variations.push(text.replace(/!/g, ' 😄'));
    variations.push(`Okay but have you considered: ${text.toLowerCase()}`);
  } else if (style === 'savage') {
    variations.push(text.toUpperCase());
    variations.push(`Let me be real: ${text}`);
  } else if (style === 'clean') {
    variations.push(text);
  }
  return { success: true, variations: variations.slice(0, 3), provider: 'builtin' };
}

/**
 * ── Personal AI (MP22) ───────────────────────────────────────
 * These run deterministically (no external provider needed) so the personal
 * assistant works for every user on every deployment. When an external
 * provider is configured, routes MAY layer it on top — the deterministic
 * answer is always the safety net.
 */

// ── Help corpus (curated, authoritative, in-product) ─────────
// Each entry: keywords → matched when the user's question contains them;
// topic is the source citation; body is the grounded answer. Answers only
// ever describe real product behavior — the assistant never invents
// features or platform facts.
export const GUIDE_CORPUS = [
  {
    topic: 'Posting content',
    keywords: ['post', 'create', 'write', 'publish', 'share'],
    body: 'You can create posts from the composer: opinions, questions, polls, photos, and hot takes. Posts can be public or followers-only, and you can post into a community you have joined or enter eligible challenges directly from the composer.',
  },
  {
    topic: 'Following and feed',
    keywords: ['follow', 'feed', 'following', 'timeline', 'for you', 'foryou'],
    body: 'The Following feed shows posts from people you follow, newest first. The For You feed blends creators you follow with relevant discovery. Follow someone from their profile; unfollow anytime to tune your feed.',
  },
  {
    topic: 'Communities',
    keywords: ['community', 'communities', 'join', 'group'],
    body: 'Communities are topic spaces you can join, post into, and invite people to. Join from the community page, then post into it from the composer. Community rules and moderation still apply inside every community.',
  },
  {
    topic: 'Challenges and battles',
    keywords: ['challenge', 'battle', 'compete', 'contest'],
    body: 'Challenges let you submit an entry that fits the challenge type; battles are head-to-head votes where the community decides. Look for open challenges on the challenges page and battles in Explore.',
  },
  {
    topic: 'Creator tools and analytics',
    keywords: ['creator', 'dashboard', 'analytics', 'milestone', 'revenue'],
    body: 'Your creator dashboard shows real totals: views, reactions, comments, new followers, and milestones. Monetization (tips and creator products) is available to eligible creators and always stays transparent about what is paid versus organic.',
  },
  {
    topic: 'Privacy and blocking',
    keywords: ['private', 'privacy', 'block', 'mute', 'report'],
    body: 'You control your experience: block or mute accounts from their profile, report content that violates policy, and manage privacy settings in Settings. Blocking is enforced everywhere — including in recommendations and search.',
  },
  {
    topic: 'Safety and moderation',
    keywords: ['safety', 'moderat', 'rule', 'policy', 'abuse', 'harass'],
    body: 'BurnBoard applies safety rules to everything you post and keeps moderation state enforced at the data layer. If you see something that violates policy, use Report — and every report is reviewed.',
  },
  {
    topic: 'Notifications',
    keywords: ['notification', 'alert', 'push', 'notify'],
    body: 'Notifications cover reactions, comments, new followers, and community activity. You can tune which notification types you receive (and push) in Settings — preferences are always respected.',
  },
];

/**
 * Deterministic retrieval + answer over the guide corpus.
 * Matches on keyword overlap; never fabricates beyond the corpus. Returns a
 * grounded answer with cited source topics, or an honest "no match" that
 * points the user to Explore.
 */
export function answerFromCorpus(question, corpus = GUIDE_CORPUS) {
  if (!question || !question.trim()) {
    return { success: true, answer: 'Ask me anything about using BurnBoard.', sources: [], source: 'builtin' };
  }
  const q = question.toLowerCase();
  const matches = corpus
    .map(entry => {
      const hits = (entry.keywords || []).filter(kw => q.includes(kw));
      return { entry, hits: hits.length };
    })
    .filter(m => m.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (!matches.length) {
    return {
      success: true,
      answer: "I don't have a specific answer for that yet. Try Explore or Search, or ask me about posting, communities, challenges, or privacy.",
      sources: [],
      source: 'builtin',
    };
  }

  // Merge up to the 2 best-matching topics into one grounded answer.
  const best = matches.slice(0, 2);
  const answer = best.map(m => m.entry.body).join(' ');
  return {
    success: true,
    answer,
    sources: best.map(m => m.entry.topic),
    source: 'builtin',
  };
}

/**
 * Deterministic, conservative draft polish: light clarity + hook checks.
 * Never rewrites meaning. Routes show this as an OPTIONAL suggestion and
 * publishing stays 100% manual.
 */
export function polishDraft(text) {
  if (!text || !text.trim()) return { success: false, error: 'Text is required' };
  const trimmed = text.trim();
  const suggestions = [];

  if (trimmed.length < 10) {
    suggestions.push('Your post is quite short — a little more context helps people engage.');
  }
  if (!/[.!?…]$/.test(trimmed) && trimmed.length > 40) {
    suggestions.push('Consider a clear ending (period, question, or hook) so the post reads as complete.');
  }
  if (trimmed.length > 320) {
    suggestions.push('This is on the longer side — a tighter version usually gets more reactions.');
  }
  const firstWord = trimmed.split(/\s+/)[0] || '';
  if (/^(so|well|um|like|honestly|tbh)$/i.test(firstWord)) {
    suggestions.push('Dropping the filler opener (“' + firstWord + '”) makes the first line punchier.');
  }

  return {
    success: true,
    suggestions: suggestions.length ? suggestions.slice(0, 3) : ['Your draft looks solid — nothing needed. Post it!'],
    source: 'builtin',
  };
}