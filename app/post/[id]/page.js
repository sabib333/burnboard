import React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PostClient from './PostClient';

export async function generateMetadata({ params }) {
  const { id } = params;

  if (!isSupabaseConfigured || !supabase) {
    return {
      title: 'Profile - BURNBOARD',
      description: 'View this roast profile on BURNBOARD.',
    };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!profile) {
      return {
        title: 'Profile Not Found - BURNBOARD',
        description: 'This profile has been deleted or does not exist.',
        robots: { index: false },
      };
    }

    // Get first roast for description
    const { data: roasts } = await supabase
      .from('roasts')
      .select('roast_text')
      .eq('profile_id', id)
      .order('upvotes', { ascending: false })
      .limit(1);

    const firstRoast = roasts?.[0]?.roast_text || '';
    const description = firstRoast
      ? `${profile.username} is getting roasted: "${firstRoast.slice(0, 120)}..." — ${profile.roast_count || 0} roasts on BURNBOARD`
      : `${profile.username} (${profile.platform}) is on BURNBOARD with ${profile.roast_count || 0} roasts. No AI. Just humans roasting humans.`;

    return {
      title: `${profile.username} is getting roasted (${profile.roast_count || 0} roasts) - BURNBOARD`,
      description,
      openGraph: {
        title: `@${profile.username} — ${profile.roast_count || 0} Roasts on BURNBOARD`,
        description,
        type: 'profile',
        url: `https://burnboard.app/post/${id}`,
        images: [
          {
            url: `/api/og?template=roast&text=${encodeURIComponent(firstRoast || 'No roasts yet')}&username=${encodeURIComponent(profile.username)}&platform=${encodeURIComponent(profile.platform)}`,
            width: 1080,
            height: 1080,
            alt: `${profile.username} roast on BURNBOARD`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `@${profile.username} — ${profile.roast_count || 0} Roasts`,
        description,
      },
    };
  } catch (err) {
    return {
      title: 'Profile - BURNBOARD',
      description: 'View this roast profile on BURNBOARD.',
    };
  }
}

export default async function PostPage({ params }) {
  const { id } = params;

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-mono">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔥</div>
          <h1 className="text-xl font-bold">Supabase Not Configured</h1>
          <p className="text-xs text-zinc-400">Connect your Supabase project to view profiles.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl">
            ← Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // Fetch real profile data
  let profile = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    profile = data;
  } catch (err) {
    console.error('[Post Page] Fetch error:', err);
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-mono">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            🏃‍♂️💨
          </div>
          <div className="space-y-1">
            <div className="text-xs text-[#ff4d00] font-bold uppercase tracking-widest">404 Error</div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              This profile escaped the roast
            </h1>
          </div>
          <p className="text-xs text-zinc-400 max-w-sm">
            The target you are looking for has been deleted, purged, or was never submitted.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl shadow transition-all">
            ← Return to Active Feed
          </Link>
        </div>
      </div>
    );
  }

  // Fetch real roasts
  let roasts = [];
  try {
    const { data } = await supabase
      .from('roasts')
      .select('*')
      .eq('profile_id', id)
      .order('created_at', { ascending: false });
    roasts = data || [];
  } catch (err) {
    console.error('[Post Page] Roast fetch error:', err);
  }

  // Add structured data for Google Rich Results
  const profileSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `@${profile.username} on BURNBOARD`,
    description: profile.bio || `${profile.username} roast profile on BURNBOARD`,
    url: `https://burnboard.app/post/${id}`,
    mainEntity: {
      '@type': 'Person',
      name: profile.username,
      description: profile.bio,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileSchema) }}
      />
      <PostClient profile={profile} initialRoasts={roasts} />
    </>
  );
}
