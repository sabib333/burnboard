import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req, { params }) {
  try {
    const { token } = params;
    const body = await req.json();
    const { hot_seat_id } = body;

    if (!token || !hot_seat_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Fetch the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('friend_challenges')
      .select('*')
      .eq('public_token', token)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Check if challenge is in accepted state
    if (challenge.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Challenge is not in accepted state' },
        { status: 400 }
      );
    }

    // Verify the hot seat exists
    const { data: hotSeat, error: seatError } = await supabase
      .from('hot_seats')
      .select('id')
      .eq('id', hot_seat_id)
      .single();

    if (seatError || !hotSeat) {
      return NextResponse.json(
        { error: 'Hot Seat not found' },
        { status: 404 }
      );
    }

    // Update challenge status to completed
    const { error: updateError } = await supabase
      .from('friend_challenges')
      .update({
        status: 'completed',
        accepted_hot_seat_id: hot_seat_id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    if (updateError) {
      console.error('[Challenge] Complete error:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Challenge completed!',
      challenge: {
        id: challenge.id,
        publicToken: challenge.public_token,
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[Challenge] Complete Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
