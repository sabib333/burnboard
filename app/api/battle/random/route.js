import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch 10 random profiles and pick 2
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(20);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (profiles && profiles.length >= 2) {
        const shuffled = [...profiles].sort(() => 0.5 - Math.random());
        const profile1 = shuffled[0];
        const profile2 = shuffled[1];

        // Fetch top roasts for each
        const { data: roasts1 } = await supabase
          .from('roasts')
          .select('*')
          .eq('profile_id', profile1.id)
          .order('upvotes', { ascending: false })
          .limit(1);

        const { data: roasts2 } = await supabase
          .from('roasts')
          .select('*')
          .eq('profile_id', profile2.id)
          .order('upvotes', { ascending: false })
          .limit(1);

        return NextResponse.json({
          profile1: { ...profile1, top_roast: roasts1?.[0]?.roast_text || 'No burns yet.' },
          profile2: { ...profile2, top_roast: roasts2?.[0]?.roast_text || 'No burns yet.' },
        });
      }
    }

    return NextResponse.json({
      message: 'Battle endpoint active. Configure Supabase for dynamic server-side selection.'
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
