-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Growth Engine (Master Prompt 23)
-- Referral Rewards, Viral-Loop Measurement & Growth Alerts data layer
--
-- NON-DESTRUCTIVE: only adds a table, indexes, RLS policies and RPCs.
-- Does NOT modify, rename, or delete any existing data or table.
--
-- What this adds:
--   1. referral_rewards — durable ledger of rewards granted to referrers.
--      Rewards are ONLY granted for ACTIVATED referrals (strong first-value
--      activity within 7 days of conversion), never for raw signups.
--      Idempotent per referral visit (unique constraint), monthly cap,
--      self-referral-proof (inherited from claim_referral_by_token).
--   2. grant_eligible_referral_rewards(referrer) — core grant logic used by
--      both the per-user sync and the service-role daily sweep.
--   3. sync_referral_rewards(p_user) — on-demand, owner-scoped (auth.uid()
--      must equal p_user); called when a user opens their invite page.
--   4. sweep_referral_rewards() — service-role-only daily sweep from the
--      cleanup cron; executes the same idempotent grant logic for everyone.
--   5. get_referral_summary(p_user) — owner-scoped invite-page stats
--      (visits, conversions, activated conversions, karma earned, recent
--      rewards). Aggregate-ish; only ever exposes the viewer's own data.
--   6. compute_growth_snapshot() EXTENDED with viral-loop metrics:
--      shares 7d (+ top channels) and K-factor estimate (conversions per
--      inviting user, 7d) — the viral coefficient as a direction indicator.
--
-- Principles:
--   * Rewards follow REAL value: a referred user must activate (not just
--     register) for the referrer to earn anything.
--   * No fake accounts, no raw-signup rewards, no invite-spam incentives.
--   * All writes go through SECURITY DEFINER functions — clients can never
--     forge rewards. Grants are idempotent and capped.
--   * Privacy: reward rows only expose the referrer's own data; the sweep
--     never returns user-level data.
-- ═══════════════════════════════════════════════════════════

-- ── 1. REFERRAL REWARDS LEDGER ─────────────────────────────
create table if not exists referral_rewards (
  id bigint generated always as identity primary key,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referral_visit_id uuid not null references referral_visits(id) on delete cascade unique,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null default 'karma',
  reward_amount int not null default 50,
  status text not null default 'granted',
  granted_at timestamptz not null default now()
);

create index if not exists idx_referral_rewards_referrer
  on referral_rewards(referrer_user_id, granted_at desc);
create index if not exists idx_referral_rewards_visit
  on referral_rewards(referral_visit_id);

alter table referral_rewards enable row level security;
-- Owners may read their own rewards; writes are exclusively via the
-- SECURITY DEFINER functions below (clients can never insert a reward row).
do $$ begin
  create policy "Owners read their referral rewards" on referral_rewards
    for select using (auth.uid() = referrer_user_id);
exception when duplicate_object then null;
end $$;

