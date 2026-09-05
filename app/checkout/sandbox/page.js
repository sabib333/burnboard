import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/monetization/config';
import { getActiveProvider } from '@/lib/monetization/providers';
import { getMonetizationEnv } from '@/lib/monetization/config';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * /checkout/sandbox — BurnBoard Test Checkout (dev/test only)
 *
 * A hosted checkout page that simulates a card processor WITHOUT touching
 * real money. It is only ever reachable when MONETIZATION_ENV !== 'production'
 * (the provider driver refuses to run in production). The "payment" is
 * completed server-side via the signed webhook pipeline — the same code path
 * a real provider would use — so the observable flow is provider-shaped.
 */
export default async function SandboxCheckoutPage({ searchParams }) {
  const ref = searchParams?.ref || '';
  const provider = getActiveProvider();

  if (getMonetizationEnv() === 'prod' || provider !== 'cc_sandbox' || !ref) {
    redirect('/settings/billing');
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/checkout/sandbox?ref=${ref}`)}`);

  // Owner-scoped pending purchase (RLS) — show the REAL stored price, never
  // values the client supplied.
  const { data: purchase } = await supabase
    .from('monetization_purchases')
    .select('id, amount_minor, currency, product_id, provider_id, status')
    .eq('provider_id', ref)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!purchase) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans flex items-center justify-center">
        <div className="w-full max-w-md bg-[#111] border border-[#222] rounded-2xl p-8 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <h1 className="text-lg font-black uppercase tracking-wider">Checkout not found</h1>
          <p className="text-xs text-zinc-500">This checkout link is invalid, already completed, or belongs to another account.</p>
          <Link href="/settings/billing" className="inline-block text-xs font-mono font-bold text-[#ff4d00] hover:text-white">
            Back to billing
          </Link>
        </div>
      </main>
    );
  }

  const { data: product } = await supabase
    .from('monetization_products')
    .select('name, description')
    .eq('id', purchase.product_id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-md mx-auto space-y-5 py-8">
        <div className="text-center space-y-2">
          <p className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider border border-amber-400/30 bg-amber-400/10 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
            ⚠️ TEST MODE
          </p>
          <h1 className="text-xl font-black uppercase tracking-wider">Secure checkout</h1>
          <p className="text-[11px] text-zinc-500 font-mono">
            This is a sandbox — no real payment is processed. It exercises the exact webhook pipeline a live provider would use.
          </p>
        </div>

        {/* Order summary from REAL stored data */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">{product?.name || 'BurnBoard product'}</p>
            <p className="text-sm font-black text-[#ff4d00]">{formatMoney(purchase.amount_minor, purchase.currency)}</p>
          </div>
          {product?.description && (
            <p className="text-[11px] text-zinc-500 leading-relaxed">{product.description}</p>
          )}
          <p className="text-[10px] font-mono text-zinc-600 pt-2 border-t border-[#1a1a1a]">
            Billing: one-time · No automatic renewals · Cancel anytime
          </p>
        </div>

        {/* Test card form */}
        <form action="/api/monetization/sandbox/complete" method="POST" className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4">
          <input type="hidden" name="ref" value={ref} />
          <div className="space-y-2">
            <label htmlFor="card" className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Card number</label>
            <input
              id="card"
              name="card"
              defaultValue="4242 4242 4242 4242"
              readOnly
              className="w-full px-3 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-sm text-zinc-300 font-mono outline-none focus:border-[#ff4d00]/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="exp" className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Expiry</label>
              <input id="exp" name="exp" defaultValue="12 / 34" readOnly className="w-full px-3 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-sm text-zinc-300 font-mono outline-none" />
            </div>
            <div className="space-y-2">
              <label htmlFor="cvc" className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">CVC</label>
              <input id="cvc" name="cvc" defaultValue="123" readOnly className="w-full px-3 py-2.5 rounded-xl bg-[#0e0e0e] border border-[#2a2a2a] text-sm text-zinc-300 font-mono outline-none" />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black text-sm transition-all shadow-[0_0_20px_rgba(255,77,0,0.3)]"
          >
            Pay {formatMoney(purchase.amount_minor, purchase.currency)} (test)
          </button>
          <p className="text-[10px] text-zinc-600 text-center font-mono">
            🔒 Test data only. No card details are stored or transmitted anywhere.
          </p>
        </form>

        <Link href="/settings/billing" className="block text-center text-[11px] font-mono text-zinc-500 hover:text-[#ff4d00]">
          ← Cancel
        </Link>
      </div>
    </main>
  );
}