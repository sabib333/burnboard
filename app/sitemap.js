// Dynamic Sitemap Generator for BURNBOARD
// Includes real profile URLs from Supabase — no fake URLs if no data

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://burnboard.app';

  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/top`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/battle`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/roast/linkedin`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/roast/github`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/roast/x`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/roast/instagram`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/roast/tiktok`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Add real profile URLs from Supabase (no fake URLs)
  let profileUrls = [];
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, created_at')
        .order('created_at', { ascending: false });

      if (profiles && profiles.length > 0) {
        profileUrls = profiles.map(p => ({
          url: `${baseUrl}/post/${p.id}`,
          lastModified: new Date(p.created_at),
          changeFrequency: 'weekly',
          priority: 0.7,
        }));
      }
    } catch (err) {
      console.warn('[Sitemap] Failed to fetch profiles:', err);
    }
  }

  return [...staticRoutes, ...profileUrls];
}
