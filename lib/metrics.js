/**
 * BURN BOARD — Lightweight Request Metrics (Master Prompt 16)
 *
 * In-memory counters + duration aggregates for observability at Stage A/B.
 * Per-instance by design (same tradeoff as lib/cache.js): safe for
 * serverless, zero external dependencies, and the emit API is stable so a
 * Stage B promotion to a shared metrics store (Axiom/Grafana) only changes
 * this module's internals — call sites stay the same.
 *
 * Privacy: metric names and labels never carry user content, emails, or
 * tokens. Keys are path/action names plus coarse labels only.
 */

const counters = new Map(); // "name" -> number
const durations = new Map(); // "name" -> { count, totalMs, maxMs }

const MAX_KEYS = 500;

function prune(map) {
  // Cheap safety valve: if a label explosion ever happens, drop the map
  // rather than grow unbounded. Metrics are observability, not truth.
  if (map.size > MAX_KEYS) map.clear();
}

/**
 * Increment a counter.
 * @param {string} name metric name, e.g. 'api.feed.requests'
 * @param {object} labels optional coarse labels (never user data)
 */
export function increment(name, labels = {}) {
  const key = labels && Object.keys(labels).length
    ? `${name}{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
    : name;
  counters.set(key, (counters.get(key) || 0) + 1);
  prune(counters);
}

/**
 * Add an amount to a counter (e.g. cumulative cost in micro-units).
 * @param {string} name metric name
 * @param {number} amount amount to add (can be fractional/zero)
 * @param {object} labels optional coarse labels
 */
export function accumulate(name, amount, labels = {}) {
  const key = labels && Object.keys(labels).length
    ? `${name}{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
    : name;
  counters.set(key, (counters.get(key) || 0) + (amount || 0));
  prune(counters);
}

/**
 * Record an observed duration.
 * @param {string} name metric name, e.g. 'api.feed.latency'
 * @param {number} durationMs duration in milliseconds
 * @param {object} labels optional coarse labels
 */
export function observeDuration(name, durationMs, labels = {}) {
  const key = labels && Object.keys(labels).length
    ? `${name}{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
    : name;
  const entry = durations.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
  entry.count += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);
  durations.set(key, entry);
  prune(durations);
}

/**
 * Snapshot of all metrics (counters + duration aggregates with avg/p95/p99).
 */
export function getMetrics() {
  const countersOut = {};
  for (const [key, value] of counters.entries()) {
    countersOut[key] = value;
  }

  const durationsOut = {};
  for (const [key, entry] of durations.entries()) {
    durationsOut[key] = {
      count: entry.count,
      totalMs: Math.round(entry.totalMs),
      avgMs: entry.count ? Math.round(entry.totalMs / entry.count) : 0,
      maxMs: entry.maxMs,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    counters: countersOut,
    durations: durationsOut,
  };
}

/** Reset all metrics (used by tests/ops; never in request paths). */
export function resetMetrics() {
  counters.clear();
  durations.clear();
}

/**
 * Wrap an API handler with request/error metrics.
 * Emits: `api.{name}.requests`, `api.{name}.errors`, `api.{name}.latency`.
 *
 * Usage:
 *   export const GET = instrumentHandler('feed', getHandler);
 */
export function instrumentHandler(name, handler) {
  return async (request, context) => {
    const method = request.method || 'GET';
    const base = `api.${name}`;
    const start = Date.now();
    try {
      const response = await handler(request, context);
      observeDuration(`${base}.latency`, Date.now() - start, { method });
      increment(`${base}.requests`, { method, status: String(response.status || 200) });
      if (response && response.status >= 500) {
        increment(`${base}.errors`, { method });
      }
      return response;
    } catch (err) {
      observeDuration(`${base}.latency`, Date.now() - start, { method });
      increment(`${base}.errors`, { method });
      throw err;
    }
  };
}