import { Metadata } from 'next';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import BurnShareCardClient from './BurnShareCardClient';

// ── Social Preview Metadata ──
export async function generateMetadata({ params }) {
  const { id } = params;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://burnboard.app'}/api/burn-report/${id}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return {
        title: '🔥 Burn Result | BURN BOARD',
        description: 'Check out this burn result from BURN BOARD!',
      };
    }

    const { report } = await res.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://burnboard.app';
    const ogImageUrl = `${siteUrl}/api/og?template=burn-summary&score=${report.burnScore}&status=${encodeURIComponent(report.burnStatus.label)}&statusEmoji=${encodeURIComponent(report.burnStatus.emoji)}&roastCount=${report.roastCount}&displayName=${encodeURIComponent(report.displayName)}&totalReactions=${report.totalReactions}${report.topRoast ? `&topRoast=${encodeURIComponent(report.topRoast.text)}` : ''}`;

    return {
      title: `🔥 ${report.displayName}'s Burn Score: ${report.burnScore}/100 — ${report.burnStatus.label} | BURN BOARD`,
      description: `My Burn Score is ${report.burnScore}/100 — ${report.burnStatus.label}! ${report.roastCount} roasts received. Can you survive the internet?`,
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: `${siteUrl}/hot-seat/${id}/share`,
        title: `🔥 ${report.displayName}'s Burn Score: ${report.burnScore}/100 — ${report.burnStatus.label}`,
        description: `My Burn Score is ${report.burnScore}/100 — ${report.burnStatus.label}! ${report.roastCount} roasts received. Can you survive the internet?`,
        siteName: 'BURN BOARD',
        images: [
          {
            url: ogImageUrl,
            width: 1080,
            height: 1080,
            alt: `BURN BOARD Burn Report — ${report.burnScore}/100 — ${report.burnStatus.label}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `🔥 ${report.displayName}'s Burn Score: ${report.burnScore}/100`,
        description: `My Burn Score is ${report.burnScore}/100 — ${report.burnStatus.label}! Can you survive the internet?`,
        images: [ogImageUrl],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: '🔥 Burn Result | BURN BOARD',
      description: 'Check out this burn result from BURN BOARD!',
    };
  }
}

// ── Share Page (Server Component wrapper) ──
export default function SharePage({ params }) {
  const { id } = params;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <Flame className="w-4 h-4" />
            <span>BURN BOARD</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Flame className="w-4 h-4 fill-[#ff4d00]" />
            <span>BURN REPORT</span>
          </div>
        </div>

        {/* Client-side burn report display */}
        <BurnShareCardClient hotSeatId={id} />

        {/* CTA */}
        <div className="text-center pt-6 border-t border-[#222] space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white uppercase tracking-wider">
              Can you survive the internet?
            </h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Put yourself on the Hot Seat and find out your Burn Score.
            </p>
          </div>
          <Link
            href="/hot-seat"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
          >
            🔥 Put Me on the Hot Seat
          </Link>
        </div>
      </div>
    </div>
  );
}
