// Supabase Edge Function: Auto Cleanup Cron Job
// Deletes roasts where isClean=false and deletes abandoned profiles with 0 roasts older than 7 days

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Delete flagged/unclean roasts
    const { data: deletedRoasts, error: roastsErr } = await supabase
      .from('roasts')
      .delete()
      .eq('isClean', false)
      .select('id');

    // 2. Find and delete ghost profiles (0 roasts, created > 7 days ago)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Select candidates
    const { data: ghostCandidates, error: ghostErr } = await supabase
      .from('profiles')
      .select('id, roast_count, created_at')
      .eq('roast_count', 0)
      .lte('created_at', sevenDaysAgo);

    let deletedGhostCount = 0;
    if (ghostCandidates && ghostCandidates.length > 0) {
      const idsToDelete = ghostCandidates.map(p => p.id);
      const { error: deleteGhostsErr } = await supabase
        .from('profiles')
        .delete()
        .in('id', idsToDelete);
      
      if (!deleteGhostsErr) {
        deletedGhostCount = idsToDelete.length;
      }
    }

    // 3. Purge expired rate-limiting or blocked temporary items older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('reports')
      .delete()
      .lte('created_at', thirtyDaysAgo);

    return new Response(
      JSON.stringify({
        success: true,
        cleanedRoasts: deletedRoasts?.length || 0,
        cleanedGhostProfiles: deletedGhostCount,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Cleanup error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
