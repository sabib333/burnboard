-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Reputation & Gamification Migration
-- NON-DESTRUCTIVE: Only adds new tables and extends existing ones.
-- ═══════════════════════════════════════════════════════════

-- 1. Enhanced Reputation Events (with idempotency and source tracking)
-- Extends existing reputation_events table concept
create table if not exists burn_rep_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null,
  points int not null default 0,
  source_type text,
  source_id uuid,
  metadata jsonb default '{}',
  idempotency_key text,
  created_at timestamptz default now(),
  constraint unique_idempotency unique(user_id, idempotency_key)
);

alter table burn_rep_events enable row level security;
create policy "Public can read burn_rep_events" on burn_rep_events for select using (true);
create policy "System can insert burn_rep_events" on burn_rep_events for insert with check (true);

create index if not exists idx_burn_rep_events_user on burn_rep_events(user_id);
create index if not exists idx_burn_rep_events_type on burn_rep_events(event_type);
create index if not exists idx_burn_rep_events_created on burn_rep_events(created_at desc);

-- 2. User Badges table
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_id text not null,
  unlocked_at timestamptz default now(),
  constraint unique_user_badge unique(user_id, badge_id)
);

alter table user_badges enable row level security;
create policy "Public can read user_badges" on user_badges for select using (true);
create policy "System can insert user_badges" on user_badges for insert with check (true);

create index if not exists idx_user_badges_user on user_badges(user_id);
create index if not exists idx_user_badges_badge on user_badges(badge_id);

-- 3. User Achievements table
create table if not exists user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  constraint unique_user_achievement unique(user_id, achievement_id)
);

alter table user_achievements enable row level security;
create policy "Public can read user_achievements" on user_achievements for select using (true);
create policy "System can insert user_achievements" on user_achievements for insert with check (true);

create index if not exists idx_user_achievements_user on user_achievements(user_id);

-- 4. User Streaks table
create table if not exists user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date,
  streak_freezes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_streak unique(user_id)
);

alter table user_streaks enable row level security;
create policy "Public can read user_streaks" on user_streaks for select using (true);
create policy "System can insert user_streaks" on user_streaks for insert with check (true);
create policy "System can update user_streaks" on user_streaks for update using (true);

create index if not exists idx_user_streaks_user on user_streaks(user_id);

-- 5. Daily Activities table
create table if not exists daily_activities (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null default 'spark',
  title text not null,
  prompt text not null,
  category text default 'general',
  start_date date default current_date,
  end_date date,
  status text default 'active',
  created_at timestamptz default now()
);

alter table daily_activities enable row level security;
create policy "Public can read daily_activities" on daily_activities for select using (true);
create policy "System can manage daily_activities" on daily_activities for all using (true);

create index if not exists idx_daily_activities_date on daily_activities(start_date desc);
create index if not exists idx_daily_activities_status on daily_activities(status);

-- 6. Daily Activity Participations
create table if not exists daily_participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references daily_activities(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content_type text default 'spark',
  content_id uuid,
  created_at timestamptz default now(),
  constraint unique_daily_participation unique(activity_id, user_id)
);

alter table daily_participations enable row level security;
create policy "Public can read daily_participations" on daily_participations for select using (true);
create policy "System can insert daily_participations" on daily_participations for insert with check (true);

create index if not exists idx_daily_participations_activity on daily_participations(activity_id);
create index if not exists idx_daily_participations_user on daily_participations(user_id);

-- 7. Enable realtime for new tables
alter publication supabase_realtime add table daily_activities;
alter publication supabase_realtime add table user_streaks;
