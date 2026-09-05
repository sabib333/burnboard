/**
 * BURN BOARD — AI Assistance Service
 *
 * Provider-abstracted AI assistance for product features.
 * All AI features are OPTIONAL and USER-INITIATED.
 *
 * This service is the product-facing façade: rate limiting, input validation
 * and graceful failure live here; provider routing, fallback, safety output
 * validation, metrics and cost tracking live in lib/ai/provider.js
 * (Master Prompt 17 — AI Provider Abstraction). No provider-specific API
 * calls exist in this file.
 *
 * Privacy:
 * - Minimal data sent to AI
 * - No user profiling
 * - No historical content sent
 * - Only current request context
 */

import { executeTask } from '@/lib/ai/provider';
import { isProfane } from '@/lib/filter';

// ── Provider Configuration ───────────────────────────────────
const AI_CONFIG = {
  // Rate limits (per user per hour)
  maxRequestsPerHour: 10,
  // Input limits
  maxInputLength: 500,
  // Output limits
  maxOutputLength: 1000,
};

// ── Rate Limiting ────────────────────────────────────────────
const requestCounts = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  let requests = requestCounts.get(userId) || [];
  requests = requests.filter(t => t > hourAgo);

  if (requests.length >= AI_CONFIG.maxRequestsPerHour) {
    return false;
  }

  requests.push(now);
  requestCounts.set(userId, requests);
  return true;
}

// ── Safety Checks ────────────────────────────────────────────

/**
 * Validate input for safety before sending to AI.
 */
function validateInput(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Input is required' };
  }

  if (text.length > AI_CONFIG.maxInputLength) {
    return { valid: false, error: `Input too long (max ${AI_CONFIG.maxInputLength} characters)` };
  }

  // Check for prohibited content
  const profanityCheck = isProfane(text);
  if (profanityCheck.profane) {
    return { valid: false, error: 'Input contains prohibited content' };
  }

  return { valid: true };
}

// ── Provider State (legacy API, kept for compatibility) ──────
// The active provider is now resolved per-task by lib/ai/routing.js. These
// accessors preserve the old public API without changing behavior.
let legacyProviderName = 'builtin';

export function setProvider(provider) {
  if (provider && typeof provider.generateHotSeatPrompt === 'function') {
    legacyProviderName = provider.name || 'custom';
  }
}

export function getProviderName() {
  return legacyProviderName;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate Hot Seat prompt suggestions.
 * User-initiated, optional, non-blocking.
 */
export async function generateHotSeatPrompt(idea, category, userId = 'anonymous') {
  // Rate limit check
  if (!checkRateLimit(userId)) {
    return {
      success: false,
      error: 'Rate limit exceeded. Try again later.',
      provider: getProviderName(),
    };
  }

  // Input validation
  const inputCheck = validateInput(idea);
  if (!inputCheck.valid) {
    return {
      success: false,
      error: inputCheck.error,
      provider: getProviderName(),
    };
  }

  try {
    const result = await executeTask({
      task: 'hot_seat_prompt_assist',
      params: { idea, category },
      subjectId: userId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'AI assistance unavailable. You can still create your Hot Seat manually.',
        provider: result.provider || getProviderName(),
      };
    }

    return {
      success: true,
      suggestions: result.suggestions,
      provider: result.provider,
    };
  } catch (err) {
    console.warn('[AI Service] Hot seat prompt generation failed:', err.message);
    return {
      success: false,
      error: 'AI assistance unavailable. You can still create your Hot Seat manually.',
      provider: getProviderName(),
    };
  }
}

/**
 * Generate roast style variations.
 * User-initiated, optional, non-blocking.
 */
export async function generateRoastStyle(text, style, userId = 'anonymous') {
  // Rate limit check
  if (!checkRateLimit(userId)) {
    return {
      success: false,
      error: 'Rate limit exceeded. Try again later.',
      provider: getProviderName(),
    };
  }

  // Input validation
  const inputCheck = validateInput(text);
  if (!inputCheck.valid) {
    return {
      success: false,
      error: inputCheck.error,
      provider: getProviderName(),
    };
  }

  try {
    const result = await executeTask({
      task: 'roast_style_assist',
      params: { text, style },
      subjectId: userId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'AI assistance unavailable. You can still write your roast manually.',
        provider: result.provider || getProviderName(),
      };
    }

    return {
      success: true,
      variations: result.variations,
      provider: result.provider,
    };
  } catch (err) {
    console.warn('[AI Service] Roast style generation failed:', err.message);
    return {
      success: false,
      error: 'AI assistance unavailable. You can still write your roast manually.',
      provider: getProviderName(),
    };
  }
}

/**
 * Check if AI assistance is available.
 */
export function isAIAvailable() {
  return true; // builtin fallback always exists
}

/**
 * Get AI service stats (for observability).
 */
export function getAIStats() {
  return {
    provider: getProviderName(),
    rateLimits: {
      maxPerHour: AI_CONFIG.maxRequestsPerHour,
    },
  };
}