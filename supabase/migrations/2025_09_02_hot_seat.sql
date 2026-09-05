-- ============================================================
-- BURN BOARD — HOT SEAT FEATURE (Master Prompt #2)
-- Additive-only migration. No existing tables modified.
-- Run this in Supabase SQL Editor
-- ============================================================

-- HOT SEATS TABLE
CREATE TABLE IF NOT EXISTS hot_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT 'Anonymous',
  category TEXT NOT NULL CHECK (category IN (
    'photo', 'vibe', 'bio', 'outfit', 'idea',
    'dating_profile', 'music_taste', 'hot_take'
  )),
  title TEXT NOT NULL,
  context TEXT DEFAULT '',
  image_url TEXT DEFAULT NULL,
  heat_level TEXT NOT NULL DEFAULT 'savage' CHECK (heat_level IN ('light', 'savage', 'brutal')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'deleted')),
  roast_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HOT SEAT ROASTS TABLE
CREATE TABLE IF NOT EXISTS hot_seat_roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_seat_id UUID REFERENCES hot_seats(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL CHECK (char_length(roast_text) <= 280),
  anon_id TEXT NOT NULL DEFAULT 'Anonymous Roaster',
  ip_hash TEXT,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_hot_seats_creator ON hot_seats(creator_id);
CREATE INDEX IF NOT EXISTS idx_hot_seats_status ON hot_seats(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_seats_created ON hot_seats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_seat_roasts_seat ON hot_seat_roasts(hot_seat_id);
CREATE INDEX IF NOT EXISTS idx_hot_seat_roasts_created ON hot_seat_roasts(hot_seat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_seat_roasts_ip ON hot_seat_roasts(ip_hash);

-- ROW LEVEL SECURITY
ALTER TABLE hot_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seat_roasts ENABLE ROW LEVEL SECURITY;

-- Hot Seats: public read, anyone can insert (anon or auth)
DO $$ BEGIN
  CREATE POLICY "Public read hot seats" ON hot_seats
    FOR SELECT USING (status != 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can create hot seats" ON hot_seats
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Creators can update own hot seats" ON hot_seats
    FOR UPDATE USING (
      auth.uid() = creator_id OR creator_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Creators can delete own hot seats" ON hot_seats
    FOR DELETE USING (
      auth.uid() = creator_id OR creator_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Hot Seat Roasts: public read, anyone can insert
DO $$ BEGIN
  CREATE POLICY "Public read hot seat roasts" ON hot_seat_roasts
    FOR SELECT USING (is_hidden = false);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can submit hot seat roasts" ON hot_seat_roasts
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- REALTIME for hot seat roasts (live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roasts;

-- ============================================================
-- DONE — Hot Seat tables created
-- ============================================================
