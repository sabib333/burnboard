-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Challenges, Battles & Viral Participation (Master Prompt 9)
-- NON-DESTRUCTIVE: only adds new tables/columns/RPCs. No existing
-- tables are dropped, renamed, or have data removed.
--
-- Execution order matters: tables → helper functions → policies.
-- ═══════════════════════════════════════════════════════════

-- ── 1. BATTLE VOTES ─────────────────────────────────────────
-- One real vote per (battle, voter). Totals are ALWAYS derived from
-- this table by the cast_battle_vote RPC — never trusted from clients.
-- The legacy battles.votes1/votes2 columns are kept as a denormalized
-- cache (and for realtime broadcasts) and are recomputed on each vote.
CREATE TABLE IF NOT EXISTS battle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  selection INT NOT NULL CHECK (selection IN (1, 2)),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_battle_vote UNIQUE (battle_id, voter_key)
);

CREATE INDEX IF NOT EXISTS idx_battle_votes_battle ON battle_votes(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_votes_user ON battle_votes(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE battle_votes ENABLE ROW LEVEL SECURITY;

-- Votes are public/pseudonymous for read (needed for authoritative
-- count queries and result aggregation). NO insert/update/delete
-- policies exist — writes only happen through cast_battle_vote RPC,
-- so the client can never control totals.
DO $$ BEGIN
  CREATE POLICY "Public can read battle votes" ON battle_votes
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. CAST BATTLE VOTE (security definer RPC) ──────────────
-- Validates battle existence, blocks self-voting on owned profiles,
-- upserts the voter's choice (votes may switch until voting closes —
-- arena matchups stay open), and recomputes canonical totals.
CREATE OR REPLACE FUNCTION public.cast_battle_vote(
  p_battle_id UUID,
  p_voter_key TEXT,
  p_selection INT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (success boolean, message text, votes1 bigint, votes2 bigint, total bigint, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b_record battles%ROWTYPE;
  v1 bigint;
  v2 bigint;
  inserted boolean;
BEGIN
  IF p_voter_key IS NULL OR char_length(p_voter_key) = 0 THEN
    RETURN QUERY SELECT false, 'Missing voter identity', 0, 0, 0, 'none';
    RETURN;
  END IF;

  IF p_selection NOT IN (1, 2) THEN
    RETURN QUERY SELECT false, 'Invalid selection', 0, 0, 0, 'none';
    RETURN;
  END IF;

  SELECT * INTO b_record FROM battles WHERE id = p_battle_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Battle not found', 0, 0, 0, 'none';
    RETURN;
  END IF;

  -- Block self-voting when the signed-in user owns one of the fighters
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id IN (b_record.profile1_id, b_record.profile2_id)
        AND user_id = p_user_id
    ) THEN
      RETURN QUERY SELECT false, 'You cannot vote in a battle featuring your own profile', 0, 0, 0, 'none';
      RETURN;
    END IF;
  END IF;

  -- Upsert the vote (allow switching). xmax = 0 on the returned row
  -- means the row was freshly inserted (not an update).
  INSERT INTO battle_votes (battle_id, voter_key, selection, user_id)
  VALUES (p_battle_id, p_voter_key, p_selection, p_user_id)
  ON CONFLICT (battle_id, voter_key)
  DO UPDATE SET selection = EXCLUDED.selection, updated_at = now()
  RETURNING (xmax = 0) INTO inserted;

  -- Recompute canonical totals from real vote rows
  SELECT count(*) FILTER (WHERE selection = 1),
         count(*) FILTER (WHERE selection = 2)
    INTO v1, v2
    FROM battle_votes WHERE battle_id = p_battle_id;

  UPDATE battles
     SET votes1 = v1, votes2 = v2, updated_at = now()
   WHERE id = p_battle_id;

  RETURN QUERY SELECT true,
    CASE WHEN inserted THEN 'added' ELSE 'switched' END,
    v1, v2, v1 + v2,
    CASE WHEN inserted THEN 'added' ELSE 'switched' END;
END;
$$;

-- ── 3. CHALLENGES TABLE ──────────────────────────────────────
-- A Challenge is a time-boxed, type-specific participation prompt.
-- Entries are canonical social_posts rows linked via
-- social_posts.challenge_id — one record, no content duplication.
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(10), 'hex'),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 500),
  -- The content type entries must be: opinion | question | poll | photo | hot_take
  challenge_type TEXT NOT NULL CHECK (challenge_type IN
    ('opinion', 'question', 'poll', 'photo', 'hot_take')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public')),
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT challenge_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_challenges_slug ON challenges(slug);
CREATE INDEX IF NOT EXISTS idx_challenges_status_ends ON challenges(status, ends_at ASC);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_challenges_community ON challenges(community_id) WHERE community_id IS NOT NULL;

-- ── 4. CHALLENGE PARTICIPANTS ────────────────────────────────
-- Real, authenticated participation. One row per (challenge, user).
-- post_id is set when the participant's canonical entry is created.
CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_challenge_participation UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_post ON challenge_participants(post_id) WHERE post_id IS NOT NULL;

-- ── 5. CHALLENGE INVITATIONS ─────────────────────────────────
-- Creator/participant can invite an authenticated user by username.
-- Invitees may decline; accepting happens by participating (their
-- participant row is created with status active).
CREATE TABLE IF NOT EXISTS challenge_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_challenge_invitee UNIQUE (challenge_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_invitations_challenge ON challenge_invitations(challenge_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_invitee ON challenge_invitations(invitee_id, status);

-- ── 6. SOCIAL POSTS ↔ CHALLENGE (canonical content association) ──
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_challenge ON social_posts(challenge_id, created_at DESC);

-- ── 7. ROLE/STATE HELPERS (security definer) ─────────────────
CREATE OR REPLACE FUNCTION public.is_challenge_creator(challenge uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenges
    WHERE id = challenge AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_challenge_participant(challenge uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE challenge_id = challenge AND user_id = auth.uid()
  );
$$;

-- ── 8. ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view public challenges" ON challenges
    FOR SELECT USING (visibility = 'public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users create challenges" ON challenges
    FOR INSERT WITH CHECK (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Creators update challenges" ON challenges
    FOR UPDATE USING (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Creators delete challenges" ON challenges
    FOR DELETE USING (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view participants" ON challenge_participants
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Participation is authenticated: users can only add themselves
DO $$ BEGIN
  CREATE POLICY "Users participate in challenges" ON challenge_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Participants update own row" ON challenge_participants
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can leave" ON challenge_participants
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE challenge_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Parties can view invitations" ON challenge_invitations
    FOR SELECT USING (
      auth.uid() = invitee_id
      OR auth.uid() = inviter_id
      OR is_challenge_creator(challenge_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Participants send invitations" ON challenge_invitations
    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invitees can decline/accept; creators can revoke pending invites
DO $$ BEGIN
  CREATE POLICY "Invitee or creator updates invitation" ON challenge_invitations
    FOR UPDATE USING (
      auth.uid() = invitee_id
      OR is_challenge_creator(challenge_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 9. TIMESTAMP TRIGGERS ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_challenges_updated_at();

DROP TRIGGER IF EXISTS update_challenge_invitations_updated_at ON challenge_invitations;
CREATE TRIGGER update_challenge_invitations_updated_at
  BEFORE UPDATE ON challenge_invitations
  FOR EACH ROW EXECUTE FUNCTION update_challenges_updated_at();

-- ── 10. EXTEND MODERATION AUDIT LOG for challenge actions ────
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_action_type_check
  CHECK (action_type IN (
    'hide_roast', 'unhide_roast',
    'hide_hot_seat', 'unhide_hot_seat',
    'restrict_profile', 'unrestrict_profile',
    'ban_profile', 'unban_profile',
    'dismiss_report', 'resolve_report', 'escalate_report',
    'resolve_appeal', 'reverse_appeal',
    'community_remove_post', 'community_remove_member', 'community_role_changed',
    'challenge_cancelled', 'challenge_entry_removed'
  ));

ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_target_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_target_type_check
  CHECK (target_type IN (
    'roast', 'hot_seat', 'battle', 'profile', 'report', 'appeal',
    'community', 'community_member', 'social_post', 'challenge'
  ));

-- ── 11. REALTIME (battles row only — feeds stay request-driven) ──
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- DONE — Challenges & battle voting schema created (additive only)
-- ═══════════════════════════════════════════════════════════
