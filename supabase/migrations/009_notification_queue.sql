-- BURNBOARD Batch Notification Queue for 1M Scale
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. NOTIFICATION QUEUE TABLE
-- ============================================================
-- Notifications are enqueued here, then batch-processed
-- This avoids N individual INSERTs when 1M users are active
create table if not exists notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  link text,
  priority int default 0, -- higher = processed first
  dedup_key text, -- optional: deduplicate within time window
  processed boolean default false,
  created_at timestamp default now()
);

-- ============================================================
-- 2. INDEXES for fast queue processing
-- ============================================================
create index if not exists idx_notif_queue_unprocessed on notification_queue(processed, priority desc, created_at asc);
create index if not exists idx_notif_queue_user on notification_queue(user_id);
create index if not exists idx_notif_queue_dedup on notification_queue(dedup_key, created_at desc);

-- ============================================================
-- 3. RLS — anyone can insert, only system processes
-- ============================================================
alter table notification_queue enable row level security;

do $$ begin
  create policy "System can insert notifications" on notification_queue for insert with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can read own queue" on notification_queue
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 4. RPC: Batch insert notifications (up to 100 at once)
-- ============================================================
create or replace function batch_insert_notifications(
  notifications jsonb
)
returns int as $$
declare
  inserted_count int := 0;
  item jsonb;
begin
  for item in select * from jsonb_array_elements(notifications)
  loop
    -- Skip if dedup_key exists within last 60 seconds
    if item->>'dedup_key' is not null then
      if exists (
        select 1 from notification_queue
        where dedup_key = item->>'dedup_key'
        and created_at > now() - interval '60 seconds'
        and processed = false
      ) then
        continue;
      end if;
    end if;

    insert into notification_queue (user_id, type, title, message, link, priority, dedup_key)
    values (
      (item->>'user_id')::uuid,
      item->>'type',
      item->>'title',
      item->>'message',
      item->>'link',
      coalesce((item->>'priority')::int, 0),
      item->>'dedup_key'
    );
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$ language plpgsql;

-- ============================================================
-- 5. RPC: Process queue — moves items to notifications table
-- Called by Edge Function or cron, processes up to 500 items
-- ============================================================
create or replace function process_notification_queue(
  batch_size int default 500
)
returns int as $$
declare
  processed_count int := 0;
begin
  -- Move unprocessed items to notifications table in batch
  insert into notifications (user_id, type, title, message, link, is_read, created_at)
  select user_id, type, title, message, link, false, created_at
  from notification_queue
  where processed = false
  order by priority desc, created_at asc
  limit batch_size;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  -- Mark as processed
  update notification_queue
  set processed = true
  where id in (
    select id from notification_queue
    where processed = false
    order by priority desc, created_at asc
    limit batch_size
  );

  -- Cleanup: delete processed items older than 24 hours
  delete from notification_queue
  where processed = true
  and created_at < now() - interval '24 hours';

  return processed_count;
end;
$$ language plpgsql;

-- ============================================================
-- 6. RPC: Cleanup old queue items (called by cron)
-- ============================================================
create or replace function cleanup_notification_queue()
returns void as $$
begin
  -- Delete all processed items older than 24 hours
  delete from notification_queue
  where processed = true
  and created_at < now() - interval '24 hours';

  -- Delete unprocessed items older than 7 days (stuck/abandoned)
  delete from notification_queue
  where processed = false
  and created_at < now() - interval '7 days';
end;
$$ language plpgsql;
