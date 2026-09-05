-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Roast Reactions Migration
-- NON-DESTRUCTIVE: Only adds new table for tracking individual reactions.
-- ═══════════════════════════════════════════════════════════

-- 1. Roast Reactions table (tracks individual reactions per participant)
create table if not exists roast_reactions (
  id uuid primary key default gen_random_uuid(),
  roast_id uuid references roasts(id) on delete cascade not null,
  participant_id text not null,
  reaction_type text not null check (reaction_type in ('funny', 'savage', 'fatal')),
  created_at timestamptz default now(),
  constraint unique_roast_participant_reaction unique(roast_id, participant_id)
);

alter table roast_reactions enable row level security;
create policy "Public can read roast_reactions" on roast_reactions for select using (true);
create policy "Public can insert roast_reactions" on roast_reactions for insert with check (true);
create policy "Public can update own roast_reactions" on roast_reactions for update using (true);
create policy "Public can delete own roast_reactions" on roast_reactions for delete using (true);

-- 2. Indexes for fast lookups
create index if not exists idx_roast_reactions_roast_id on roast_reactions(roast_id);
create index if not exists idx_roast_reactions_participant on roast_reactions(participant_id);
create index if not exists idx_roast_reactions_type on roast_reactions(reaction_type);

-- 3. Enable realtime
alter publication supabase_realtime add table roast_reactions;
