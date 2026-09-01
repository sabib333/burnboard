// Vercel Cron: Process Notification Queue + Send FCM Push
// Runs every minute to batch-process notifications and send push

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Firebase Admin SDK (lazy loaded)
let firebaseMessaging = null;

async function getFirebaseMessaging() {
  if (firebaseMessaging) return firebaseMessaging;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    });

    firebaseMessaging = getMessaging(app);
    return firebaseMessaging;
  } catch {
    console.warn('[ProcessNotif] Firebase Admin not available');
    return null;
  }
}

async function sendPushToUser(messaging, userId, notification) {
  if (!messaging || !supabase) return 0;

  // Fetch user's FCM tokens (native only — web handled client-side)
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('token, platform')
    .eq('user_id', userId)
    .neq('platform', 'web');

  if (!tokens || tokens.length === 0) return 0;

  const tokensToSend = tokens.map(t => t.token).filter(Boolean);
  if (tokensToSend.length === 0) return 0;

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

    // Clean up invalid tokens
    if (response.responses) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokensToSend[idx]);
        }
      });
      if (invalidTokens.length > 0) {
        await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
      }
    }

    return response.successCount || 0;
  } catch (err) {
    console.warn('[ProcessNotif] Push send failed:', err.message);
    return 0;
  }
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, processed: 0, pushSent: 0 });
    }

    // 1. Process queue → notifications table
    const { data: processedCount, error } = await supabase.rpc('process_notification_queue', {
      batch_size: 500,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Send FCM push for recently processed notifications
    let pushSent = 0;
    const messaging = await getFirebaseMessaging();

    if (messaging && (processedCount || 0) > 0) {
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, link')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentNotifs) {
        for (const notif of recentNotifs) {
          const sent = await sendPushToUser(messaging, notif.user_id, notif);
          pushSent += sent;
        }
      }
    }

    // 3. Cleanup
    await supabase.rpc('cleanup_notification_queue');

    return NextResponse.json({
      success: true,
      processed: processedCount || 0,
      pushSent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