-- ── 2. CORE GRANT LOGIC (used by sync + sweep) ─────────────
-- Reward configuration — deliberately modest and transparent:
--   * 50 karma per ACTIVATED referral (same order of magnitude as content
--     creation rep, so invites are never the dominant karma source).
--   * Monthly cap of 10 grants per referrer (kills farming; keeps the
--     incentive honest).
--   * A conversion becomes grantable only after its 7-day activation window
--     has closed, and stays eligible for 30 days.
--   * Activation = the same definition the growth snapshot uses: a strong
--     rec_event (follow / join community / react / comment / share /
--     participate / vote) OR created content within 7 days of conversion.
create or replace function grant_eligible_referral_rewards(p_referrer uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c_reward_karma constant int := 50;
  c_monthly_cap constant int := 10;
  v_visit record;
  v_activated boolean;
  v_monthly int;
  v_granted int := 0;
begin
  if p_referrer is null then
    return 0;
  end if;

  select count(*) into v_monthly
    from referral_rewards
    where referrer_user_id = p_referrer
      and granted_at >= date_trunc('month', now());
  if v_monthly >= c_monthly_cap then
    return 0;
  end if;

  for v_visit in
    select rv.id, rv.converted_at, rv.converted_user_id
      from referral_visits rv
      where rv.referrer_user_id = p_referrer
        and rv.converted_at is not null
        and rv.converted_user_id is not null
        -- activation window has closed → outcome is known
        and rv.converted_at <= now() - interval '7 days'
        -- still recent enough to reward
        and rv.converted_at >= now() - interval '30 days'
        -- idempotent: never twice per visit
        and not exists (
          select 1 from referral_rewards rr
          where rr.referral_visit_id = rv.id
        )
      order by rv.converted_at asc
      limit (c_monthly_cap - v_monthly)
  loop
    -- Activation check (mirrors compute_growth_snapshot): strong first-value
    -- activity or created content within 7 days of conversion.
    select (
      exists (
        select 1 from rec_events e
        where e.user_id = v_visit.converted_user_id
          and e.created_at between v_visit.converted_at
            and v_visit.converted_at + interval '7 days'
          and e.event_type in ('user_followed', 'community_joined',
                               'content_reacted', 'content_commented',
                               'content_shared', 'challenge_participated',
                               'battle_voted')
      ) or exists (
        select 1 from social_posts sp
        where sp.user_id = v_visit.converted_user_id
          and sp.created_at between v_visit.converted_at
            and v_visit.converted_at + interval '7 days'
      )
    ) into v_activated;

    if not v_activated then
      continue;
    end if;

    insert into referral_rewards
      (referrer_user_id, referral_visit_id, referred_user_id,
       reward_type, reward_amount)
    values
      (p_referrer, v_visit.id, v_visit.converted_user_id,
       'karma', c_reward_karma)
    on conflict (referral_visit_id) do nothing;

    if found then
      -- Credit karma + refresh level (level names mirror lib/reputation/config.js).
      update user_profiles
        set karma = karma + c_reward_karma,
            level = case
              when karma + c_reward_karma >= 15000 then 'Legend'
              when karma + c_reward_karma >= 5000  then 'Supernova'
              when karma + c_reward_karma >= 1500  then 'Inferno'
              when karma + c_reward_karma >= 500   then 'Blaze'
              when karma + c_reward_karma >= 200   then 'Flame'
              when karma + c_reward_karma >= 50    then 'Ember'
              else 'Spark'
            end
        where id = p_referrer;

      v_granted := v_granted + 1;
      v_monthly := v_monthly + 1;
      if v_monthly >= c_monthly_cap then
        exit;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

revoke all on function grant_eligible_referral_rewards(uuid) from public;

-- ── 3. ON-DEMAND, OWNER-SCOPED SYNC ────────────────────────
-- Called when a user opens their invite page. auth.uid() must equal the
-- requested user; returns -1 when the caller is not the owner.
create or replace function sync_referral_rewards(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or auth.uid() is null or auth.uid() <> p_user then
    return -1;
  end if;
  return grant_eligible_referral_rewards(p_user);
end;
$$;

revoke all on function sync_referral_rewards(uuid) from public;
grant execute on function sync_referral_rewards(uuid) to authenticated;

-- ── 4. SERVICE-ROLE DAILY SWEEP ────────────────────────────
-- Runs from the cleanup cron with the service-role key. Anon and
-- authenticated users are explicitly blocked; the sweep only ever grants
-- rewards that the idempotent, capped core logic would grant anyway.
create or replace function sweep_referral_rewards()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid;
  v_total int := 0;
begin
  for v_ref in
    select distinct rv.referrer_user_id
      from referral_visits rv
      where rv.converted_at is not null
        and rv.converted_at <= now() - interval '7 days'
        and rv.converted_at >= now() - interval '30 days'
        and not exists (
          select 1 from referral_rewards rr
          where rr.referrer_user_id = rv.referrer_user_id
            and rr.referral_visit_id = rv.id
        )
  loop
    v_total := v_total + grant_eligible_referral_rewards(v_ref);
  end loop;
  return v_total;
end;
$$;

revoke all on function sweep_referral_rewards() from public;
grant execute on function sweep_referral_rewards() to service_role;

-- ── 5. INVITE-PAGE SUMMARY (owner-scoped) ──────────────────
create or replace function get_referral_summary(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_visits int; v_conversions int; v_activated int; v_pending int;
  v_rewards int; v_karma int;
  v_recent jsonb;
begin
  if p_user is null or auth.uid() is null or auth.uid() <> p_user then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select code into v_code
    from referral_codes
    where user_id = p_user and active = true
    limit 1;

  select count(*) into v_visits
    from referral_visits where referrer_user_id = p_user;
  select count(*) into v_conversions
    from referral_visits
    where referrer_user_id = p_user and converted_at is not null;
  select count(*) into v_activated
    from referral_visits rv
    where rv.referrer_user_id = p_user
      and rv.converted_at is not null
      and (
        exists (
          select 1 from rec_events e
          where e.user_id = rv.converted_user_id
            and e.created_at between rv.converted_at
              and rv.converted_at + interval '7 days'
            and e.event_type in ('user_followed', 'community_joined',
                                 'content_reacted', 'content_commented',
                                 'content_shared', 'challenge_participated',
                                 'battle_voted')
        ) or exists (
          select 1 from social_posts sp
          where sp.user_id = rv.converted_user_id
            and sp.created_at between rv.converted_at
              and rv.converted_at + interval '7 days'
        )
      );
  select count(*) into v_pending
    from referral_visits
    where referrer_user_id = p_user
      and converted_at is not null
      and converted_at > now() - interval '7 days';

  select count(*) into v_rewards
    from referral_rewards where referrer_user_id = p_user;
  select coalesce(sum(reward_amount), 0) into v_karma
    from referral_rewards where referrer_user_id = p_user;

  select coalesce(jsonb_agg(row_to_jsonb(r) order by r.granted_at desc), '[]'::jsonb)
    into v_recent
    from (
      select rr.reward_type, rr.reward_amount, rr.granted_at,
             up.username as referred_username
        from referral_rewards rr
        left join user_profiles up on up.id = rr.referred_user_id
        where rr.referrer_user_id = p_user
        limit 10
    ) r;

  return jsonb_build_object(
    'code', v_code,
    'visits', coalesce(v_visits, 0),
    'conversions', coalesce(v_conversions, 0),
    'activatedConversions', coalesce(v_activated, 0),
    'pendingConversions', coalesce(v_pending, 0),
    'rewardsGranted', coalesce(v_rewards, 0),
    'karmaEarned', coalesce(v_karma, 0),
    'recent', v_recent
  );
end;
$$;

revoke all on function get_referral_summary(uuid) from public;
grant execute on function get_referral_summary(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 6. GROWTH SNAPSHOT EXTENSION — viral-loop measurement
--    Adds to compute_growth_snapshot():
--      shares.total7d + shares.byChannel   (share funnel, last 7 days)
--      virality.invitingUsers7d            (referrers with a converted visit)
--      virality.kFactorEstimate            (conversions / inviting users)
--    The K-factor is explicitly a DIRECTION INDICATOR, not a vanity number:
--    it is only meaningful alongside activation + retention cohorts, and the
--    admin dashboard never presents it as the sole success metric.
-- ═══════════════════════════════════════════════════════════
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
  v_shares_7d int; v_inviting_7d int; v_kfactor numeric;
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

  -- Share funnel (real share events, last 7 days)
  select count(*) into v_shares_7d from shares
    where created_at >= now() - interval '7 days';

  -- Viral coefficient (direction indicator): conversions per inviting user
  select count(distinct referrer_user_id) into v_inviting_7d from referral_visits
    where converted_at >= now() - interval '7 days';
  v_kfactor := case when v_inviting_7d > 0
    then round(v_ref_conversions_7d::numeric / v_inviting_7d, 2)
    else 0 end;

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
    'shares', jsonb_build_object('total7d', v_shares_7d, 'byChannel', coalesce((
      select jsonb_agg(row_to_jsonb(c) order by c.cnt desc) from (
        select channel, count(*) as cnt from shares
        where created_at >= now() - interval '7 days'
        group by channel
      ) c
    ), '[]'::jsonb)),
    'virality', jsonb_build_object('invitingUsers7d', v_inviting_7d,
      'kFactorEstimate', v_kfactor),
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
          round((v_recent_daily / v_baseline_daily)::numeric, 1) || 'x the 21-day baseline (' ||
          v_baseline_daily || '/day). Verify it is real traffic, not bots.')
        else jsonb_build_object('type', 'signup_spike', 'level', 'info',
          'detail', 'Signup rate within normal range.') end
    )
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- DONE — Growth Engine (Master Prompt 23) schema created (additive only)
-- ═══════════════════════════════════════════════════════════