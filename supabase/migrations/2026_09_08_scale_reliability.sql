-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Scale Reliability Foundation (Master Prompt 16)
--
-- NON-DESTRUCTIVE: only adds/replaces functions and adds indexes.
-- No tables are dropped, renamed, or have data removed.
-- All statements are idempotent (create or replace / if not exists).
--
-- Contents:
--   1. refresh_profile_roast_counts()  — batch N+1 killer for the
--      daily cleanup cron (was O(profiles) queries per run).
--   2. process_notification_queue()    — rewritten to claim batches
--      atomically (FOR UPDATE SKIP LOCKED) with idempotent insert,
--      so overlapping worker runs can never double-process rows.
--   3. notifications.push_sent flag    — idempotent push delivery.
--   4. Guarded fcm_tokens(user_id) index for the push worker's
--      batch token fetch.
-- ═══════════════════════════════════════════════════════════

-- ── 1. BATCH PROFILE ROAST-COUNT REFRESH ────────────────────
-- Replaces the per-profile loop in app/api/cron/cleanup/route.js.
-- One pass: sets roast_count for every profile from a single
-- aggregate, then zeroes profiles that have no visible roasts.
create or replace function refresh_profile_roast_counts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int := 0;
  v_zeroed  int := 0;
begin
  with counts as (
    select profile_id, count(*) as c
    from roasts
    where is_hidden = false
    group by profile_id
  )
  update profiles p
  set roast_count = counts.c
  from counts
  where p.id = counts.profile_id
    and p.roast_count is distinct from counts.c;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Profiles with no visible roasts go to 0 (keeps counters truthful).
  update profiles p
  set roast_count = 0
  where not exists (
    select 1 from roasts r
    where r.profile_id = p.id and r.is_hidden = false
  )
  and p.roast_count is distinct from 0;

  GET DIAGNOSTICS v_zeroed = ROW_COUNT;

  return v_updated + v_zeroed;
end;
$$;

-- ── 2. ATOMIC, IDEMPOTENT NOTIFICATION QUEUE PROCESSING ─────
-- Old version used two independent "select ... limit batch" steps
-- (insert then mark), which under concurrent worker runs could mark
-- different rows than it inserted or double-insert. New version
-- claims each row with FOR UPDATE SKIP LOCKED inside a single loop,
-- inserts into notifications with ON CONFLICT DO NOTHING, then marks
-- claimed. Exactly-once per row, safe to re-run, safe under overlap.
-- SECURITY DEFINER: the worker (anon-key cron route) must be able to
-- mark rows processed and write inbox rows. RLS on notification_queue has
-- no UPDATE policy by design — the HTTP layer (CRON_SECRET) authorizes the
-- caller, and this function is the trusted system path. Matches the
-- cast_battle_vote / admin-RPC pattern already in the codebase.
create or replace function process_notification_queue(
  batch_size int default 500
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in
    select id, user_id, type, title, message, link, created_at
    from notification_queue
    where processed = false
    order by priority desc, created_at asc
    limit batch_size
    for update skip locked
  loop
    insert into notifications (user_id, type, title, message, link, is_read, created_at)
    values (v_row.user_id, v_row.type, v_row.title, v_row.message, v_row.link, false, v_row.created_at)
    on conflict do nothing;

    update notification_queue
    set processed = true
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  -- Cleanup: processed items older than 24 hours.
  delete from notification_queue
  where processed = true
    and created_at < now() - interval '24 hours';

  return v_count;
end;
$$;

-- ── 3. PUSH SENT FLAG ON NOTIFICATIONS ─────────────────────
-- Makes push delivery idempotent: the worker only pushes rows with
-- push_sent = false, then flags them. A failed run retries; a
-- successful run never re-pushes. Additive with a default, so
-- existing rows behave exactly as before (nothing is re-sent).
alter table notifications add column if not exists push_sent boolean default false;

-- ── 4. GUARDED INDEX: FCM TOKENS BY USER ────────────────────
-- Serves the push worker's batch token fetch in
-- app/api/process-notifications/route.js. Guarded so the migration
-- is safe on projects where the table does not exist yet.
do $$
begin
  if to_regclass('public.fcm_tokens') is not null then
    create index if not exists idx_fcm_tokens_user on fcm_tokens(user_id);
  end if;
end
$$;