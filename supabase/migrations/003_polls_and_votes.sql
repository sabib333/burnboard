-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Polls Migration
-- NON-DESTRUCTIVE: Only adds new tables for poll content.
-- ═══════════════════════════════════════════════════════════

-- 1. Polls table (extends social_posts with poll-specific data)
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references social_posts(id) on delete cascade not null,
  question text not null,
  options jsonb not null default '[]',
  total_votes int default 0,
  closes_at timestamptz,
  created_at timestamptz default now()
);

alter table polls enable row level security;
create policy "Public can read polls" on polls for select using (true);
create policy "Users can insert own polls" on polls for insert with check (true);
create policy "Users can update own polls" on polls for update using (true);

-- 2. Poll Votes table
create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls(id) on delete cascade not null,
  participant_id text not null,
  option_index int not null,
  created_at timestamptz default now(),
  constraint unique_poll_vote unique(poll_id, participant_id)
);

alter table poll_votes enable row level security;
create policy "Public can read poll_votes" on poll_votes for select using (true);
create policy "Public can insert poll_votes" on poll_votes for insert with check (true);

-- 3. Indexes
create index if not exists idx_polls_post_id on polls(post_id);
create index if not exists idx_poll_votes_poll_id on poll_votes(poll_id);
create index if not exists idx_poll_votes_participant on poll_votes(participant_id);

-- 4. Enable realtime
alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_votes;
