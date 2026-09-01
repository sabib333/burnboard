-- BURNBOARD Gamification — Real Data, No Fake Karma
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. CHALLENGES TABLE — Real daily tasks from DB
-- ============================================================
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null, -- 'roast', 'linkedin', 'upvote', 'vote', 'share'
  target_count int not null default 1,
  reward_karma int not null default 5,
  active boolean default true,
  created_at timestamp default now()
);

-- RLS
alter table challenges enable row level security;
do $$ begin
  create policy "Public read challenges" on challenges for select using (active = true);
exception when duplicate_object then null;
end $$;

-- Insert real challenges (rotated daily by type)
insert into challenges (title, description, type, target_count, reward_karma) values
  ('First Blood', 'Roast 1 person today', 'roast', 1, 5),
  ('Roast Rampage', 'Roast 5 people today', 'roast', 5, 15),
  ('LinkedIn Hunter', 'Roast 3 LinkedIn profiles today', 'linkedin', 3, 10),
  ('Upvote Magnet', 'Get 10 total upvotes on your roasts', 'upvote', 10, 20),
  ('Battle Judge', 'Vote in 3 roast battles today', 'vote', 3, 10),
  ('Viral Share', 'Share 1 roast card to socials', 'share', 1, 5),
  ('Brutal Week', 'Roast 7 days in a row (streak)', 'streak', 7, 50),
  ('Century Club', 'Get 100 total upvotes across all roasts', 'upvote', 100, 100)
on conflict do nothing;

-- ============================================================
-- 2. USER_KARMA TABLE — Real karma from real actions
-- ============================================================
create table if not exists user_karma (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_id text, -- for anonymous roasters
  total_upvotes_received int default 0,
  total_roasts_given int default 0,
  total_upvotes_given int default 0,
  level text default 'Newbie',
  streak int default 0,
  last_roast_date date,
  created_at timestamp default now(),
  unique(user_id),
  unique(anon_id)
);

alter table user_karma enable row level security;
do $$ begin
  create policy "Public read user_karma" on user_karma for select using (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Users update own karma" on user_karma for update using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "System can insert karma" on user_karma for insert with check (true);
exception when duplicate_object then null;
end $$;

-- Indexes
create index if not exists idx_user_karma_user on user_karma(user_id);
create index if not exists idx_user_karma_anon on user_karma(anon_id);
create index if not exists idx_user_karma_level on user_karma(level desc, total_upvotes_received desc);

-- ============================================================
-- 3. RPC: Increment karma atomically
-- ============================================================
create or replace function increment_karma(
  p_user_id uuid,
  p_upvotes_delta int default 0,
  p_roasts_delta int default 0
)
returns void as $$
begin
  update user_karma set
    total_upvotes_received = total_upvotes_received + p_upvotes_delta,
    total_roasts_given = total_roasts_given + p_roasts_delta
  where user_id = p_user_id;
end;
$$ language plpgsql;

-- ============================================================
-- 4. RPC: Update streak atomically
-- ============================================================
create or replace function update_streak(p_user_id uuid)
returns int as $$
declare
  current_streak int;
  last_date date;
  today date := current_date;
  yesterday date := current_date - 1;
begin
  select streak, last_roast_date into current_streak, last_date
  from user_karma where user_id = p_user_id;

  if current_streak is null then
    current_streak := 0;
  end if;

  if last_date = today then
    -- Already roasted today, streak unchanged
    return current_streak;
  elsif last_date = yesterday then
    -- Consecutive day
    current_streak := current_streak + 1;
  else
    -- Streak broken
    current_streak := 1;
  end if;

  update user_karma set
    streak = current_streak,
    last_roast_date = today
  where user_id = p_user_id;

  return current_streak;
end;
$$ language plpgsql;
