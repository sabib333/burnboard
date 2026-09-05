import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getOrCreateAnonId } from '@/src/lib/presence';
import { track } from '@/lib/analytics';

// Rate limiting: max 5 challenges per anonymous user per hour
const RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
};

const challengeCounts = new Map(); // In-memory rate limiting (resets on server restart)

function checkRateLimit(anonId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  
  if (!challengeCounts.has(anonId)) {
    challengeCounts.set(anonId, []);
  }
  
  const timestamps = challengeCounts.get(anonId);
  // Remove old timestamps outside the window
  const validTimestamps = timestamps.filter(t => t > windowStart);
  challengeCounts.set(anonId, validTimestamps);
  
  if (validTimestamps.length >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  validTimestamps.push(now);
  return true;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      source_hot_seat_id, 
      source_burn_score, 
      display_name,
      challenger_anon_id: provided_anon_id 
    } = body;

    // Get or create anonymous ID
    const challenger_anon_id = provided_anon_id || 'Anonymous';
    const challenger_display_name = display_name || 'Someone';

    // Rate limiting
    if (!checkRateLimit(challenger_anon_id)) {
      return NextResponse.json(
        { error: 'Too many challenges. Please wait before creating another.' },
        { status: 429 }
      );
    }

    if (!isSupabaseConfigured || !supabase) {
      // Dev fallback
      const token = generateToken();
      return NextResponse.json({
        success: true,
        challenge: {
          id: 'ch-' + Date.now(),
          public_token: token,
          status: 'active',
          created_at: new Date().toISOString(),
        },
      });
    }

    // Verify source hot seat exists if provided
    if (source_hot_seat_id) {
      const { data: hotSeat, error: seatError } = await supabase
        .from('hot_seats')
        .select('id')
        .eq('id', source_hot_seat_id)
        .neq('status', 'deleted')
        .single();

      if (seatError || !hotSeat) {
        return NextResponse.json(
          { error: 'Source Hot Seat not found' },
          { status: 404 }
        );
      }
    }

    // Create the challenge
    const newChallenge = {
      challenger_user_id: null, // Anonymous for now
      challenger_anon_id,
      challenger_display_name,
      source_hot_seat_id: source_hot_seat_id || null,
      source_burn_score: source_burn_score || null,
      status: 'active',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('friend_challenges')
      .insert([newChallenge])
      .select()
      .single();

    if (insertError) {
      console.error('[Challenge] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create challenge' },
        { status: 500 }
      );
    }

    track('challenge_created', {
      challenge_id: inserted.id,
      source_hot_seat_id: source_hot_seat_id || null,
      has_source: !!source_hot_seat_id,
    });

    return NextResponse.json({
      success: true,
      challenge: {
        id: inserted.id,
        public_token: inserted.public_token,
        status: inserted.status,
        created_at: inserted.created_at,
        url: `/friend-challenge/${inserted.public_token}`,
      },
    });
  } catch (err) {
    console.error('[Challenge] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
