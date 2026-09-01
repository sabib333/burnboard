import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const body = await req.json();
    const { profile_id, email } = body;

    if (!profile_id || !email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email and profile_id required' }, { status: 400 });
    }

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase
        .from('email_subscribers')
        .insert([{ profile_id, email: email.trim().toLowerCase() }]);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Subscribed to profile alerts.' });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Subscription error' }, { status: 500 });
  }
}
