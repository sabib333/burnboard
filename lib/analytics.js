// BURNBOARD Analytics Engine (Zero-Cost LocalStorage + Vercel Events)

const STORAGE_KEY = 'burnboard_analytics_events';

export function track(event, data = {}) {
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`[BURNBOARD Analytics] 🔥 Event: ${event}`, data);
    
    if (typeof window !== 'undefined') {
      const existingStr = localStorage.getItem(STORAGE_KEY);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.unshift(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 200)));
    }
  } catch (err) {
    console.warn('Analytics tracking error:', err);
  }
}

export function getAnalyticsEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
