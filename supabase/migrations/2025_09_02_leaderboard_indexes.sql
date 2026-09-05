-- ============================================================
-- BURNBOARD — Leaderboard & Weekly Recap Indexes
-- Additive-only: adds indexes to support ranking queries
-- ============================================================

-- Hot Seats: leaderboard queries need roast_count + created_at for period filtering
CREATE INDEX IF NOT EXISTS idx_hot_seats_ranking 
  ON hot_seats(roast_count DESC, created_at DESC) 
  WHERE status != 'deleted' AND status != 'private';

-- Hot Seats: weekly recap needs count by period
CREATE INDEX IF NOT EXISTS idx_hot_seats_created_period 
  ON hot_seats(created_at DESC) 
  WHERE status != 'deleted';

-- Hot Seat Roasts: leaderboard needs reactions by roast in period
CREATE INDEX IF NOT EXISTS idx_hs_roasts_created_period 
  ON hot_seat_roasts(created_at DESC) 
  WHERE is_hidden = false;

-- Hot Seat Reactions: leaderboard needs reaction_type counts per roast
CREATE INDEX IF NOT EXISTS idx_hs_reactions_type_active 
  ON hot_seat_roast_reactions(reaction_type, roast_id) 
  WHERE is_active = true;

-- Hot Seat Reactions: weekly recap needs reactions by period
CREATE INDEX IF NOT EXISTS idx_hs_reactions_created_period 
  ON hot_seat_roast_reactions(created_at DESC) 
  WHERE is_active = true;

-- Classic Roasts: leaderboard needs reaction counts by period
CREATE INDEX IF NOT EXISTS idx_roasts_created_period 
  ON roasts(created_at DESC) 
  WHERE is_hidden = false;

-- Battles: leaderboard needs votes + period
CREATE INDEX IF NOT EXISTS idx_battles_votes_period 
  ON battles(votes1 DESC, votes2 DESC, created_at DESC);

-- Battles: weekly recap needs battles by period
CREATE INDEX IF NOT EXISTS idx_battles_created_period 
  ON battles(created_at DESC);
