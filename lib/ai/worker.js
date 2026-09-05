/**
 * BURNBOARD AI — Background Worker (Master Prompt 17)
 *
 * Processes ai_jobs in batches: classify_content / embed_content / quality.
 * Runs from the daily cleanup cron (and optionally /api/cron/ai). Everything
 * is idempotent:
 *   - claim_ai_jobs atomically claims a batch (FOR UPDATE SKIP LOCKED)
 *   - a crashed worker's claimed rows are requeued by cleanup_ai_data
 *   - ai_content_metadata upserts on (content_type, content_id)
 *
 * Never blocks publishing: jobs are enqueued fire-and-forget after content
 * creation; results arrive whenever the worker runs.
 */

import { executeTask } from './provider';
import { isAiFeatureEnabled } from './flags';

const VALID_METADATA_TYPES = ['social_post', 'roast', 'comment'];

function normalizeUuid(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return m ? value.toLowerCase() : null;
}

/**
 * Run one job through the provider abstraction.
 * Returns { metadata?, model_version } — metadata is upserted by the caller.
 */
async function runJob(job) {
  const input = job.input || {};
  const text = input.text || '';
  const model_version = input.model_version || null;

  switch (job.job_type) {
    case 'classify_content': {
      const res = await executeTask({ task: 'classify_content', params: { text } });
      if (!res.success) throw new Error(res.error || 'classification failed');
      return {
        model_version: res.source || 'builtin',
        metadata: {
          language: res.language || null,
          topics: res.topics || [],
          quality_score: res.qualityScore ?? null,
          source: res.source || 'builtin',
        },
      };
    }
    case 'embed_content': {
      const res = await executeTask({ task: 'embed_content', params: { text, dim: 64 } });
      if (!res.success) throw new Error(res.error || 'embedding failed');
      return {
        model_version: res.source || 'builtin',
        metadata: {
          embedding: res.embedding || null,
          embedding_dim: Array.isArray(res.embedding) ? res.embedding.length : null,
          source: res.source || 'builtin',
        },
      };
    }
    case 'quality_score': {
      const engagement = Number(input.engagement || 0);
      const res = await executeTask({ task: 'classify_content', params: { text } });
      const score = res.success && res.qualityScore != null ? res.qualityScore : 0.35;
      return {
        model_version: res.source || 'builtin',
        metadata: {
          quality_score: score,
          source: res.source || 'builtin',
          topics: res.topics || [],
          language: res.language || null,
        },
      };
    }
    case 'creator_insight': {
      // Only meaningful with a real provider; builtin returns null and the
      // job finishes as 'skipped' (never fabricates an insight).
      const res = await executeTask({ task: 'creator_insight', params: { prompt: input.prompt || '' } });
      if (!res.success || !res.insight) {
        return { skip: true, model_version: res.source || 'builtin' };
      }
      const raw = String(res.insight).trim();
      if (/insufficient data/i.test(raw)) {
        return { skip: true, model_version: res.source || 'builtin' };
      }
      return {
        model_version: res.source || 'builtin',
        creatorInsight: {
          text: raw,
          confidence: input.earlySignal ? 'early' : 'medium',
        },
      };
    }
    default:
      throw new Error(`Unknown job_type: ${job.job_type}`);
  }
}

/**
 * Process pending AI jobs in batches.
 * @param {object} client Supabase client (service role recommended)
 * @param {object} opts { batchSize }
 * @returns {Promise<{claimed, completed, errors, skipped}>}
 */
export async function processAiJobs(client, { batchSize = 50 } = {}) {
  if (!client) return { claimed: 0, completed: 0, errors: 0, skipped: 0 };

  // Global kill switch: AI work is optional, never urgent.
  if (!isAiFeatureEnabled('ai_content_understanding', null)) {
    return { claimed: 0, completed: 0, errors: 0, skipped: 0, disabled: true };
  }

  const { data: jobs, error } = await client.rpc('claim_ai_jobs', { batch_size: batchSize });
  if (error) {
    console.error('[AI Worker] claim failed:', error.message);
    return { claimed: 0, completed: 0, errors: 0, skipped: 0, claimError: error.message };
  }
  if (!jobs || jobs.length === 0) {
    // Still run retention so stuck claims get requeued.
    await client.rpc('cleanup_ai_data').catch(() => {});
    return { claimed: 0, completed: 0, errors: 0, skipped: 0 };
  }

  let completed = 0;
  let errors = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const { metadata, model_version, creatorInsight, skip } = await runJob(job);

      if (skip) {
        await client.rpc('finish_ai_job', { p_id: job.id, p_status: 'skipped' });
        skipped += 1;
        continue;
      }

      // Persist understanding metadata (only for supported types).
      const contentId = normalizeUuid(job.target_id);
      if (metadata && VALID_METADATA_TYPES.includes(job.target_type) && contentId) {
        const row = {
          content_type: job.target_type,
          content_id: contentId,
          ...metadata,
          model_version: model_version || null,
          updated_at: new Date().toISOString(),
        };
        const { error: upsertErr } = await client
          .from('ai_content_metadata')
          .upsert(row, { onConflict: 'content_type,content_id' });
        if (upsertErr) throw upsertErr;
      }

      // Persist creator insight (owner-readable row).
      if (creatorInsight && job.target_type === 'user') {
        const creatorId = normalizeUuid(job.target_id);
        if (creatorId) {
          const { error: insightErr } = await client.rpc('upsert_creator_insight', {
            p_creator_id: creatorId,
            p_insight: JSON.stringify(creatorInsight),
            p_confidence: creatorInsight.confidence || 'medium',
            p_model_version: model_version || null,
            p_source: model_version || 'builtin',
          });
          if (insightErr) throw insightErr;
        }
      }

      await client.rpc('finish_ai_job', {
        p_id: job.id,
        p_status: 'done',
        p_result: metadata ? JSON.stringify(metadata) : (creatorInsight ? JSON.stringify(creatorInsight) : null),
        p_model_version: model_version || null,
      });
      completed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[AI Worker] job ${job.id} (${job.job_type}) failed:`, err?.message || err);
      await client.rpc('finish_ai_job', {
        p_id: job.id,
        p_status: 'failed',
        p_error: String(err?.message || err).slice(0, 500),
      }).catch(() => {});
    }
  }

  // Retention: prune old logs/jobs, requeue stuck claims, dead-letter
  // exhausted attempts.
  await client.rpc('cleanup_ai_data').catch(() => {});

  return { claimed: jobs.length, completed, errors, skipped };
}