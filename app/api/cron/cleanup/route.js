/**
 * BURNBOARD Daily Cleanup Cron
 *
 * Runs daily at midnight via Vercel Cron (free tier).
 * - Deletes expired stories (older than 24h past expiry)
 * - Deletes security logs older than 30 days
 * - Updates profile roast_count for consistency
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = {};

  try {
    // 1. Delete expired stories (older than 24h past expiry)
    const { count: storiesDeleted, error: storiesErr } = await supabase
      .from('stories')
      .delete()
      .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    results.storiesDeleted = storiesDeleted || 0;
    if (storiesErr) results.storiesError = storiesErr.message;

    // 2. Delete security logs older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: logsDeleted, error: logsErr } = await supabase
      .from('security_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo);

    results.logsDeleted = logsDeleted || 0;
    if (logsErr) results.logsError = logsErr.message;

    // 3. Update profile roast_count for consistency
    // Count actual roasts per profile and update
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id');

    if (profiles && profiles.length > 0) {
      let updated = 0;
      for (const profile of profiles) {
        const { count } = await supabase
          .from('roasts')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profile.id)
          .eq('is_hidden', false);

        if (count !== undefined) {
          await supabase
            .from('profiles')
            .update({ roast_count: count })
            .eq('id', profile.id);
          updated++;
        }
      }
      results.profilesUpdated = updated;
    }

    // 4. Deactivate expired challenges
    const { count: challengesDeactivated } = await supabase
      .from('challenges')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString());

    results.challengesDeactivated = challengesDeactivated || 0;

    console.log('[Cron] Cleanup completed:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });

  } catch (err) {
    console.error('[Cron] Cleanup failed:', err);
    return NextResponse.json({
      error: 'Cleanup failed',
      details: err.message,
      partialResults: results,
    }, { status: 500 });
  }
}
