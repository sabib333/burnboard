import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Request ID for end-to-end log correlation (observability).
  // Surfaced as the `x-request-id` response header and forwarded to the
  // downstream handler so every log line for a request shares an ID.
  const requestId =
    request.headers.get('x-request-id') ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT remove the line below.
  // This refreshes the auth session and sets cookies.
  // Without this, your user's session WILL expire.
  await supabase.auth.getUser();

  supabaseResponse.headers.set('x-request-id', requestId);

  // ── Security headers (hardening, MP21) ───────────────────
  // Clickjacking / MIME-sniffing / referrer-leak protections on every
  // response. CSP deliberately omitted here: this app loads Supabase auth,
  // remote images, fonts, and inline styles/scripts from many origins, and a
  // naive policy would break first-party flows — a correct CSP is defined in
  // next.config.js (static response headers) once its exact origins are
  // locked down during Stage B hardening.
  const SECURITY_HEADERS: [string, string][] = [
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    [
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    ],
  ];
  for (const [key, value] of SECURITY_HEADERS) {
    supabaseResponse.headers.set(key, value);
  }
  supabaseResponse.headers.set('x-request-id', requestId);

  // ── Referral deep-link rewrite (MP23) ────────────────────
  // Invite links are shared as /s/CODE (durable, opaque codes) but the
  // branded landing + server-side attribution cookie live in the route
  // handler at /api/s/[code]. Rewrite the public URL to that handler so a
  // shared link never 404s and attribution works without client JS.
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/s/')) {
    const code = pathname.slice(3);
    // Single-segment alphanumeric codes only (the handler validates length
    // and redirects malformed codes home — never a 404 on a shared link).
    if (code && !code.includes('/') && code.length <= 64 && /^[a-z0-9]+$/i.test(code)) {
      const rewrite = NextResponse.rewrite(
        new URL(`/api/s/${code.toLowerCase()}`, request.url),
        { request: { headers: requestHeaders } }
      );
      for (const [key, value] of SECURITY_HEADERS) {
        rewrite.headers.set(key, value);
      }
      rewrite.headers.set('x-request-id', requestId);
      return rewrite;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};