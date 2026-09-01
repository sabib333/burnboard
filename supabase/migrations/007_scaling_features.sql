-- BURNBOARD Scaling Features Migration
-- Anti-spam, reports, and performance indexes

-- 1. Add reporter_ip column to reports table (for duplicate report prevention)
do $$ begin
  alter table reports add column reporter_ip text;
exception when duplicate_column then null;
end $$;

-- 2. Index on reports.roast_id for fast lookups
create index if not exists idx_reports_roast_id on reports(roast_id);
create index if not exists idx_reports_created_at on reports(created_at desc);
create index if not exists idx_reports_reporter_ip on reports(reporter_ip);

-- 3. Index on email_subscribers for fast notification lookups
create index if not exists idx_email_subscribers_profile on email_subscribers(profile_id);

-- 4. Index on blocked_ips for fast IP checks
create index if not exists idx_blocked_ips_hash on blocked_ips(ip_hash);

-- 5. Composite index for rate limiting queries
create index if not exists idx_roasts_ip_created on roasts(ip_hash, created_at desc);
create index if not exists idx_roasts_profile_created on roasts(profile_id, created_at desc);

-- 6. Index for pagination ordering
create index if not exists idx_profiles_pagination on profiles(created_at desc, id);

-- 7. Enable realtime on reports
alter publication supabase_realtime add table reports;
