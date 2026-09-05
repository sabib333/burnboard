/**
 * BURNBOARD — Referral helpers (Master Prompt 14)
 *
 * Privacy-aware referral foundation. The only public identifier is an opaque
 * 8-char code; attribution travels via first-party cookies holding random
 * visit tokens (never emails, never user ids, never cross-site tracking).
 */

const REF_COOKIE = 'bb_ref';

/**
 * The shareable invite link for a referral code.
 */
export function referralInviteUrl(code, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://burnboard.app');
  return `${base}/s/${encodeURIComponent(code || '')}`;
}

export function getReferralCookieName() {
  return REF_COOKIE;
}

export function hasReferralCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${REF_COOKIE}=`));
}

/**
 * Safe internal-only redirect target (no open redirects, no //host smuggling).
 */
export function safeInternalPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (raw.includes('\r') || raw.includes('\n')) return null;
  if (raw.length > 500) return null;
  return raw;
}