-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Growth Analytics Foundation (Master Prompt 18)
--
-- NON-DESTRUCTIVE: only adds a column, a table, indexes, RLS and RPCs.
--
-- Contents:
--   1. user_profiles.locale — coarse user language/region signal captured
--      server-side at signup (Accept-Language), used for regional analytics
--      and future locale-aware product behavior. Never precise location.
--   2. growth_daily_snapshot — durable daily aggregates (signups, DAU/WAU,
--      activation, cohort retention D1/D7/D30, referrals, network density,
--      creators, communities, regions). Computed by lib/growth/analytics.js
--      and persisted by the daily cleanup cron; history enables cohort
--      analysis without re-computation.
--   3. RPCs — save/get/cleanup snapshots (system-only, SECURITY DEFINER).
-- ═══════════════════════════════════════════════════════════

-- ── 1. USER LOCALE ──────────────────────────────────────────
alter table user_profiles add column if not exists locale text;

-- ── 2. DAILY GROWTH SNAPSHOT ────────────────────────────────
create table if not exists growth_daily_snapshot (
  snapshot_date date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_snapshot_created on growth_daily_snapshot(created_at desc);

alter table growth_daily_snapshot enable row level security;
do $$ begin
  create policy "System writes growth snapshots" on growth_daily_snapshot
    for all using (false) with check (false);
exception when duplicate_object then null;
end $$;

-- ── 3. RPCs ─────────────────────────────────────────────────

-- Upsert today's snapshot (idempotent per date).
create or replace function save_growth_snapshot(
  p_date date,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into growth_daily_snapshot (snapshot_date, data, created_at)
  values (p_date, p_data, now())
  on conflict (snapshot_date) do update
  set data = excluded.data, created_at = now();
end;
$$;

-- Read the last N snapshots (oldest first) for cohort history.
create or replace function get_growth_snapshots(p_days int default 90)
returns setof growth_daily_snapshot
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select * from growth_daily_snapshot
    where snapshot_date >= current_date - p_days
    order by snapshot_date asc;
end;
$$;

-- Retention: keep 400 days of snapshots (~13 months of cohort history).
create or replace function cleanup_growth_snapshots()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
begin
  delete from growth_daily_snapshot
  where snapshot_date < current_date - 400;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  return v_deleted;
end;
$$;

-- ── 4. SNAPSHOT COMPUTATION (all metrics from real tables) ──
-- Single aggregate pass over real platform data. No fabricated numbers:
--   * signups        → auth.users
--   * active users   → rec_events (server-validated activity log)
--   * activation     → strong rec_events (follow/join/react/comment/share/
--                      participate/vote) OR social_posts created
--   * cohorts        → weekly signup cohorts with D1/D7/D30 return
--   * referral       → referral_visits / converted_at
--   * network        → follows per active user
--   * creators       → social_posts + roasts authors
--   * communities    → community_members + community posts
--   * regions        → user_profiles.locale (coarse, signup-time only)
create or replace function compute_growth_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_signups_total int; v_signups_7d int; v_signups_30d int;
  v_dau int; v_wau int; v_mau int;
  v_activated_7d int;
  v_ref_visits_7d int; v_ref_conversions_7d int; v_ref_activated_7d int;
  v_follows_total int;
  v_creators_7d int;
  v_communities_total int; v_communities_new_7d int; v_communities_active_7d int;
  v_recent_daily int; v_baseline_daily int;
begin
  -- Signups
  select count(*) into v_signups_total from auth.users;
  select count(*) into v_signups_7d from auth.users where created_at >= now() - interval '7 days';
  select count(*) into v_signups_30d from auth.users where created_at >= now() - interval '30 days';

  -- Active users (server-validated activity only)
  select count(distinct user_id) into v_dau from rec_events
    where created_at >= now() - interval '1 day' and user_id is not null;
  select count(distinct user_id) into v_wau from rec_events
    where created_at >= now() - interval '7 days' and user_id is not null;
  select count(distinct user_id) into v_mau from rec_events
    where created_at >= now() - interval '30 days' and user_id is not null;

  -- Activation: strong first-value events in the last 7 days
  select count(distinct user_id) into v_activated_7d from rec_events
  where created_at >= now() - interval '7 days'
    and user_id is not null
    and event_type in ('user_followed', 'community_joined', 'content_reacted',
                       'content_commented', 'content_shared', 'challenge_participated',
                       'battle_voted');

  -- Referral quality (real visit/conversion rows)
  select count(*) into v_ref_visits_7d from referral_visits where created_at >= now() - interval '7 days';
  select count(*) into v_ref_conversions_7d from referral_visits where converted_at >= now() - interval '7 days';
  select count(distinct rv.converted_user_id) into v_ref_activated_7d
  from referral_visits rv
  where rv.converted_at >= now() - interval '7 days'
    and rv.converted_user_id is not null
    and exists (
      select 1 from rec_events e
      where e.user_id = rv.converted_user_id
        and e.created_at between rv.converted_at and rv.converted_at + interval '7 days'
    );

  -- Network density
  select count(*) into v_follows_total from follows;

  -- Creators: distinct authors with content in the last 7 days
  select count(distinct user_id) into v_creators_7d from social_posts
    where created_at >= now() - interval '7 days' and user_id is not null;

  -- Communities
  select count(*) into v_communities_total from communities;
  select count(*) into v_communities_new_7d from communities where created_at >= now() - interval '7 days';
  select count(distinct community_id) into v_communities_active_7d from social_posts
    where created_at >= now() - interval '7 days' and community_id is not null;

  -- Anomaly: signup spike (last 7d avg per day vs previous 21d baseline)
  select coalesce(round(avg(d.c)::numeric, 1), 0) into v_recent_daily from (
    select count(*) as c from auth.users
    where created_at >= now() - interval '7 days'
    group by date_trunc('day', created_at)
  ) d;
  select coalesce(round(avg(d.c)::numeric, 1), 0) into v_baseline_daily from (
    select count(*) as c from auth.users
    where created_at >= now() - interval '28 days'
      and created_at < now() - interval '7 days'
    group by date_trunc('day', created_at)
  ) d;

  -- Cohort retention: weekly signup cohorts, last 12 weeks
  select coalesce(jsonb_agg(row_to_jsonb(c) order by c.cohort), '[]'::jsonb) into v
  from (
    with cohort_users as (
      select date_trunc('week', created_at)::date as cohort,
             id as uid,
             created_at as signed_at
      from auth.users
      where created_at >= date_trunc('week', now()) - interval '11 weeks'
    )
    select cohort,
           count(*) as size,
           round(100.0 * count(*) filter (where exists (
             select 1 from rec_events e
             where e.user_id = cohort_users.uid
               and e.created_at between signed_at and signed_at + interval '1 day'))
             / nullif(count(*), 0), 1) as d1_pct,
           round(100.0 * count(*) filter (where exists (
             select 1 from rec_events e
             where e.user_id = cohort_users.uid
               and e.created_at between signed_at and signed_at + interval '7 days'))
             / nullif(count(*), 0), 1) as d7_pct,
           round(100.0 * count(*) filter (where exists (
             select 1 from rec_events e
             where e.user_id = cohort_users.uid
               and e.created_at between signed_at and signed_at + interval '30 days'))
             / nullif(count(*), 0), 1) as d30_pct
    from cohort_users
    group by cohort
  ) c;

  return jsonb_build_object(
    'generatedAt', now()::text,
    'signups', jsonb_build_object('total', v_signups_total, 'last7d', v_signups_7d, 'last30d', v_signups_30d),
    'active', jsonb_build_object('dau', v_dau, 'wau', v_wau, 'mau', v_mau,
      'dauMauPct', round(100.0 * v_dau / nullif(v_mau, 0), 1)),
    'activation', jsonb_build_object('activated7d', v_activated_7d,
      'activationRatePct', round(100.0 * v_activated_7d / nullif(v_signups_7d, 0), 1)),
    'cohorts', v,
    'referral', jsonb_build_object('visits7d', v_ref_visits_7d, 'conversions7d', v_ref_conversions_7d,
      'conversionRatePct', round(100.0 * v_ref_conversions_7d / nullif(v_ref_visits_7d, 0), 1),
      'activatedConverted7d', v_ref_activated_7d),
    'network', jsonb_build_object('totalFollows', v_follows_total,
      'followsPerActiveUser', round(v_follows_total::numeric / nullif(v_mau, 0), 2),
      'activeUsers30d', v_mau),
    'creators', jsonb_build_object('active7d', v_creators_7d),
    'communities', jsonb_build_object('total', v_communities_total, 'new7d', v_communities_new_7d, 'active7d', v_communities_active_7d),
    'regions', coalesce((
      select jsonb_agg(row_to_jsonb(r) order by r.users desc) from (
        select coalesce(locale, 'unknown') as locale,
               count(*) as users
        from user_profiles
        group by coalesce(locale, 'unknown')
      ) r
    ), '[]'::jsonb),
    'anomalies', jsonb_build_array(
      case when v_recent_daily > 0 and v_baseline_daily > 0 and v_recent_daily > 3 * v_baseline_daily
        then jsonb_build_object('type', 'signup_spike', 'level', 'warn',
          'detail', 'Signups (' || v_recent_daily || '/day avg) are ' ||
          round((v_recent_daily / v_baseline_daily)::numeric, 1) || 'x the 21-day baseline (' || v_baseline_daily || '/day). Verify it is real traffic, not bots.')
        else jsonb_build_object('type', 'signup_spike', 'level', 'info',
          'detail', 'Signup rate within normal range.') end
    )
  );
end;
$$;