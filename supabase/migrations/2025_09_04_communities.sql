-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Communities, Circles & Interest Networks (Master Prompt 8)
-- NON-DESTRUCTIVE: only adds new tables/columns and extends checks.
-- Does NOT modify, rename, or delete any existing data.
--
-- Execution order matters: tables → helper functions → policies.
-- ═══════════════════════════════════════════════════════════

-- ── 1. COMMUNITIES TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 300),
  avatar_url TEXT,
  cover_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_created ON communities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON communities(visibility, created_at DESC);

-- ── 2. COMMUNITY MEMBERS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'removed', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_community_membership UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON community_members(community_id, role);

-- ── 3. COMMUNITY RULES TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS community_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 3 AND 300),
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_rules_community ON community_rules(community_id, position);

-- ── 4. TOPICS (normalized interest topics, shared with future systems) ──
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Curated seed topics (generic interest categories — metadata, not fake activity)
INSERT INTO topics (name, slug) VALUES
  ('Gaming', 'gaming'),
  ('Movies', 'movies'),
  ('Football', 'football'),
  ('Technology', 'technology'),
  ('Music', 'music'),
  ('Memes', 'memes'),
  ('Relationships', 'relationships'),
  ('Unpopular Opinions', 'unpopular-opinions'),
  ('Business', 'business'),
  ('AI', 'ai'),
  ('Local Culture', 'local-culture'),
  ('TV & Streaming', 'tv-streaming'),
  ('Fitness', 'fitness'),
  ('Food', 'food'),
  ('Travel', 'travel'),
  ('Crypto & Web3', 'crypto-web3'),
  ('Anime', 'anime'),
  ('Books', 'books'),
  ('Cars', 'cars'),
  ('Sports', 'sports')
ON CONFLICT (slug) DO NOTHING;

-- ── 5. COMMUNITY ↔ TOPIC ASSOCIATION ─────────────────────────
CREATE TABLE IF NOT EXISTS community_topics (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (community_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_community_topics_topic ON community_topics(topic_id);

-- ── 6. SOCIAL POSTS ↔ COMMUNITY (canonical content stays in social_posts) ──
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_community ON social_posts(community_id, created_at DESC);

-- ── 7. COMMUNITY ROLE HELPERS (security definer) ─────────────
-- Used by RLS policies so the database itself enforces role rules.

CREATE OR REPLACE FUNCTION public.is_community_member(community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community
      AND user_id = auth.uid()
      AND membership_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_moderator(community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community
      AND user_id = auth.uid()
      AND membership_status = 'active'
      AND role IN ('owner', 'admin', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_owner(community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community
      AND user_id = auth.uid()
      AND membership_status = 'active'
      AND role = 'owner'
  );
$$;

-- ── 8. COMMUNITY POST DETACHMENT (security definer RPC) ──────
-- Lets a community moderator detach a post from their own community while
-- preserving the content record, author ownership, reactions, and comments.
-- The database validates the actor role — the app can never bypass this.

CREATE OR REPLACE FUNCTION public.community_detach_post(community uuid, post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  attached uuid;
BEGIN
  -- Actor must be an active owner/moderator of this community
  SELECT role INTO actor_role FROM community_members
    WHERE community_id = community
      AND user_id = auth.uid()
      AND membership_status = 'active';

  IF actor_role IS NULL OR actor_role NOT IN ('owner', 'admin', 'moderator') THEN
    RETURN false;
  END IF;

  -- Post must currently belong to this community
  SELECT community_id INTO attached FROM social_posts WHERE id = post_id;
  IF attached IS DISTINCT FROM community THEN
    RETURN false;
  END IF;

  UPDATE social_posts SET community_id = NULL, updated_at = now() WHERE id = post_id;
  RETURN true;
END;
$$;

-- ── 9. ROW LEVEL SECURITY ────────────────────────────────────

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Public (and private-for-members) reads; app layer filters private
CREATE POLICY "Public can read communities" ON communities
  FOR SELECT USING (visibility = 'public' OR is_community_member(id));

-- Creators create their own community (creator becomes owner via members row)
CREATE POLICY "Users create communities" ON communities
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Only owners can edit community details
CREATE POLICY "Owners update communities" ON communities
  FOR UPDATE USING (is_community_owner(id));

-- Only owners can delete communities
CREATE POLICY "Owners delete communities" ON communities
  FOR DELETE USING (is_community_owner(id));

ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

-- Membership lists are readable (app layer restricts for private communities)
CREATE POLICY "Public can read memberships" ON community_members
  FOR SELECT USING (true);

-- Users can only add themselves
CREATE POLICY "Users join communities" ON community_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Role changes are owner-only (app layer also enforces; DB is source of truth)
CREATE POLICY "Owners change roles" ON community_members
  FOR UPDATE USING (is_community_owner(community_id));

-- Users can leave; owners/moderators can remove others (app layer protects owners)
CREATE POLICY "Users can leave" ON community_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR is_community_owner(community_id)
    OR is_community_moderator(community_id)
  );

ALTER TABLE community_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read rules" ON community_rules
  FOR SELECT USING (true);

-- Owners and moderators manage rules
CREATE POLICY "Moderators manage rules" ON community_rules
  FOR INSERT WITH CHECK (is_community_moderator(community_id));

CREATE POLICY "Moderators update rules" ON community_rules
  FOR UPDATE USING (is_community_moderator(community_id));

CREATE POLICY "Moderators delete rules" ON community_rules
  FOR DELETE USING (is_community_moderator(community_id));

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read topics" ON topics
  FOR SELECT USING (true);

ALTER TABLE community_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read community topics" ON community_topics
  FOR SELECT USING (true);

-- Owners/moderators manage topic associations
CREATE POLICY "Moderators manage community topics" ON community_topics
  FOR INSERT WITH CHECK (is_community_moderator(community_id));

CREATE POLICY "Moderators delete community topics" ON community_topics
  FOR DELETE USING (is_community_moderator(community_id));

-- ── 10. EXTEND MODERATION AUDIT LOG for community actions ────
-- Non-destructive: drop + re-create CHECK constraints with expanded values.
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_action_type_check
  CHECK (action_type IN (
    'hide_roast', 'unhide_roast',
    'hide_hot_seat', 'unhide_hot_seat',
    'restrict_profile', 'unrestrict_profile',
    'ban_profile', 'unban_profile',
    'dismiss_report', 'resolve_report', 'escalate_report',
    'resolve_appeal', 'reverse_appeal',
    'community_remove_post', 'community_remove_member', 'community_role_changed'
  ));

ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_target_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_target_type_check
  CHECK (target_type IN (
    'roast', 'hot_seat', 'battle', 'profile', 'report', 'appeal',
    'community', 'community_member', 'social_post'
  ));

-- ── 11. REALTIME (communities only — feeds stay request-driven) ──
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE communities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- DONE — Communities schema created (additive only)
-- ═══════════════════════════════════════════════════════════