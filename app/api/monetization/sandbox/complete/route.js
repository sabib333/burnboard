import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getMonetizationEnv } from '@/lib/monetization/config';
import { getPaymentProvider, SANDBOX_BASE_URL } from '@/lib/monetization/providers';
import { handleProviderWebhook } from '@/lib/monetization/webhook';

/**
 * POST /api/monetization/sandbox/complete (form)
 *
 * Server-side completion of the TEST checkout. Loads the owner's pending
 * purchase from the database, builds the provider-shaped event from the REAL
 * stored price, signs it with the sandbox secret (never exposed to the
 * client), and pushes it through the same verified webhook pipeline a real
 * provider would use. Then redirects the user to their billing page.
 *
 * Only reachable in dev/test — production refuses the sandbox driver.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      const next = encodeURIComponent(`/checkout/sandbox?${req.url.split('?')[1] || ''}`);
      return NextResponse.redirect(`${SANDBOX_BASE_URL()}/auth?next=${next}`);
    }
    if (getMonetizationEnv() === 'prod') {
      return NextResponse.redirect(`${SANDBOX_BASE_URL()}/settings/billing`);
    }

    const form = await req.formData();
    const ref = String(form.get('ref') || '');

    const { data: purchase } = await client
      .from('monetization_purchases')
      .select('id, amount_minor, currency, provider_id, status')
      .eq('provider_id', ref)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!purchase) {
      return NextResponse.redirect(`${SANDBOX_BASE_URL()}/settings/billing?error=checkout_missing`);
    }

    // Build the provider-shaped event from the REAL stored price/amount.
    const payload = {
      event: 'checkout.completed',
      provider_id: purchase.provider_id,
      session_id: purchase.provider_id,
      amount_minor: purchase.amount_minor,
      currency: purchase.currency,
      user_id: userId,
    };
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', process.env.MONETIZATION_WEBHOOK_SECRET || 'sb_dev_secret_change_me').update(rawBody).digest('base64');
    const signature = `sb_${hmac}`;

    const result = await handleProviderWebhook({
      client,
      provider: getPaymentProvider().key,
      rawBody,
      signature,
    });

    if (result.ok) {
      return NextResponse.redirect(`${SANDBOX_BASE_URL()}/settings/billing?done=1`);
    }
    return NextResponse.redirect(`${SANDBOX_BASE_URL()}/settings/billing?error=${result.reason || 'failed'}`);
  } catch (err) {
    console.error('[Monetization] Sandbox complete error:', err?.message || err);
    return NextResponse.redirect(`${SANDBOX_BASE_URL()}/settings/billing?error=internal`);
  }
}