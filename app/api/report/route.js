import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req) {
  try {
    const body = await req.json();
    const { roast_id, reason } = body;

    if (!roast_id) {
      return NextResponse.json({ error: 'roast_id required' }, { status: 400 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, message: 'Report logged (dev mode)' });
    }

    // Check if already reported from same IP recently
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const ip = forwardedFor.split(',')[0].trim();

    const { data: existing } = await supabase
      .from('reports')
      .select('id')
      .eq('roast_id', roast_id)
      .eq('reporter_ip', ip)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, message: 'Already reported' });
    }

    const { error } = await supabase
      .from('reports')
      .insert([{
        roast_id,
        reason: reason || 'reported',
        reporter_ip: ip,
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      // If reporter_ip column doesn't exist, insert without it
      if (error.message?.includes('reporter_ip')) {
        await supabase
          .from('reports')
          .insert([{
            roast_id,
            reason: reason || 'reported',
            created_at: new Date().toISOString(),
          }]);
      } else {
        console.error('[Report] Insert error:', error);
      }
    }

    return NextResponse.json({ success: true, message: 'Reported - Admin will check' });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Report failed' }, { status: 500 });
  }
}
