-- ============================================================
-- BURNBOARD — Trending & Discovery Indexes
-- Additive-only: adds indexes to support trending queries
-- ============================================================

-- Hot Seats: trending queries filter by status + order by created_at
CREATE INDEX IF NOT EXISTS idx_hot_seats_status_created 
  ON hot_seats(status, created_at DESC) 
  WHERE status != 'deleted';

-- Hot Seats: for counting roasts per seat quickly
CREATE INDEX IF NOT EXISTS idx_hot_seats_roast_count 
  ON hot_seats(roast_count DESC, created_at DESC) 
  WHERE status = 'active';

-- Hot Seat Roasts: trending roasts need reactions by roast_id
CREATE INDEX IF NOT EXISTS idx_hs_roasts_hidden_created 
  ON hot_seat_roasts(hot_seat_id, created_at DESC) 
  WHERE is_hidden = false;

-- Hot Seat Reactions: trending needs reaction counts per roast
CREATE INDEX IF NOT EXISTS idx_hs_reactions_active_type 
  ON hot_seat_roast_reactions(roast_id, reaction_type) 
  WHERE is_active = true;

-- Classic Roasts: trending needs reactions + recency
CREATE INDEX IF NOT EXISTS idx_roasts_hidden_created 
  ON roasts(created_at DESC) 
  WHERE is_hidden = false;

-- Battles: trending queries filter by active status + created_at
CREATE INDEX IF NOT EXISTS idx_battles_active_created 
  ON battles(is_active, created_at DESC);

-- Battles: for vote velocity calculations
CREATE INDEX IF NOT EXISTS idx_battles_votes_created 
  ON battles(votes1, votes2, created_at DESC);
