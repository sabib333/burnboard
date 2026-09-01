-- BURNBOARD 1M Scale Social Features Migration
-- Counter caches, cursor pagination, polling-optimized indexes
-- Run this in Supabase SQL Editor

-- ============================================================
-- 0. ADD CACHED FOLLOW COUNTS TO USER_PROFILES
-- ============================================================
do $$ begin
  alter table user_profiles add column follower_count int default 0;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column following_count int default 0;
exception when duplicate_column then null;
end $$;

-- ============================================================
-- 1. DM THREADS - add last_message_at for proper ordering
-- ============================================================
do $$ begin
  alter table dm_threads add column last_message_at timestamp default now();
exception when duplicate_column then null;
end $$;

-- ============================================================
-- 2. DM MESSAGES - increase limit for 1M scale
-- ============================================================
-- Drop old check constraint and add new one with 500 char limit
do $$ begin
  alter table dm_messages drop constraint if exists dm_messages_message_check;
  alter table dm_messages add constraint dm_messages_message_check check (char_length(message) <= 500);
exception when undefined_object then null;
end $$;

-- ============================================================
-- 3. COMPOSITE INDEXES for cursor pagination (1M scale)
-- ============================================================

-- Follows: composite indexes for fast lookups
create index if not exists idx_follows_follower_created on follows(follower_id, created_at desc);
create index if not exists idx_follows_following_created on follows(following_id, created_at desc);

-- DM threads: composite indexes for pagination
create index if not exists idx_threads_user1_updated on dm_threads(user1_id, updated_at desc);
create index if not exists idx_threads_user2_updated on dm_threads(user2_id, updated_at desc);
create index if not exists idx_threads_last_message on dm_threads(last_message_at desc);

-- DM messages: composite index for cursor pagination
create index if not exists idx_dm_thread_created on dm_messages(thread_id, created_at desc);
create index if not exists idx_dm_sender on dm_messages(sender_id);

-- Notifications: composite indexes for cursor pagination
create index if not exists idx_notif_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notif_user_read_created on notifications(user_id, is_read, created_at desc);

-- User profiles: index for username search
create index if not exists idx_user_profiles_username_trgm on user_profiles using gin(username gin_trgm_ops);

-- Roasts: composite index for user roasts feed
create index if not exists idx_roasts_user_created on roasts(user_id, created_at desc);

-- Profiles: composite index for user profiles feed  
create index if not exists idx_profiles_user_created on profiles(user_id, created_at desc);

-- ============================================================
-- 4. RPC FUNCTION: Increment follow counts atomically
-- ============================================================
create or replace function increment_follow_counts(follower uuid, following uuid)
returns void as $$
begin
  update user_profiles set following_count = following_count + 1 where id = follower;
  update user_profiles set follower_count = follower_count + 1 where id = following;
end;
$$ language plpgsql;

create or replace function decrement_follow_counts(follower uuid, following uuid)
returns void as $$
begin
  update user_profiles set following_count = greatest(0, following_count - 1) where id = follower;
  update user_profiles set follower_count = greatest(0, follower_count - 1) where id = following;
end;
$$ language plpgsql;

-- ============================================================
-- 5. RPC FUNCTION: Batch mark notifications as read
-- ============================================================
create or replace function mark_notifications_read(target_user_id uuid)
returns void as $$
begin
  update notifications set is_read = true where user_id = target_user_id and is_read = false;
end;
$$ language plpgsql;

-- ============================================================
-- 6. ENABLE TRIGGERS for follow count sync
-- ============================================================
create or replace function sync_follow_counts_on_insert()
returns trigger as $$
begin
  update user_profiles set follower_count = follower_count + 1 where id = NEW.following_id;
  update user_profiles set following_count = following_count + 1 where id = NEW.follower_id;
  return NEW;
end;
$$ language plpgsql;

create or replace function sync_follow_counts_on_delete()
returns trigger as $$
begin
  update user_profiles set follower_count = greatest(0, follower_count - 1) where id = OLD.following_id;
  update user_profiles set following_count = greatest(0, following_count - 1) where id = OLD.follower_id;
  return OLD;
end;
$$ language plpgsql;

-- Drop old triggers if they exist, then create new ones
drop trigger if exists trigger_follow_insert on follows;
create trigger trigger_follow_insert
  after insert on follows
  for each row
  execute function sync_follow_counts_on_insert();

drop trigger if exists trigger_follow_delete on follows;
create trigger trigger_follow_delete
  after delete on follows
  for each row
  execute function sync_follow_counts_on_delete();

-- ============================================================
-- 7. ENABLE pg_trgm for username search (if not enabled)
-- ============================================================
-- Note: pg_trgm extension must be enabled in Supabase dashboard
-- This is a no-op if already enabled
create extension if not exists pg_trgm;
