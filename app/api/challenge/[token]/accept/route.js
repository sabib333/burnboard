import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export async function POST(req, { params }) {
  try {
    const { token } = params;
    const body = await req.json();
    const { accepted_by_anon_id } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing challenge token' }, { status: 400 });
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

    // Check if challenge is still active
    if (challenge.status !== 'active') {
      return NextResponse.json(
        { error: 'This challenge has already been accepted or is no longer active' },
        { status: 400 }
      );
    }

    // Check if trying to accept own challenge
    if (accepted_by_anon_id && challenge.challenger_anon_id === accepted_by_anon_id) {
      return NextResponse.json(
        { error: 'You cannot accept your own challenge' },
        { status: 400 }
      );
    }

    // Update challenge status to accepted
    const { error: updateError } = await supabase
      .from('friend_challenges')
      .update({
        status: 'accepted',
        accepted_by_anon_id: accepted_by_anon_id || null,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    if (updateError) {
      console.error('[Challenge] Accept error:', updateError);
      return NextResponse.json(
        { error: 'Failed to accept challenge' },
        { status: 500 }
      );
    }

    track('challenge_accepted', {
      challenge_id: challenge.id,
      challenge_token: token,
      source_hot_seat_id: challenge.source_hot_seat_id || null,
    });

    return NextResponse.json({
      success: true,
      message: 'Challenge accepted! Create your Hot Seat now.',
      challenge: {
        id: challenge.id,
        publicToken: challenge.public_token,
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[Challenge] Accept Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
