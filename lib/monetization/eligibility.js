/**
 * BURNBOARD Monetization — Creator Eligibility Service (Master Prompt 19)
 *
 * Wraps the get_creator_monetization_status RPC. Returns a high-level status
 * (not_eligible | in_progress | eligible | under_review | restricted |
 * paused) plus human-understandable reason codes. NEVER exposes internal
 * thresholds or fraud/moderation signals — those stay in the database.
 *
 * Status flow:
 *   not_eligible → in_progress → eligible
 *   under_review (manual review pending)
 *   restricted    (moderation/fraud authoritative override)
 *   paused        (creator or platform initiated hold)
 *
 * Every function degrades to a safe "unavailable" result if the migration
 * hasn't been applied or the backend is unreachable — monetization surfaces
 * simply hide.
 */

// High-level statuses a creator can see. 'unknown' is used when the backend
// can't be reached (surfaces hide rather than mislead).
export const ELIGIBILITY_STATUSES = [
  'not_eligible',
  'in_progress',
  'eligible',
  'under_review',
  'restricted',
  'paused',
];

/**
 * Fetch the caller's own monetization eligibility status.
 * Returns { available, status, reasons, note } or a safe degradation.
 */
export async function getCreatorEligibility(client, userId) {
  if (!client || !userId) return { available: false };
  try {
    const { data, error } = await client.rpc('get_creator_monetization_status', {
      p_user: userId,
    });
    if (error || !data?.length) return { available: false };

    const row = data[0];
    return {
      available: true,
      status: row.status || 'not_eligible',
      reasons: row.reasons || [],
      note: row.note || '',
    };
  } catch (err) {
    console.warn('[Monetization] Eligibility check failed:', err?.message || err);
    return { available: false };
  }
}

/**
 * Human-readable summary for a status (used by creator-facing UI).
 */
export function eligibilityLabel(status) {
  switch (status) {
    case 'eligible': return 'Eligible';
    case 'in_progress': return 'Almost there';
    case 'not_eligible': return 'Not eligible yet';
    case 'under_review': return 'Under review';
    case 'restricted': return 'Restricted';
    case 'paused': return 'Paused';
    default: return 'Unavailable';
  }
}

/**
 * Human-readable reason text. Each maps to an actionable, non-sensitive
 * hint — never an internal threshold or score.
 */
export function reasonLabel(reason) {
  switch (reason) {
    case 'more_posts': return 'Create more posts to show your content';
    case 'more_followers': return 'Grow your audience a little more';
    case 'more_engagement': return 'Get more reactions on your posts';
    case 'account_age': return 'Your account is still new — keep posting';
    case 'account_restrictions': return 'Your account is under review';
    default: return '';
  }
}