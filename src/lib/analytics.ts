/**
 * BURNBOARD Analytics Engine (Zero-Cost LocalStorage + Vercel Events)
 */

export interface AnalyticsEvent {
  event: 'profile_submitted' | 'roast_submitted' | 'upvote_clicked' | 'reaction_clicked' | 'battle_voted' | 'share_clicked' | 'page_view' | 'profile_viewed' | 'ad_clicked' | 'notification_subscribed';
  data?: Record<string, any>;
  timestamp: string;
}

const STORAGE_KEY = 'burnboard_analytics_events';

export function track(event: AnalyticsEvent['event'], data?: Record<string, any>): void {
  const payload: AnalyticsEvent = {
    event,
    data: data || {},
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`[BURNBOARD Analytics] 🔥 Event: ${event}`, data);
    
    // Persist in localStorage for admin viewing
    if (typeof window !== 'undefined') {
      const existingStr = localStorage.getItem(STORAGE_KEY);
      const existing: AnalyticsEvent[] = existingStr ? JSON.parse(existingStr) : [];
      existing.unshift(payload);
      // Keep up to 200 recent events
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 200)));
    }
  } catch (err) {
    console.warn('Analytics tracking error:', err);
  }
}

export function getAnalyticsEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAnalyticsSummary(): { totalEvents: number; countsByEvent: Record<string, number> } {
  const events = getAnalyticsEvents();
  const countsByEvent: Record<string, number> = {};
  for (const ev of events) {
    countsByEvent[ev.event] = (countsByEvent[ev.event] || 0) + 1;
  }
  return {
    totalEvents: events.length,
    countsByEvent,
  };
}
