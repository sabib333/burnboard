-- Add savage_level column to roasts table
-- Values: mild, savage, toxic, bangla
-- Default: savage (most common level on the platform)

ALTER TABLE roasts ADD COLUMN IF NOT EXISTS savage_level TEXT DEFAULT 'savage';

-- Add check constraint for valid values
DO $$ BEGIN
  ALTER TABLE roasts ADD CONSTRAINT roasts_savage_level_check
    CHECK (savage_level IN ('mild', 'savage', 'toxic', 'bangla'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add index for filtering by savage level
CREATE INDEX IF NOT EXISTS idx_roasts_savage_level ON roasts(savage_level);

-- Update existing roasts to have a savage_level based on reaction patterns
-- Roasts with high brutal reactions get 'toxic', others stay 'savage'
UPDATE roasts
SET savage_level = CASE
  WHEN reaction_brutal > 5 THEN 'toxic'
  WHEN reaction_brutal > 2 THEN 'savage'
  WHEN upvotes < 2 AND reaction_brutal = 0 THEN 'mild'
  ELSE 'savage'
END
WHERE savage_level IS NULL OR savage_level = 'savage';
