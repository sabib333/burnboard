/**
 * BURNBOARD Email Notifications (Resend)
 *
 * Handles subscribing to profile roast alerts and triggering
 * email notifications when a roast is submitted.
 */

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Subscribe an email to notifications for a profile
 */
export async function subscribeToRoastAlerts(
  profileId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        profile_id: profileId,
        email: email.trim().toLowerCase(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Subscription failed' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Trigger email notifications to all subscribers of a profile
 * Called automatically after a roast is submitted
 */
export async function notifySubscribers(
  profileId: string,
  roastText: string,
  roastId?: string
): Promise<{ subscribersNotified: number }> {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'notify',
        profile_id: profileId,
        roast_text: roastText,
        roast_id: roastId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn('Notification API error:', data.error);
      return { subscribersNotified: 0 };
    }

    return { subscribersNotified: data.subscribersNotified || 0 };
  } catch (err: any) {
    console.warn('Notification fetch error:', err.message);
    return { subscribersNotified: 0 };
  }
}

/**
 * Check if user has subscribed to notifications for a profile
 * (localStorage-based quick check)
 */
export function isSubscribedToProfile(profileId: string): boolean {
  try {
    const subs = JSON.parse(localStorage.getItem('burnboard_notification_subs') || '{}');
    return !!subs[profileId];
  } catch {
    return false;
  }
}

/**
 * Save subscription to localStorage
 */
export function saveSubscription(profileId: string, email: string | null, profileUsername: string): void {
  try {
    const subs = JSON.parse(localStorage.getItem('burnboard_notification_subs') || '{}');
    subs[profileId] = {
      email,
      profile_username: profileUsername,
      subscribed_at: new Date().toISOString(),
    };
    localStorage.setItem('burnboard_notification_subs', JSON.stringify(subs));
  } catch {}
}

/**
 * Remove subscription from localStorage
 */
export function removeSubscription(profileId: string): void {
  try {
    const subs = JSON.parse(localStorage.getItem('burnboard_notification_subs') || '{}');
    delete subs[profileId];
    localStorage.setItem('burnboard_notification_subs', JSON.stringify(subs));
  } catch {}
}

/**
 * Get all subscribed profile IDs
 */
export function getSubscribedProfileIds(): string[] {
  try {
    const subs = JSON.parse(localStorage.getItem('burnboard_notification_subs') || '{}');
    return Object.keys(subs);
  } catch {
    return [];
  }
}
