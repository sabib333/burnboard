-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Unified Reactions Migration
-- NON-DESTRUCTIVE: Creates new unified reactions table.
-- Existing roast_reactions table is preserved for backward compatibility.
-- ═══════════════════════════════════════════════════════════

-- 1. Unified Reactions table (works for all content types)
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('roast', 'social_post', 'comment')),
  target_id uuid not null,
  participant_id text not null,
  reaction_type text not null check (reaction_type in ('burn', 'dead', 'finished', 'brutal', 'wild', 'respect', 'hmm')),
  created_at timestamptz default now(),
  constraint unique_target_participant_reaction unique(target_type, target_id, participant_id)
);

alter table reactions enable row level security;
create policy "Public can read reactions" on reactions for select using (true);
create policy "Public can insert reactions" on reactions for insert with check (true);
create policy "Public can update own reactions" on reactions for update using (true);
create policy "Public can delete own reactions" on reactions for delete using (true);

-- 2. Indexes
create index if not exists idx_reactions_target on reactions(target_type, target_id);
create index if not exists idx_reactions_participant on reactions(participant_id);
create index if not exists idx_reactions_type on reactions(reaction_type);
create index if not exists idx_reactions_created_at on reactions(created_at desc);

-- 3. Enable realtime
alter publication supabase_realtime add table reactions;

-- 4. Comment reactions (for future use)
create table if not exists comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references comments(id) on delete cascade not null,
  participant_id text not null,
  reaction_type text not null check (reaction_type in ('burn', 'dead', 'finished', 'brutal', 'wild', 'respect', 'hmm')),
  created_at timestamptz default now(),
  constraint unique_comment_reaction unique(comment_id, participant_id)
);

alter table comment_reactions enable row level security;
create policy "Public can read comment_reactions" on comment_reactions for select using (true);
create policy "Public can insert comment_reactions" on comment_reactions for insert with check (true);
create policy "Public can delete own comment_reactions" on comment_reactions for delete using (true);

create index if not exists idx_comment_reactions_comment on comment_reactions(comment_id);
