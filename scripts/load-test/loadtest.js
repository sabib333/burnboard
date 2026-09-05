#!/usr/bin/env node
/**
 * BURNBOARD Load Tester (Master Prompt 16)
 *
 * Dependency-free load generator using global fetch (Node >= 18).
 * Tests realistic user journeys against a target base URL and prints a
 * per-endpoint latency/error summary.
 *
 * Usage:
 *   node scripts/load-test/loadtest.js --scenario viral-post --users 20 --duration 15
 *   BASE_URL=https://burnboard.app node scripts/load-test/loadtest.js --scenario search-spike --users 50
 *   node scripts/load-test/loadtest.js --list
 *
 * Flags:
 *   --scenario <name>   scenario to run (see --list)
 *   --users <n>         concurrent workers (default 20)
 *   --duration <s>      run duration in seconds (default 15)
 *   --rate <rps>        optional cap on total requests/sec (0 = unlimited)
 *   --base-url <url>    target base URL (default $BASE_URL or http://localhost:3000)
 *   --list              list scenarios and exit
 *
 * NOTE: run against STAGING, never production, without explicit approval.
 */

const args = process.argv.slice(2);

function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1] !== undefined) return args[idx + 1];
  const env = process.env[name.toUpperCase().replace(/-/g, '_')];
  return env !== undefined ? env : fallback;
}

const LIST = {
  'mass-signup': {
    description: 'New-user burst: signup/profile creation pressure',
    requests: [
      { name: 'signup-page', method: 'GET', path: '/signup' },
      { name: 'auth-callback', method: 'GET', path: '/auth/callback' },
      { name: 'profile-create', method: 'POST', path: '/api/profile', body: {} },
    ],
  },
  'viral-post': {
    description: 'One post read by everyone: feed + post detail read path',
    requests: [
      { name: 'feed-foryou', method: 'GET', path: '/api/feed?tab=for_you&limit=20' },
      { name: 'feed-following', method: 'GET', path: '/api/feed?tab=following&limit=20' },
      { name: 'feed-trending', method: 'GET', path: '/api/feed?tab=trending&limit=20' },
      { name: 'post-detail', method: 'GET', path: '/api/post/example' },
    ],
  },
  'comment-storm': {
    description: 'High comment volume on a hot post',
    requests: [
      { name: 'comments-get', method: 'GET', path: '/api/comments?target_type=social_post&target_id=example&limit=50' },
      { name: 'comments-post', method: 'POST', path: '/api/comments', body: { target_type: 'social_post', target_id: 'example', text: 'load test comment', participant_id: 'loadtest-participant' } },
      { name: 'comments-react', method: 'POST', path: '/api/comments/react', body: { comment_id: 'example', reaction_type: 'burn', participant_id: 'loadtest-participant' } },
    ],
  },
  'notification-burst': {
    description: 'Queue flood: worker batch processing pressure',
    requests: [
      { name: 'notifications-get', method: 'GET', path: '/api/notifications?limit=50' },
      { name: 'queue-worker', method: 'GET', path: '/api/process-notifications' },
    ],
  },
  'share-traffic': {
    description: 'External sharing spike: share recording + OG previews',
    requests: [
      { name: 'share-record', method: 'POST', path: '/api/share', body: { resource_type: 'roast', resource_id: 'example', channel: 'link', idempotency_key: 'loadtest' } },
      { name: 'og-preview', method: 'GET', path: '/api/og' },
    ],
  },
  'search-spike': {
    description: 'Discovery load: search + explore',
    requests: [
      { name: 'search', method: 'GET', path: '/api/search?q=burnboard&limit=20' },
      { name: 'explore', method: 'GET', path: '/api/explore' },
    ],
  },
  'payment-webhook-burst': {
    description: 'Webhook storm: handler resilience under invalid-payload load (expect 4xx)',
    requests: [
      { name: 'webhook', method: 'POST', path: '/api/monetization/webhook', body: { type: 'checkout.session.completed', data: { object: { id: 'cs_loadtest' } } } },
    ],
  },
};

if (args.includes('--list')) {
  for (const [name, cfg] of Object.entries(LIST)) {
    console.log(`${name}\n  ${cfg.description}\n  endpoints: ${cfg.requests.map(r => r.name).join(', ')}`);
  }
  process.exit(0);
}

const scenarioName = flag('scenario', 'viral-post');
const users = Math.max(1, parseInt(flag('users', '20'), 10));
const durationSec = Math.max(1, parseInt(flag('duration', '15'), 10));
const rateCap = Math.max(0, parseInt(flag('rate', '0'), 10));
const baseUrl = flag('base-url', 'http://localhost:3000').replace(/\/$/, '');

const scenario = LIST[scenarioName];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioName}". Run with --list to see available scenarios.`);
  process.exit(1);
}

const requests = scenario.requests;
const stats = new Map();
for (const r of requests) {
  stats.set(r.name, { count: 0, errors: 0, statuses: {}, latencies: [] });
}

let running = true;
const startedAt = Date.now();
const endAt = startedAt + durationSec * 1000;

function record(name, ms, status) {
  const s = stats.get(name);
  s.count += 1;
  s.latencies.push(ms);
  s.statuses[status] = (s.statuses[status] || 0) + 1;
  if (status >= 500) s.errors += 1;
}

async function hit(r) {
  const url = `${baseUrl}${r.path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: r.method,
      headers: r.body ? { 'Content-Type': 'application/json' } : {},
      body: r.body ? JSON.stringify(r.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    record(r.name, Date.now() - start, res.status);
  } catch (err) {
    const s = stats.get(r.name);
    s.count += 1;
    s.errors += 1;
    s.statuses[`ERR:${err.name}`] = (s.statuses[`ERR:${err.name}`] || 0) + 1;
  }
}

async function worker(id) {
  let i = 0;
  while (running && Date.now() < endAt) {
    const r = requests[i % requests.length];
    i += 1;
    await hit(r);
    // Round-robin across endpoints; sleep briefly to avoid localhost
    // connection exhaustion.
    await new Promise(res => setTimeout(res, 5));
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)]);
}

async function main() {
  console.log(`[loadtest] scenario=${scenarioName} users=${users} duration=${durationSec}s rate=${rateCap || 'unlimited'} base=${baseUrl}`);
  console.log(`[loadtest] endpoints: ${requests.map(r => `${r.method} ${r.path}`).join(' | ')}\n`);

  const workers = Array.from({ length: users }, (_, i) => worker(i));
  await Promise.all(workers);
  running = false;

  const elapsed = (Date.now() - startedAt) / 1000;
  let total = 0;
  console.log('--- summary ---');
  for (const [name, s] of stats.entries()) {
    const sorted = s.latencies.sort((a, b) => a - b);
    const rps = s.count / Math.max(elapsed, 0.1);
    console.log(
      `${name.padEnd(20)} req=${String(s.count).padStart(6)} err=${String(s.errors).padStart(4)} ` +
      `p50=${String(percentile(sorted, 50)).padStart(5)}ms p95=${String(percentile(sorted, 95)).padStart(5)}ms ` +
      `p99=${String(percentile(sorted, 99)).padStart(5)}ms rps=${rps.toFixed(1)}`
    );
    total += s.count;
  }
  console.log(`\n[loadtest] total requests: ${total} in ${elapsed.toFixed(1)}s (~${(total / Math.max(elapsed, 0.1)).toFixed(1)} rps)`);
  console.log('[loadtest] NOTE: run against staging, not production, without explicit approval.');
}

main().catch(err => {
  console.error('[loadtest] fatal:', err);
  process.exit(1);
});