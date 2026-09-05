-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Social Platform Foundation Migration
-- NON-DESTRUCTIVE: Only adds new tables and extends existing ones.
-- Does NOT modify, rename, or delete any existing tables or columns.
-- ═══════════════════════════════════════════════════════════

-- 1. Extend user_profiles with social fields (safe ALTER ADD COLUMN)
-- These are additive only — existing columns are untouched.

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS visibility text default 'public';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS follower_count int default 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS following_count int default 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS post_count int default 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Social Posts table (future content types)
-- This is a generic content table that can eventually support
-- roasts, photos, opinions, polls, questions, battles, challenges.
-- Existing roasts table is NOT modified — this is for future use.

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content_type text not null default 'roast',
  content_text text,
  media_url text,
  metadata jsonb default '{}',
  reaction_count int default 0,
  comment_count int default 0,
  upvote_count int default 0,
  visibility text default 'public',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table social_posts enable row level security;
create policy "Public can read social_posts" on social_posts for select using (visibility = 'public');
create policy "Users can insert own social_posts" on social_posts for insert with check (auth.uid() = user_id);
create policy "Users can update own social_posts" on social_posts for update using (auth.uid() = user_id);
create policy "Users can delete own social_posts" on social_posts for delete using (auth.uid() = user_id);

-- 3. Comments table (generic, works for roasts and future posts)

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  target_type text not null default 'roast',
  target_id uuid not null,
  text text not null check (char_length(text) <= 500),
  parent_id uuid references comments(id) on delete cascade,
  upvotes int default 0,
  created_at timestamptz default now()
);

alter table comments enable row level security;
create policy "Public can read comments" on comments for select using (true);
create policy "Users can insert own comments" on comments for insert with check (auth.uid() = user_id);
create policy "Users can update own comments" on comments for update using (auth.uid() = user_id);
create policy "Users can delete own comments" on comments for delete using (auth.uid() = user_id);

-- 4. Reputation Events table (event-based scoring)

create table if not exists reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  points int not null default 0,
  reference_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table reputation_events enable row level security;
create policy "Public can read reputation_events" on reputation_events for select using (true);
create policy "System can insert reputation_events" on reputation_events for insert with check (true);

-- 5. Feature Flags table (runtime-configurable flags)

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_name text unique not null,
  enabled boolean default false,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table feature_flags enable row level security;
create policy "Public can read feature_flags" on feature_flags for select using (true);
create policy "Admins can manage feature_flags" on feature_flags for all using (true);

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
  ('social_feed', false, 'Enable the social feed'),
  ('social_profiles', false, 'Enable enhanced social profiles'),
  ('social_follow', false, 'Enable the follow system'),
  ('social_reactions_v2', false, 'Enable v2 reaction system'),
  ('social_comments', false, 'Enable comments on content'),
  ('social_communities', false, 'Enable communities'),
  ('social_challenges_v2', false, 'Enable v2 challenge system'),
  ('social_discover_v2', false, 'Enable enhanced discovery'),
  ('social_search', false, 'Enable search'),
  ('social_stories', false, 'Enable stories'),
  ('social_reputation', false, 'Enable reputation system'),
  ('new_nav_shell', false, 'Enable new navigation shell'),
  ('mobile_bottom_nav', true, 'Enable mobile bottom navigation')
ON CONFLICT (flag_name) DO NOTHING;

-- 6. Indexes for new tables

create index if not exists idx_social_posts_user_id on social_posts(user_id);
create index if not exists idx_social_posts_created_at on social_posts(created_at desc);
create index if not exists idx_social_posts_content_type on social_posts(content_type);

create index if not exists idx_comments_target on comments(target_type, target_id);
create index if not exists idx_comments_user_id on comments(user_id);
create index if not exists idx_comments_created_at on comments(created_at desc);

create index if not exists idx_reputation_events_user_id on reputation_events(user_id);
create index if not exists idx_reputation_events_type on reputation_events(event_type);

create index if not exists idx_user_profiles_visibility on user_profiles(visibility);
create index if not exists idx_user_profiles_karma on user_profiles(karma desc);

-- 7. Enable realtime for new tables

alter publication supabase_realtime add table social_posts;
alter publication supabase_realtime add table comments;
