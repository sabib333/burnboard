/**
 * BURNBOARD — Growth Analytics Service (Master Prompt 18)
 *
 * Computes the global growth snapshot (North Star + funnel + cohorts +
 * referral quality + network density + regions) from REAL platform tables.
 * The heavy math lives in the SECURITY DEFINER RPC `compute_growth_snapshot`
 * (SQL-side COUNT(DISTINCT) + index-backed cohort retention) — this module
 * only orchestrates: compute → persist daily → read history.
 *
 * Privacy: aggregate-only. No user-level data ever leaves the RPC as rows;
 * the snapshot is numbers. Regions are coarse signup-time locales, never
 * precise location.
 */

const SNAPSHOT_HISTORY_DAYS = 90;

/**
 * Compute a fresh growth snapshot (aggregate jsonb from real tables).
 * Returns null on failure — dashboards degrade to "no data", never lie.
 */
export async function computeGrowthSnapshot(client) {
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('compute_growth_snapshot');
    if (error || !data) {
      console.error('[Growth Analytics] compute failed:', error?.message || 'no data');
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Growth Analytics] compute error:', err?.message || err);
    return null;
  }
}

/**
 * Compute and persist today's snapshot (idempotent per date) + retention
 * cleanup. Called by the daily cleanup cron.
 */
export async function captureDailySnapshot(client) {
  if (!client) return { captured: false };
  const snapshot = await computeGrowthSnapshot(client);
  if (!snapshot) return { captured: false };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await client.rpc('save_growth_snapshot', {
    p_date: today,
    p_data: JSON.stringify(snapshot),
  });
  await client.rpc('cleanup_growth_snapshots').catch(() => {});

  return { captured: !error, date: today, error: error?.message || null };
}

/**
 * Fetch snapshot history (oldest first) for cohort analysis.
 */
export async function fetchSnapshotHistory(client, days = SNAPSHOT_HISTORY_DAYS) {
  if (!client) return [];
  try {
    const { data, error } = await client.rpc('get_growth_snapshots', {
      p_days: Math.min(Math.max(days, 7), 400),
    });
    if (error || !data) return [];
    return data.map((row) => ({
      date: row.snapshot_date,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[Growth Analytics] history failed:', err?.message || err);
    return [];
  }
}

/**
 * Merge current snapshot + history into one dashboard payload.
 */
export async function buildGrowthDashboard(client, { days = 30 } = {}) {
  const snapshot = await computeGrowthSnapshot(client);
  const history = await fetchSnapshotHistory(client, days);
  return { snapshot, history, generatedAt: new Date().toISOString() };
}