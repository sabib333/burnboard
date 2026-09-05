// Vercel Cron: Process Notification Queue + Send FCM Push
// Runs on schedule to batch-process notifications and send push.
//
// Reliability (Master Prompt 16):
// - Queue processing is atomic + idempotent in SQL (FOR UPDATE SKIP LOCKED).
// - Push delivery is idempotent: only notifications with push_sent = false
//   are pushed, then flagged — a failed run is retried next run, a
//   successful run never re-pushes the same notification.
// - FCM tokens are fetched in ONE batched query per run (no per-user N+1).

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

/**
 * Send push for a list of notifications using pre-fetched tokens.
 *
 * @param {object} messaging Firebase messaging instance
 * @param {Array} notifications notifications to push (push_sent = false)
 * @param {Map<string, string[]>} tokensByUser user_id -> native FCM tokens
 * @returns {Promise<{ pushedCount: number, processedIds: string[] }>}
 *   processedIds = notifications fully handled (sent, or no devices) —
 *   these get flagged push_sent. Anything that threw stays unmarked so
 *   the next run retries it.
 */
async function sendPushes(messaging, notifications, tokensByUser) {
  if (!messaging || notifications.length === 0) {
    return { pushedCount: 0, processedIds: [] };
  }

  let pushedCount = 0;
  const processedIds = [];
  const invalidTokens = [];

  for (const notification of notifications) {
    const tokens = tokensByUser.get(notification.user_id) || [];

    // No native devices → nothing to push; safe to mark handled.
    if (tokens.length === 0) {
      processedIds.push(notification.id);
      continue;
    }

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
      tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(payload);

      if (response.responses) {
        response.responses.forEach((resp, idx) => {
          if (resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx]);
          }
        });
      }

      pushedCount += response.successCount || 0;
      processedIds.push(notification.id);
    } catch (err) {
      // Leave unmarked so the next run retries this notification.
      console.warn('[ProcessNotif] Push send failed:', err.message);
    }
  }

  // Clean up invalid tokens once per run (batched).
  if (invalidTokens.length > 0) {
    try {
      await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
    } catch (err) {
      console.warn('[ProcessNotif] Invalid token cleanup failed:', err.message);
    }
  }

  return { pushedCount, processedIds };
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: queue processing (which sends push notifications) must
    // never run without a configured secret.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ success: true, processed: 0, pushSent: 0 });
    }

    // 1. Process queue → notifications table (atomic, idempotent RPC)
    const { data: processedCount, error } = await supabase.rpc('process_notification_queue', {
      batch_size: 500,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Send FCM push for notifications not yet pushed (idempotent).
    let pushSent = 0;
    const messaging = await getFirebaseMessaging();

    if (messaging) {
      const { data: pending } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, link')
        .eq('push_sent', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (pending && pending.length > 0) {
        // Single batched token fetch for all pending recipients.
        const userIds = [...new Set(pending.map(n => n.user_id).filter(Boolean))];
        const tokensByUser = new Map();

        if (userIds.length > 0) {
          const { data: tokens } = await supabase
            .from('fcm_tokens')
            .select('user_id, token')
            .in('user_id', userIds)
            .neq('platform', 'web');

          for (const t of tokens || []) {
            if (!t.token) continue;
            const list = tokensByUser.get(t.user_id) || [];
            list.push(t.token);
            tokensByUser.set(t.user_id, list);
          }
        }

        const { pushedCount: sent, processedIds } = await sendPushes(messaging, pending, tokensByUser);
        pushSent = sent;

        // Flag only fully-handled notifications — failures retry next run.
        if (processedIds.length > 0) {
          await supabase
            .from('notifications')
            .update({ push_sent: true })
            .in('id', processedIds);
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