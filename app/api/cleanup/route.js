import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Fail closed: without CRON_SECRET configured this route (which deletes
    // rows) must never run.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, message: 'Database simulated - no cleanup required' });
    }

    // 1. Delete roasts flagged as isClean = false
    const { data: deletedRoasts } = await supabase
      .from('roasts')
      .delete()
      .eq('isClean', false)
      .select('id');

    // 2. Delete abandoned profiles with 0 roasts older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: ghosts } = await supabase
      .from('profiles')
      .select('id')
      .eq('roast_count', 0)
      .lte('created_at', sevenDaysAgo);

    let deletedGhostCount = 0;
    if (ghosts && ghosts.length > 0) {
      const ids = ghosts.map(g => g.id);
      await supabase.from('profiles').delete().in('id', ids);
      deletedGhostCount = ids.length;
    }

    return NextResponse.json({
      success: true,
      cleanedRoasts: deletedRoasts?.length || 0,
      cleanedGhostProfiles: deletedGhostCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
