/**
 * BURNBOARD AI — Provider Abstraction (Master Prompt 17)
 *
 * The single door through which ALL AI runs. Product code calls
 * `executeTask`; it handles:
 *   - task → provider routing (lib/ai/routing.js)
 *   - provider implementations (gemini, builtin) with fallback chain
 *   - timeouts per tier
 *   - output safety validation (never return unvetted AI text)
 *   - observability + estimated cost (lib/ai/observability.js)
 *
 * Rules:
 *   - No route/component ever calls a provider API directly.
 *   - User-generated text is always treated as untrusted input.
 *   - A provider outage degrades to the builtin fallback (or a clean
 *     "not configured" error) — core product never depends on one API.
 *   - No prompts or private data are logged.
 */

import { isProfane } from '@/lib/filter';
import { AI_TASKS, providerForTask, estimateCostUsd, estimateTokens } from './routing';
import { withAiObservability } from './observability';
import * as builtin from './providers/builtin';

const GEMINI_MODEL = 'gemini-2.0-flash';

// ── Provider implementations ─────────────────────────────────
const PROVIDERS = {
  gemini: {
    name: 'gemini',
    /**
     * Generate content via the Gemini API (text and/or inline image).
     * Returns { success, text? } or throws on network/API failure.
     */
    async generateContent({ prompt, imageBase64, mimeType, generationConfig = {}, safetySettings = [] }) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

      const parts = [{ text: prompt }];
      if (imageBase64 && mimeType) {
        parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TASKS.vision.tier.timeoutMs);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                temperature: generationConfig.temperature ?? 0.9,
                topP: generationConfig.topP ?? 0.95,
                topK: generationConfig.topK ?? 40,
                maxOutputTokens: generationConfig.maxOutputTokens ?? 300,
              },
              safetySettings: safetySettings.length ? safetySettings : undefined,
            }),
          }
        );

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`Gemini API error (${res.status}): ${detail.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        return { success: Boolean(text), text };
      } finally {
        clearTimeout(timer);
      }
    },
  },
};

// ── Builtin handlers per task ────────────────────────────────
const BUILTIN_HANDLERS = {
  hot_seat_prompt_assist: ({ idea, category }) => builtin.builtinHotSeatPrompt(idea, category),
  roast_style_assist: ({ text, style }) => builtin.builtinRoastStyle(text, style),
  classify_content: ({ text }) => ({
    success: true,
    language: builtin.detectLanguage(text),
    topics: builtin.classifyTopics(text),
    qualityScore: builtin.qualityHeuristic({ textLength: (text || '').length }),
    source: 'builtin',
  }),
  embed_content: ({ text, dim }) => ({
    success: true,
    embedding: builtin.builtinEmbedding(text, dim || 64),
    source: 'builtin',
  }),
  creator_insight: ({ text }) => ({
    success: true,
    insight: null, // builtin never fabricates insights — caller decides
    source: 'builtin',
  }),
  // ── Personal AI (MP22) — deterministic, provider-independent ──
  personal_ai_guide: ({ text, corpus }) => builtin.answerFromCorpus(text, corpus),
  personal_ai_digest: ({ digest }) => ({
    success: true,
    digest: digest || null,
    source: 'builtin',
  }),
  content_polish_assist: ({ text }) => builtin.polishDraft(text),
};

function safeText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  const profanity = isProfane(s);
  return profanity.profane ? null : s;
}

/**
 * Execute an AI task with routing, fallback, safety and observability.
 *
 * @param {object} opts
 *   task          task name (AI_TASKS key)
 *   params        task-specific params
 *   subjectId     stable id for flag rollout (optional)
 *   requireProvider  when true and only the builtin provider can serve this
 *                    task, return { success:false, code:'not_configured' }
 *                    instead of silently using builtin (e.g. vision).
 *   env           env override (testing)
 */
export async function executeTask({ task, params = {}, subjectId = null, requireProvider = false, env = process.env }) {
  const taskConfig = AI_TASKS[task];
  if (!taskConfig) {
    return { success: false, error: `Unknown AI task: ${task}` };
  }

  const providerName = providerForTask(task, env);
  const start = Date.now();

  let providerError = null;

  const attempt = async () => {
    // 1. Preferred provider — only when it can actually serve this task
    // (avoids a doomed network call for tasks it has no handler for).
    if (providerName !== 'builtin' && canServe(providerName, task)) {
      const impl = PROVIDERS[providerName];
      if (impl) {
        try {
          const result = await withTimeout(
            taskConfig,
            runProviderTask(providerName, impl, task, params)
          );
          if (result && result.success) return { ...result, provider: providerName, fallbackUsed: false };
        } catch (err) {
          providerError = err;
          console.warn(`[AI] ${providerName} failed for ${task}:`, err?.message || err);
        }
      }
    }

    // 2. Builtin fallback (permanent safety net).
    const builtinHandler = BUILTIN_HANDLERS[task];
    if (builtinHandler) {
      const result = await builtinHandler(params);
      return { ...result, provider: 'builtin', fallbackUsed: providerName !== 'builtin' };
    }

    // 3. No implementation at all. Distinguish "never configured" (503)
    // from "configured but failed" (502) for the calling route.
    if (requireProvider) {
      const configured = providerName !== 'builtin';
      return {
        success: false,
        code: configured ? 'provider_error' : 'not_configured',
        error: configured
          ? (providerError?.message || 'AI service temporarily unavailable. Please try again.')
          : `${taskConfig.fallback === 'builtin' ? 'AI service' : 'AI'} not configured.`,
        provider: providerName,
      };
    }
    return { success: false, error: `No provider available for ${task}`, provider: providerName };
  };

  const result = await withAiObservability(
    { task, provider: providerName, model: GEMINI_MODEL },
    attempt
  );

  // Safety validation on any returned text (never surface unvetted AI text).
  if (result?.success) {
    if (Array.isArray(result.suggestions)) {
      result.suggestions = result.suggestions.map(safeText).filter(Boolean);
      if (result.suggestions.length === 0) {
        result.success = false;
        result.error = 'AI output failed safety check';
      }
    }
    if (Array.isArray(result.variations)) {
      result.variations = result.variations.map(safeText).filter(Boolean);
      if (result.variations.length === 0) {
        result.success = false;
        result.error = 'AI output failed safety check';
      }
    }
    if (result.text !== undefined) {
      result.text = safeText(result.text);
      if (!result.text) {
        result.success = false;
        result.error = 'AI output failed safety check';
      }
    }
  }

  // Cost estimate (approximate, for monitoring only).
  const inputText = params?.text || params?.idea || params?.prompt || '';
  result.costUsd = estimateCostUsd(
    task,
    estimateTokens(inputText),
    estimateTokens(result?.text || result?.suggestions?.join(' ') || result?.variations?.join(' ') || '')
  );
  result.latencyMs = Date.now() - start;

  return result;
}

/** Which external providers can serve which tasks. */
function canServe(providerName, task) {
  if (providerName === 'gemini') {
    return task === 'vision_roast_image' || task === 'creator_insight'
      || task === 'personal_ai_guide' || task === 'content_polish_assist';
  }
  return false;
}

function runProviderTask(providerName, impl, task, params) {
  switch (task) {
    case 'vision_roast_image': {
      return impl.generateContent({
        prompt: params.prompt,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 150,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }).then(res => ({ ...res, roast: res.text }));
    }
    case 'creator_insight': {
      // Conservative text generation from aggregate numbers only. The
      // prompt is built by the caller (lib/creator/insights.js) from real
      // totals — the model never sees private content or viewer identities.
      return impl.generateContent({
        prompt: params.prompt,
        generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 200 },
      }).then(res => ({ ...res, insight: res.text }));
    }
    case 'hot_seat_prompt_assist':
    case 'roast_style_assist':
    case 'classify_content':
    case 'embed_content':
    case 'personal_ai_guide':
    case 'content_polish_assist': {
      // External provider for these tasks is future work; fall through to
      // builtin unless a handler exists on the provider impl.
      if (typeof impl[task] === 'function') return impl[task](params);
      throw new Error(`provider ${providerName} has no handler for ${task}`);
    }
    default:
      throw new Error(`No handler for ${task}`);
  }
}

function withTimeout(taskConfig, promise) {
  const timeoutMs = taskConfig.tier.timeoutMs;
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), timeoutMs)),
  ]);
}

// ── Convenience exports used by routes/workers ───────────────
export { detectLanguage, classifyTopics, qualityHeuristic, builtinEmbedding } from './providers/builtin';

/**
 * Vision roast generation for /api/roast-image (centralized Gemini call).
 * Returns the same shape the route previously built by hand.
 */
export async function generateVisionRoast({ imageBase64, mimeType, savageLevel = 'savage' }) {
  const prompts = {
    mild: `You are a witty comedian. Look at this image and roast this person in a mild, playful way. Mix Bangla and English naturally. Keep it to 1 fun line. Be creative and Gen Z style. Example style: "বাহhh ভাই, this fit is giving main character energy 💀"`,
    savage: `You are a savage roaster. Look at this image and roast this person BRUTALLY in a mix of Bangla and English (Banglish). Keep it to exactly 1 savage, funny, Gen Z style line. Be creative, sharp, and hilarious. The roast should make people laugh. Example style: "ভাই এই মুখ দিয়ে filter লাগাও নাকি roast করো? 💀🔥"`,
    toxic: `You are an absolutely toxic roaster. Look at this image and deliver the most devastating, savage roast possible in Bangla + English mix. Keep it to 1 line. Gen Z style. Hold nothing back. Be hilarious but don't cross into hate speech. Example style: "bro thinks he's the main character but he's literally the NPC 💀☠️ ভাই tu fridge mein reh"`,
    bangla: `তুমি একজন বাংলা রোস্টার। এই ছবি দেখে এই ব্যক্তিকে বাংলা ভাষায় (ইংরেজি মিক্স করে) roast করো। ১ লাইনে বলো। Gen Z style এ বলো, খুব funny ও savage হতে হবে। Example: "ভাই তুমি তো casually cringe 💀 এতক্ষণ চুপ থাকো বাংলা বলো না 🇧🇩"`,
  };

  const result = await executeTask({
    task: 'vision_roast_image',
    params: {
      prompt: prompts[savageLevel] || prompts.savage,
      imageBase64,
      mimeType,
    },
    requireProvider: true,
  });

  return result;
}