-- BURNBOARD Notification Sounds — Per-Type Sound/Vibration Customization
-- Run this in Supabase SQL Editor

-- Add notification_sounds JSONB column to user_profiles
-- Stores per-type sound and vibration preferences
do $$ begin
  alter table user_profiles add column notification_sounds jsonb default '{
    "global_sound": true,
    "global_vibration": true,
    "roast": {"sound": true, "vibration": true},
    "follow": {"sound": true, "vibration": true},
    "dm": {"sound": true, "vibration": true},
    "upvote": {"sound": true, "vibration": true},
    "levelup": {"sound": true, "vibration": true},
    "battle": {"sound": true, "vibration": true}
  }'::jsonb;
exception when duplicate_column then null;
end $$;
