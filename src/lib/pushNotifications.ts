/**
 * Push Notifications — Pure PWA (Browser Notification API only)
 *
 * No Firebase. No Capacitor. No FCM. $0 cost.
 * Works when app is open (Supabase Realtime) + browser native notification.
 */

import { playNotificationSound } from './notificationSounds';
import type { NotificationType } from './notify';

/**
 * Request browser notification permission.
 * Returns true if granted.
 */
export async function requestWebPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a browser notification (PWA).
 * Plays per-type sound + vibration based on user preferences.
 */
export function showBrowserNotification(
  title: string,
  body: string,
  link?: string,
  type?: NotificationType,
  userId?: string
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Play per-type sound + vibration
  if (type && userId) {
    playNotificationSound(type, userId);
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `burnboard-${Date.now()}`,
      data: { link },
    });

    notification.onclick = () => {
      window.focus();
      if (link) {
        window.location.hash = link.startsWith('#') ? link : `#${link}`;
      }
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  } catch {
    // Silent fail — notifications are non-critical
  }
}

/**
 * Check if browser push is supported and granted
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Request browser push permission on first roast.
 * This is the only push registration we need for PWA.
 */
export async function registerForPushNotifications(_userId?: string): Promise<string | null> {
  const granted = await requestWebPushPermission();
  return granted ? 'web-push-enabled' : null;
}

/**
 * Setup notification listeners — no-op for PWA (Supabase Realtime handles it)
 */
export function setupNotificationListeners(
  _onNotification?: (data: { title: string; body: string; link?: string }) => void
): void {
  // PWA notifications are handled via Supabase Realtime channel in NotificationBell
  // No Capacitor listeners needed
}
