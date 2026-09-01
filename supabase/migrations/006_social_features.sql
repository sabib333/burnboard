-- BURNBOARD Social Features Migration
-- Follow + DM + Notifications + Activity Status
-- Run this in Supabase SQL Editor

-- ============================================================
-- 0. USER PROFILES TABLE (if not exists)
-- ============================================================
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text default '',
  karma int default 0,
  level text default 'Newbie',
  avatar_url text,
  created_at timestamptz default now()
);

-- Add RLS for user_profiles
alter table user_profiles enable row level security;
do $$ begin
  create policy "Public can read user_profiles" on user_profiles for select using (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users can update own user_profiles" on user_profiles for update using (auth.uid() = id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users can insert own user_profiles" on user_profiles for insert with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 1. FOLLOWS TABLE
-- ============================================================
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamp default now(),
  unique(follower_id, following_id)
);

-- ============================================================
-- 2. DM THREADS
-- ============================================================
create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references auth.users(id),
  user2_id uuid references auth.users(id),
  last_message text,
  updated_at timestamp default now(),
  unique(user1_id, user2_id)
);

-- ============================================================
-- 3. DM MESSAGES
-- ============================================================
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references dm_threads(id) on delete cascade,
  sender_id uuid references auth.users(id),
  message text not null check (char_length(message) <= 280),
  is_roast boolean default true,
  created_at timestamp default now()
);

-- ============================================================
-- 4. NOTIFICATIONS TABLE
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean default false,
  created_at timestamp default now()
);

-- ============================================================
-- 5. ADD COLUMNS TO USER_PROFILES (safe - checks first)
-- ============================================================
do $$ begin
  alter table user_profiles add column last_active timestamp default now();
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column push_enabled boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column email_notifications boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column roast_alerts boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column follow_alerts boolean default true;
exception when duplicate_column then null;
end $$;

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table dm_messages;
alter publication supabase_realtime add table follows;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- FOLLOWS
alter table follows enable row level security;
do $$ begin
  create policy "Public read follows" on follows for select using (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users can follow" on follows for insert with check (auth.uid() = follower_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);
exception when duplicate_object then null;
end $$;

-- DM THREADS
alter table dm_threads enable row level security;
do $$ begin
  create policy "Users read own threads" on dm_threads
    for select using (auth.uid() = user1_id or auth.uid() = user2_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users create threads" on dm_threads
    for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users update own threads" on dm_threads
    for update using (auth.uid() = user1_id or auth.uid() = user2_id);
exception when duplicate_object then null;
end $$;

-- DM MESSAGES
alter table dm_messages enable row level security;
do $$ begin
  create policy "Thread participants read messages" on dm_messages
    for select using (
      exists (
        select 1 from dm_threads
        where dm_threads.id = dm_messages.thread_id
        and (auth.uid() = dm_threads.user1_id or auth.uid() = dm_threads.user2_id)
      )
    );
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users send messages" on dm_messages
    for insert with check (auth.uid() = sender_id);
exception when duplicate_object then null;
end $$;

-- NOTIFICATIONS
alter table notifications enable row level security;
do $$ begin
  create policy "Users read own notifications" on notifications
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "System can insert notifications" on notifications
    for insert with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users update own notifications" on notifications
    for update using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 8. INDEXES for performance
-- ============================================================
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);
create index if not exists idx_dm_threads_user1 on dm_threads(user1_id);
create index if not exists idx_dm_threads_user2 on dm_threads(user2_id);
create index if not exists idx_dm_messages_thread on dm_messages(thread_id);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id, is_read);
create index if not exists idx_user_profiles_username on user_profiles(username);
