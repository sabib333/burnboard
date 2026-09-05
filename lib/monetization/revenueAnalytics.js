/**
 * BURNBOARD Monetization — Revenue Analytics & Financial Observability
 * (Master Prompt 19)
 *
 * Aggregate, ledger-derived analytics. NO user-level data ever leaves the
 * database — everything is summed by day / product type / payout state.
 *
 *   computeRevenueSnapshot()  → compute_revenue_snapshot RPC (one pass over
 *                               the ledger)
 *   saveRevenueSnapshot()     → idempotent per-day persistence
 *   captureDailySnapshot()    → compute + persist (daily cron)
 *   getRevenueHistory()       → recent snapshots for dashboards
 *   getFinancialObservability() → drift/health summary (admin only)
 *
 * Every function degrades to a safe "unavailable" result when the migration
 * hasn't been applied or the backend is unreachable.
 */

/**
 * Compute today's revenue snapshot from the ledger (aggregate only).
 */
export async function computeRevenueSnapshot(client) {
  if (!client) return { available: false };
  try {
    const { data, error } = await client.rpc('compute_revenue_snapshot');
    if (error || !data) return { available: false };
    return { available: true, snapshot: data };
  } catch (err) {
    console.warn('[Monetization] Revenue snapshot compute failed:', err?.message || err);
    return { available: false };
  }
}

/**
 * Persist a snapshot idempotently (one row per day, overwrite-safe).
 */
export async function saveRevenueSnapshot(client, snapshot) {
  if (!client || !snapshot) return { ok: false };
  try {
    const { error } = await client.rpc('save_revenue_snapshot', { p_data: snapshot });
    if (error) return { ok: false };
    return { ok: true };
  } catch (err) {
    console.warn('[Monetization] Revenue snapshot save failed:', err?.message || err);
    return { ok: false };
  }
}

/**
 * Daily cron entry: compute + persist. Idempotent; failure-safe (returns
 * result object, never throws into the cron pipeline).
 */
export async function captureDailyRevenueSnapshot(client) {
  const computed = await computeRevenueSnapshot(client);
  if (!computed.available) return { ok: false, reason: 'unavailable' };

  const saved = await saveRevenueSnapshot(client, computed.snapshot);
  return {
    ok: saved.ok,
    generatedAt: computed.snapshot?.generated_at || null,
    totalsDays: computed.snapshot?.totals?.length || 0,
  };
}

/**
 * Fetch recent daily snapshots for the dashboard (newest first).
 */
export async function getRevenueHistory(client, days = 30) {
  if (!client) return { available: false, snapshots: [] };
  try {
    const { data, error } = await client
      .from('monetization_revenue_snapshots')
      .select('snapshot_date, data, created_at')
      .order('snapshot_date', { ascending: false })
      .limit(days);
    if (error) return { available: false, snapshots: [] };
    return { available: true, snapshots: data || [] };
  } catch (err) {
    console.warn('[Monetization] Revenue history failed:', err?.message || err);
    return { available: false, snapshots: [] };
  }
}

/**
 * Financial observability summary: entitlement drift, stuck webhook events,
 * failed events, pending payouts, audit volume. Admin/service-role only.
 */
export async function getFinancialObservability(client) {
  if (!client) return { available: false, checks: [] };
  try {
    const { data, error } = await client.rpc('financial_observability');
    if (error || !data) return { available: false, checks: [] };
    return { available: true, checks: data };
  } catch (err) {
    console.warn('[Monetization] Observability failed:', err?.message || err);
    return { available: false, checks: [] };
  }
}