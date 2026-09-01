// Vercel OG Image Generator for BURNBOARD (1080x1080 Viral Format)
// Supports template=roast, template=battle, and template=platform
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') || 'roast';
    const username = searchParams.get('username') || searchParams.get('username1') || 'someone';
    const username2 = searchParams.get('username2') || 'target2';
    const text = searchParams.get('text') || searchParams.get('roast') || 'No AI. Just Humans Roasting Humans.';
    const platform = searchParams.get('platform') || 'Social';
    const anon = searchParams.get('anon') || 'Anonymous Roast';
    const votes1 = searchParams.get('votes1') || '50%';
    const votes2 = searchParams.get('votes2') || '50%';
    const count = searchParams.get('count') || '0';

    // ── PLATFORM TEMPLATE ──────────────────────────────────────
    if (template === 'platform') {
      const platformColors = {
        'LinkedIn': { bg: '#0a1628', accent: '#0077b5', text: '#60a5fa' },
        'GitHub': { bg: '#0a1a0a', accent: '#238636', text: '#4ade80' },
        'X': { bg: '#0a0a1a', accent: '#1d9bf0', text: '#60a5fa' },
        'Twitter': { bg: '#0a0a1a', accent: '#1d9bf0', text: '#60a5fa' },
        'Instagram': { bg: '#1a0a14', accent: '#e1306c', text: '#f472b6' },
        'TikTok': { bg: '#0a0a0a', accent: '#ff0050', text: '#ff2d55' },
        'Reddit': { bg: '#1a0a0a', accent: '#ff4500', text: '#fb923c' },
      };
      const colors = platformColors[platform] || { bg: '#0a0a0a', accent: '#ff4d00', text: '#ff4d00' };

      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.bg,
              backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
              backgroundSize: '80px 80px',
              padding: '75px',
              fontFamily: 'Inter, sans-serif',
              border: '16px solid #222222',
              color: '#f0f0f0',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Brand */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '48px' }}>🔥</span>
                <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
                  BURNBOARD
                </span>
              </div>
              <div
                style={{
                  backgroundColor: colors.accent,
                  color: '#000000',
                  padding: '10px 24px',
                  borderRadius: '999px',
                  fontSize: '20px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {platform}
              </div>
            </div>

            {/* Center Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', margin: 'auto 0' }}>
              <div style={{ fontSize: '64px', marginBottom: '8px' }}>🎯</div>
              <div
                style={{
                  fontSize: '52px',
                  fontWeight: 900,
                  lineHeight: 1.2,
                  color: '#ffffff',
                  textAlign: 'center',
                  maxWidth: '800px',
                }}
              >
                Best {platform} Roasts
              </div>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                {count} profiles getting roasted by real humans
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: '#a1a1aa',
                  textAlign: 'center',
                  maxWidth: '700px',
                }}
              >
                No AI. No bots. Just anonymous humans delivering brutal burns.
              </div>
            </div>

            {/* Bottom Footer */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '2px solid #222222',
                paddingTop: '28px',
                fontSize: '22px',
              }}
            >
              <div style={{ color: '#a1a1aa', fontWeight: 600 }}>
                Burn a <span style={{ color: '#ffffff', fontWeight: 800 }}>{platform}</span> user today
              </div>
              <div style={{ color: '#ff4d00', fontWeight: 900, letterSpacing: '0.5px' }}>
                burnboard.xyz
              </div>
            </div>
          </div>
        ),
        { width: 1080, height: 1080 }
      );
    }

    // ── BATTLE TEMPLATE ──────────────────────────────────────
    if (template === 'battle') {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0a0a0a',
              backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
              backgroundSize: '80px 80px',
              padding: '70px',
              fontFamily: 'Inter, sans-serif',
              border: '16px solid #222222',
              color: '#f0f0f0',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Brand Bar */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '48px' }}>🔥</span>
                <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
                  BURNBOARD
                </span>
              </div>
              <div
                style={{
                  backgroundColor: '#ff4d00',
                  color: '#000000',
                  padding: '10px 24px',
                  borderRadius: '999px',
                  fontSize: '20px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                ⚔️ LIVE BATTLE ARENA
              </div>
            </div>

            {/* Battle Centerpiece */}
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '20px', margin: 'auto 0' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#111111', border: '3px solid #ff4d00', borderRadius: '28px', padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#ff4d00', marginBottom: '8px' }}>@{username}</div>
                <div style={{ fontSize: '44px', fontWeight: 900, color: '#ffffff' }}>{votes1}</div>
                <div style={{ fontSize: '18px', color: '#a1a1aa', marginTop: '6px' }}>Voted Most Roasted</div>
              </div>

              <div style={{ width: '100px', height: '100px', borderRadius: '50px', backgroundColor: '#0a0a0a', border: '4px solid #ff4d00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: '#ffffff', boxShadow: '0 0 40px rgba(255,77,0,0.5)' }}>
                VS
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#111111', border: '3px solid #3b82f6', borderRadius: '28px', padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#60a5fa', marginBottom: '8px' }}>@{username2}</div>
                <div style={{ fontSize: '44px', fontWeight: 900, color: '#ffffff' }}>{votes2}</div>
                <div style={{ fontSize: '18px', color: '#a1a1aa', marginTop: '6px' }}>Voted Most Roasted</div>
              </div>
            </div>

            {/* Bottom Footer */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #222222', paddingTop: '28px', fontSize: '22px' }}>
              <div style={{ color: '#a1a1aa', fontWeight: 600 }}>Vote live on <span style={{ color: '#ffffff', fontWeight: 800 }}>BURNBOARD</span></div>
              <div style={{ color: '#ff4d00', fontWeight: 900, letterSpacing: '0.5px' }}>burnboard.xyz</div>
            </div>
          </div>
        ),
        { width: 1080, height: 1080 }
      );
    }

    // ── Default: ROAST TEMPLATE ──────────────────────────────
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#0a0a0a',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
            backgroundSize: '80px 80px',
            padding: '75px',
            fontFamily: 'Inter, sans-serif',
            border: '16px solid #222222',
            color: '#f0f0f0',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Brand & Platform */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '48px' }}>🔥</span>
              <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
                BURNBOARD
              </span>
            </div>
            <div
              style={{
                backgroundColor: '#161616',
                border: '2px solid #333333',
                padding: '10px 24px',
                borderRadius: '999px',
                fontSize: '20px',
                fontWeight: 800,
                color: '#ff4d00',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {platform}
            </div>
          </div>

          {/* Large Roast Centerpiece */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '930px', margin: 'auto 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#a1a1aa', fontSize: '26px', fontWeight: 600 }}>
              <span style={{ color: '#ff4d00', fontWeight: 800 }}>{anon}</span>
              <span>•</span>
              <span>on</span>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>@{username}</span>
            </div>
            <div
              style={{
                fontSize: text.length > 140 ? '42px' : '48px',
                fontWeight: 800,
                lineHeight: 1.28,
                color: '#ffffff',
                letterSpacing: '-0.5px',
              }}
            >
              &ldquo;{text}&rdquo;
            </div>
          </div>

          {/* Bottom Watermark & Footer */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px solid #222222',
              paddingTop: '28px',
              fontSize: '22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a1a1aa', fontWeight: 700 }}>
              <span>Target:</span>
              <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 900 }}>@{username}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#ffffff', fontWeight: 900, letterSpacing: '-0.5px' }}>🔥 BURNBOARD</span>
              <span style={{ color: '#555555' }}>|</span>
              <span style={{ color: '#ff4d00', fontWeight: 800 }}>burnboard.xyz</span>
            </div>
          </div>
        </div>
      ),
      { width: 1080, height: 1080 }
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, { status: 500 });
  }
}
