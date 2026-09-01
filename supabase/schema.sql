-- BURNBOARD Master Supabase SQL Schema (10k+ Concurrency Ready)
-- Run this in your Supabase SQL Editor

-- 0. USER PROFILES TABLE (Auth-linked profiles)
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

alter table user_profiles enable row level security;
create policy "Public can read user_profiles" on user_profiles for select using (true);
create policy "Users can update own user_profiles" on user_profiles for update using (auth.uid() = id);
create policy "Users can insert own user_profiles" on user_profiles for insert with check (auth.uid() = id);
create policy "Users can delete own user_profiles" on user_profiles for delete using (auth.uid() = id);

-- 1. PROFILES TABLE
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  platform text not null,
  bio text not null,
  avatar_letter text,
  avatar_color text default 'bg-[#ff4d00] text-black',
  tagline text,
  featured boolean default false,
  roast_count int default 0,
  total_upvotes int default 0,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 2. ROASTS TABLE (Includes IP Hash & Content Moderation Flag)
create table if not exists roasts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  roast_text text not null check (char_length(roast_text) <= 280),
  upvotes int default 0,
  reaction_haha int default 0,
  reaction_brutal int default 0,
  reaction_cry int default 0,
  anon_id text not null default 'Anon Roaster',
  ip_hash text,
  isClean boolean default true,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. BATTLES TABLE
create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  profile1_id uuid references profiles(id) on delete cascade,
  profile2_id uuid references profiles(id) on delete cascade,
  votes1 int default 0,
  votes2 int default 0,
  created_at timestamptz default now()
);

-- 4. REPORTS TABLE (Moderation Queue)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  roast_id uuid references roasts(id) on delete cascade,
  reason text not null,
  created_at timestamptz default now()
);

-- 5. BLOCKED IPS TABLE (Anti-Spam Shield)
create table if not exists blocked_ips (
  ip_hash text primary key,
  reason text not null default 'Rate limit flood or abuse',
  created_at timestamptz default now()
);

-- 6. EMAIL SUBSCRIBERS TABLE (Free Resend Alerts)
create table if not exists email_subscribers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  email text not null,
  created_at timestamptz default now(),
  constraint unique_profile_email unique(profile_id, email)
);

-- 7. DAILY WINNERS TABLE (Roast of the Day)
create table if not exists daily_winner (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  roast_id uuid references roasts(id) on delete cascade,
  date date default current_date,
  created_at timestamptz default now()
);

-- 8. FOLLOWS TABLE (Social follow/unfollow system)
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  constraint unique_follow unique(follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

alter table follows enable row level security;
create policy "Public can read follows" on follows for select using (true);
create policy "Users can insert own follows" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can delete own follows" on follows for delete using (auth.uid() = follower_id);

-- 9. INDEXES FOR ULTRA-FAST SCALING (10k+ users)
create index if not exists idx_user_profiles_username on user_profiles(username);
create index if not exists idx_roasts_user_id on roasts(user_id);
create index if not exists idx_profiles_user_id on profiles(user_id);
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);

create index if not exists idx_roasts_profile_id on roasts(profile_id);
create index if not exists idx_roasts_created_at on roasts(created_at desc);
create index if not exists idx_roasts_upvotes on roasts(upvotes desc);
create index if not exists idx_roasts_ip_hash on roasts(ip_hash);
create index if not exists idx_profiles_created_at on profiles(created_at desc);
create index if not exists idx_profiles_featured on profiles(featured);

-- 10. REALTIME BROADCASTING
alter publication supabase_realtime add table roasts;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table battles;
alter publication supabase_realtime add table user_profiles;
alter publication supabase_realtime add table follows;

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
alter table user_profiles enable row level security;
alter table profiles enable row level security;
alter table roasts enable row level security;
alter table battles enable row level security;
alter table reports enable row level security;
alter table blocked_ips enable row level security;
alter table email_subscribers enable row level security;
alter table daily_winner enable row level security;

-- Public Read Policies
create policy "Allow public read profiles" on profiles for select using (true);
create policy "Allow public insert profiles" on profiles for insert with check (true);
create policy "Allow public update profiles" on profiles for update using (true);
create policy "Allow public delete profiles" on profiles for delete using (true);

create policy "Allow public read roasts" on roasts for select using (true);
create policy "Allow public insert roasts" on roasts for insert with check (true);
create policy "Allow public update roasts" on roasts for update using (true);
create policy "Allow public delete roasts" on roasts for delete using (true);

create policy "Allow public read battles" on battles for select using (true);
create policy "Allow public insert battles" on battles for insert with check (true);
create policy "Allow public update battles" on battles for update using (true);

create policy "Allow public insert reports" on reports for insert with check (true);
create policy "Allow public read reports" on reports for select using (true);
create policy "Allow public delete reports" on reports for delete using (true);

create policy "Allow public read blocked_ips" on blocked_ips for select using (true);
create policy "Allow public insert blocked_ips" on blocked_ips for insert with check (true);

create policy "Allow public insert email_subscribers" on email_subscribers for insert with check (true);
create policy "Allow public read email_subscribers" on email_subscribers for select using (true);

create policy "Allow public read daily_winner" on daily_winner for select using (true);
create policy "Allow public insert daily_winner" on daily_winner for insert with check (true);
