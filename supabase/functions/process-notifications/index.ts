// Supabase Edge Function: Process Notification Queue + Send FCM Push
// Called every minute via cron
// 1. Moves items from notification_queue → notifications table
// 2. For each processed notification, sends FCM push to user's devices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Firebase Admin SDK for sending push notifications
// Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars
async function getFirebaseAdmin() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Dynamic import to avoid errors if firebase-admin is not installed
  try {
    const { initializeApp, cert } = await import('https://esm.sh/firebase-admin@12/app');
    const { getMessaging } = await import('https://esm.sh/firebase-admin@12/messaging');

    const app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    });

    return { messaging: getMessaging(app) };
  } catch {
    console.warn('[Push] Firebase Admin SDK not available');
    return null;
  }
}

interface ProcessedNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
}

async function sendPushToUser(
  messaging: any,
  supabase: any,
  notification: ProcessedNotification
): Promise<number> {
  // Fetch user's FCM tokens (excluding web-only tokens)
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('token, platform')
    .eq('user_id', notification.user_id)
    .neq('platform', 'web'); // Web push handled client-side

  if (!tokens || tokens.length === 0) return 0;

  const tokensToSend = tokens.map((t: any) => t.token).filter(Boolean);
  if (tokensToSend.length === 0) return 0;

  // Build the push message
  const payload = {
    notification: {
      title: notification.title,
      body: notification.message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    },
    data: {
      link: notification.link || '',
      type: notification.type,
      notification_id: notification.id,
    },
    tokens: tokensToSend,
  };

  try {
    const response = await messaging.sendEachForMulticast(payload);
    console.log(`[Push] Sent to ${tokensToSend.length} devices, ${response.successCount} succeeded`);

    // Clean up invalid tokens
    if (response.responses) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokensToSend[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        await supabase
          .from('fcm_tokens')
          .delete()
          .in('token', invalidTokens);
        console.log(`[Push] Cleaned ${invalidTokens.length} invalid tokens`);
      }
    }

    return response.successCount || 0;
  } catch (err) {
    console.error('[Push] Send failed:', err);
    return 0;
  }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Process queue → notifications table
    const { data: processedCount, error: processError } = await supabase.rpc(
      'process_notification_queue',
      { batch_size: 500 }
    );

    if (processError) {
      return new Response(
        JSON.stringify({ error: processError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Send FCM push for recently processed notifications
    let pushSent = 0;
    const firebase = await getFirebaseAdmin();

    if (firebase && (processedCount || 0) > 0) {
      // Fetch the most recently processed notifications (last 50)
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, link')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentNotifs && recentNotifs.length > 0) {
        for (const notif of recentNotifs) {
          const sent = await sendPushToUser(firebase.messaging, supabase, notif as ProcessedNotification);
          pushSent += sent;
        }
      }
    }

    // 3. Cleanup old processed items
    await supabase.rpc('cleanup_notification_queue');

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount || 0,
        pushSent,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Queue processing error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
