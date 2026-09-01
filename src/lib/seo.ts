/**
 * BURNBOARD SEO Engine — Dynamic Meta + Structured Data
 *
 * Generates real meta tags, Open Graph data, and JSON-LD
 * for every page based on actual Supabase data.
 */

import { Profile, Roast } from '../types';

const SITE_URL = 'https://burnboard.app';
const SITE_NAME = 'BURNBOARD';

// ── Platform SEO Data ────────────────────────────────────────

export const PLATFORM_SEO: Record<string, {
  title: string;
  description: string;
  keywords: string[];
  icon: string;
}> = {
  linkedin: {
    title: 'LinkedIn Roasts — Get Roasted by Real Humans | BURNBOARD',
    description: 'The brutal anonymous LinkedIn roast platform. Submit your LinkedIn profile, get roasted by real humans. No AI. No filters. Just savage burns.',
    keywords: ['linkedin roast', 'linkedin cringe', 'linkedin thought leader', 'linkedin humor', 'roast my linkedin', 'burnboard'],
    icon: '💼',
  },
  github: {
    title: 'GitHub Roasts — 10x Developer Roasts | BURNBOARD',
    description: 'Roast any GitHub profile. Real humans destroying your commit history, readme, and contribution graph. No AI allowed.',
    keywords: ['github roast', 'developer roast', 'code review roast', '10x developer', 'burnboard github'],
    icon: '💻',
  },
  twitter: {
    title: 'X / Twitter Roasts — Get Roasted Online | BURNBOARD',
    description: 'Anonymous human roasts for X/Twitter accounts. Submit your handle, get destroyed by real people. Zero AI. Maximum brutality.',
    keywords: ['twitter roast', 'x roast', 'tweet roast', 'social media roast', 'burnboard twitter'],
    icon: '🐦',
  },
  instagram: {
    title: 'Instagram Roasts — Influencer Roasts | BURNBOARD',
    description: 'Roast Instagram influencers and creators. Real humans, no AI, just brutal honesty about your feed, stories, and reels.',
    keywords: ['instagram roast', 'influencer roast', 'ig roast', 'burnboard instagram'],
    icon: '📸',
  },
  tiktok: {
    title: 'TikTok Roasts — Creator Roasts | BURNBOARD',
    description: 'Get your TikTok roasted by real humans. Submit your handle, get honest feedback. No AI filters, just savage burns.',
    keywords: ['tiktok roast', 'creator roast', 'burnboard tiktok'],
    icon: '🎵',
  },
  reddit: {
    title: 'Reddit Roasts — Subreddit Roasts | BURNBOARD',
    description: 'Roast Reddit moderators and power users. Real humans destroying your post history. No AI, no mercy.',
    keywords: ['reddit roast', 'mod roast', 'burnboard reddit'],
    icon: '🟠',
  },
  'indie hacker': {
    title: 'Indie Hacker Roasts — SaaS Roasts | BURNBOARD',
    description: 'Roast indie hackers and their SaaS projects. Real humans destroying your landing page, pricing, and pitch. Brutal honesty.',
    keywords: ['indie hacker roast', 'saas roast', 'startup roast', 'burnboard indie'],
    icon: '🚀',
  },
};

// ── Profile SEO ──────────────────────────────────────────────

export function generateProfileMeta(profile: Profile, topRoast?: Roast) {
  const platformData = PLATFORM_SEO[profile.platform.toLowerCase()] || PLATFORM_SEO.linkedin;
  const title = `Roast @${profile.username} — ${platformData.icon} ${platformData.title.split('—')[0].trim()} | ${profile.roast_count} brutal roasts`;
  const description = topRoast
    ? `"${topRoast.roast_text.slice(0, 120)}..." — ${profile.total_upvotes} upvotes. See all roasts for @${profile.username} on BURNBOARD.`
    : `@${profile.username} has ${profile.roast_count} roasts on BURNBOARD. ${platformData.description}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/#post/${profile.id}`,
      siteName: SITE_NAME,
      images: [
        {
          url: `${SITE_URL}/api/og?username=${encodeURIComponent(profile.username)}&platform=${encodeURIComponent(profile.platform)}&count=${profile.roast_count}`,
          width: 1200,
          height: 630,
          alt: `Roast @${profile.username} on BURNBOARD`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [`${SITE_URL}/api/og?username=${encodeURIComponent(profile.username)}&platform=${encodeURIComponent(profile.platform)}&count=${profile.roast_count}`],
    },
  };
}

// ── Platform SEO ─────────────────────────────────────────────

export function generatePlatformMeta(platform: string, profileCount: number) {
  const data = PLATFORM_SEO[platform.toLowerCase()] || {
    title: `${platform} Roasts`,
    description: `Get roasted on ${platform} by real humans. No AI. Just brutal honesty.`,
    keywords: [`${platform} roast`, 'burnboard'],
    icon: '🔥',
  };

  return {
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    openGraph: {
      title: data.title,
      description: data.description,
      url: `${SITE_URL}/#roast/${platform.toLowerCase()}`,
      siteName: SITE_NAME,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
  };
}

// ── JSON-LD Structured Data ──────────────────────────────────

export function generateProfileJsonLd(profile: Profile, roasts: Roast[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `@${profile.username}`,
    description: profile.bio,
    url: `${SITE_URL}/#post/${profile.id}`,
    knowsAbout: profile.platform,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, Math.max(1, Math.floor(profile.total_upvotes / 10) + 1)),
      reviewCount: profile.roast_count,
      bestRating: 5,
      worstRating: 1,
    },
    review: roasts.slice(0, 5).map(r => ({
      '@type': 'Review',
      reviewBody: r.roast_text,
      author: {
        '@type': 'Person',
        name: r.anon_id || 'Anonymous Roaster',
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: Math.min(5, Math.max(1, Math.floor(r.upvotes / 2) + 1)),
      },
    })),
  };
}

export function generatePlatformJsonLd(platform: string, count: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${platform} Roasts — BURNBOARD`,
    description: `Best ${platform} roasts — ${count} real humans roasted. Top savage roasts for ${platform} profiles.`,
    url: `${SITE_URL}/#roast/${platform.toLowerCase()}`,
    numberOfItems: count,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: count,
      itemListElement: [],
    },
  };
}

// ── Static Sitemap URLs ──────────────────────────────────────

export function getStaticSitemapUrls() {
  const base = SITE_URL;
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'always' as const, priority: 1.0 },
    { url: `${base}/top`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${base}/battle`, lastModified: new Date(), changeFrequency: 'always' as const, priority: 0.9 },
    { url: `${base}/explore`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.85 },
    { url: `${base}/#roast/linkedin`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/#roast/github`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/#roast/twitter`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/#roast/instagram`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.85 },
    { url: `${base}/#roast/tiktok`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
  ];
}

// ── Share URLs ───────────────────────────────────────────────

export function getShareUrls(profile: Profile, roast?: Roast) {
  const profileUrl = `${SITE_URL}/#post/${profile.id}`;
  const platformUrl = `${SITE_URL}/#roast/${profile.platform.toLowerCase()}`;

  const tweetText = roast
    ? `"${roast.roast_text.slice(0, 100)}" — @${profile.username} has ${profile.roast_count} roasts on BURNBOARD 🔥`
    : `@${profile.username} has ${profile.roast_count} roasts on BURNBOARD 🔥 No AI. Just humans roasting humans.`;

  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
    reddit: `https://reddit.com/submit?url=${encodeURIComponent(profileUrl)}&title=${encodeURIComponent(`@${profile.username} just got roasted on BURNBOARD 🔥`)}`,
    copy: profileUrl,
  };
}
