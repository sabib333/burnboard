'use client';

import { useEffect } from 'react';
import { hasReferralCookie } from '@/lib/growth/referral';

/**
 * ReferralLinkProbe — records REAL referral visits.
 *
 * Mounted once in the root layout. When a visitor arrives with ?ref=CODE
 * (a genuine referral link), it asks the server to record a visit and drops
 * the ref param from the URL (clean, shareable, non-tracker-looking address).
 * A first-party cookie (opaque visit token) is set so a later signup can be
 * attributed. Signed visitors can't be "referral farmed": visits are
 * rate-capped server-side and conversions are idempotent.
 */
export default function ReferralLinkProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasReferralCookie()) return;

    // Ignore internal navigation: only record when the ref actually came from
    // a page load with the param in the URL.
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || '').trim();
    if (!ref || !/^[a-z0-9]{6,12}$/i.test(ref)) return;

    let cancelled = false;
    fetch(`/api/referral/visit?code=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.tracked) return;
        // Clean the URL so analytics/tabs stay tidy; keep history intact.
        params.delete('ref');
        const qs = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return null;
}