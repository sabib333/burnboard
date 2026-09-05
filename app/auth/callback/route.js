import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeInternalPath } from '@/lib/growth/referral';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeInternalPath(searchParams.get('next')) ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // Real referral attribution: if a first-party referral token cookie is
      // present, claim the conversion for this session user (best-effort,
      // idempotent, self-referral-proof server-side).
      try {
        const cookieHeader = request.headers.get('cookie') || '';
        let token = null;
        for (const part of cookieHeader.split(';')) {
          const eq = part.indexOf('=');
          if (eq === -1) continue;
          const name = part.slice(0, eq).trim();
          if (name !== 'bb_ref') continue;
          const value = part.slice(eq + 1).trim();
          try { token = decodeURIComponent(value); } catch { token = value; }
        }
        if (token && /^[0-9a-f-]{36}$/i.test(token)) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await supabase.rpc('claim_referral_by_token', {
              p_token: token,
              p_user: user.id,
            });
          }
        }
        response.cookies.set('bb_ref', '', { path: '/', maxAge: 0 });
      } catch {
        // Attribution never blocks the post-auth redirect.
      }

      // Coarse locale capture (regional analytics + future locale-aware UX).
      // Accept-Language → en/bn/hi only; never precise location. Fail-soft:
      // if the column doesn't exist yet, nothing breaks.
      try {
        const acceptLang = request.headers.get('accept-language') || '';
        let locale = 'en';
        if (/\bbn\b/i.test(acceptLang)) locale = 'bn';
        else if (/\bhi\b/i.test(acceptLang)) locale = 'hi';
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && locale !== 'en') {
          await supabase.from('user_profiles').update({ locale }).eq('id', user.id);
        }
      } catch {
        // Locale capture is best-effort only.
      }

      // Successfully exchanged code — redirect to the preserved destination.
      return response;
    }
    console.error('[auth/callback] Exchange failed:', error.message);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}