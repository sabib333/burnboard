import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export async function GET(req, { params }) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Missing challenge token' }, { status: 400 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Fetch the challenge by public token
    const { data: challenge, error: challengeError } = await supabase
      .from('friend_challenges')
      .select('*')
      .eq('public_token', token)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Track that the challenge was opened (analytics)
    track('challenge_opened', {
      challenge_id: challenge.id,
      challenge_token: token,
      status: challenge.status,
    });

    // Update timestamp to track opens
    await supabase
      .from('friend_challenges')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', challenge.id);

    // Fetch source hot seat info if available
    let sourceHotSeat = null;
    if (challenge.source_hot_seat_id) {
      const { data: hotSeat } = await supabase
        .from('hot_seats')
        .select('id, title, display_name, category, heat_level, roast_count')
        .eq('id', challenge.source_hot_seat_id)
        .neq('status', 'deleted')
        .single();

      sourceHotSeat = hotSeat;
    }

    // Fetch accepted hot seat info if challenge is completed
    let acceptedHotSeat = null;
    if (challenge.accepted_hot_seat_id) {
      const { data: hotSeat } = await supabase
        .from('hot_seats')
        .select('id, title, display_name, category, heat_level, roast_count')
        .eq('id', challenge.accepted_hot_seat_id)
        .single();

      acceptedHotSeat = hotSeat;
    }

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        publicToken: challenge.public_token,
        status: challenge.status,
        challengerDisplayName: challenge.challenger_display_name,
        sourceBurnScore: challenge.source_burn_score,
        createdAt: challenge.created_at,
        acceptedAt: challenge.accepted_at,
        completedAt: challenge.completed_at,
      },
      sourceHotSeat,
      acceptedHotSeat,
    });
  } catch (err) {
    console.error('[Challenge] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
