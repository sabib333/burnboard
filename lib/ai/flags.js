/**
 * BURNBOARD AI — Feature Flags (Master Prompt 17)
 *
 * Every AI capability supports staged rollout: disabled → internal → beta →
 * percentage → global, plus emergency disable. Flags are environment-driven
 * (no DB dependency, no deploy needed to flip) and percentage rollout uses a
 * deterministic hash so a given user stays in the same bucket across calls.
 *
 * Flag sources (priority order):
 *   1. AI_EMERGENCY_DISABLE=1  → everything off (global kill switch).
 *   2. AI_FLAG_<NAME>=off/0    → explicit per-flag override.
 *   3. AI_FLAG_<NAME>=on/1     → force on for everyone.
 *   4. AI_FLAG_<NAME>=25       → percentage rollout (0-100).
 *   5. Defaults below.
 */

import { AI_TASKS } from './routing';

const DEFAULTS = {
  // User-initiated assistance (hot seat prompts, roast style). Safe, cheap.
  ai_assist: { enabled: true, rollout: 100 },
  // Vision roast image generation (requires an external provider).
  ai_vision: { enabled: true, rollout: 100 },
  // Async content understanding (language/topics/quality → ai_content_metadata).
  ai_content_understanding: { enabled: true, rollout: 100 },
  // Semantic embedding pipeline (builtin placeholder until a provider is set).
  ai_embeddings: { enabled: true, rollout: 100 },
  // AI-assisted creator insights (augments rule-based insights only when a
  // provider is configured AND enough real data exists).
  ai_creator_insights: { enabled: false, rollout: 0 },
  // Smart notification prioritization (future; keeps user prefs authoritative).
  ai_notification_prioritization: { enabled: false, rollout: 0 },
  // ── Personal AI (MP22) ────────────────────────────────────
  // Grounded product Q&A (personal guide). Deterministic fallback always on.
  ai_personal_guide: { enabled: true, rollout: 100 },
  // Daily personalized digest over the user's own graph. Read-only.
  ai_personal_digest: { enabled: true, rollout: 100 },
  // Optional draft-polish suggestions (never auto-publishes).
  ai_content_polish: { enabled: true, rollout: 100 },
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function envValue(flagName, env = process.env) {
  const key = `AI_FLAG_${flagName.toUpperCase()}`;
  const raw = env[key];
  if (raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return 0;
  if (v === 'on' || v === '1' || v === 'true' || v === 'yes') return 100;
  const n = parseInt(v, 10);
  if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  return 100;
}

/**
 * Is an AI capability enabled for a given subject (user id / anon id)?
 * @param {string} flagName one of the DEFAULTS keys
 * @param {string|null} subjectId stable id for percentage rollout buckets
 * @param {object} env process.env override (testing)
 */
export function isAiFeatureEnabled(flagName, subjectId = null, env = process.env) {
  if (env.AI_EMERGENCY_DISABLE === '1' || env.AI_EMERGENCY_DISABLE === 'true') return false;

  const def = DEFAULTS[flagName];
  if (!def) return false;

  const rollout = envValue(flagName, env) ?? def.rollout;
  if (rollout <= 0) return false;
  if (rollout >= 100) return def.enabled;

  if (!subjectId) return false;
  const bucket = hashString(`${flagName}:${subjectId}`) % 100;
  return bucket < rollout && def.enabled;
}

/**
 * All AI flags in one snapshot (for /api/metrics, admin, debugging).
 */
export function getAiFlagSnapshot(env = process.env) {
  const out = {};
  for (const name of Object.keys(DEFAULTS)) {
    out[name] = {
      enabled: isAiFeatureEnabled(name, null, env),
      rollout: envValue(name, env) ?? DEFAULTS[name].rollout,
      emergencyDisabled: env.AI_EMERGENCY_DISABLE === '1' || env.AI_EMERGENCY_DISABLE === 'true',
    };
  }
  return out;
}

/** Is a task's provider chain available at all (has at least builtin)? */
export function isTaskAvailable(taskName) {
  return Boolean(AI_TASKS[taskName]);
}