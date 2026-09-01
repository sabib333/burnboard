-- BURNBOARD Notification Preferences — Per-Type Toggles
-- Run this in Supabase SQL Editor

-- Add missing notification preference columns
do $$ begin
  alter table user_profiles add column dm_alerts boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column upvote_alerts boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column levelup_alerts boolean default true;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table user_profiles add column battle_alerts boolean default true;
exception when duplicate_column then null;
end $$;
