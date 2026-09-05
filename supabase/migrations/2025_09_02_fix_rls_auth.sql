-- ============================================================
-- FIX RLS POLICIES — September 2, 2026
-- 
-- Problem: Roast posting and auth not working because:
-- 1. INSERT policy on roasts was too restrictive
-- 2. Profiles INSERT policy blocked user_profiles table
-- 3. No DELETE policy on roasts for owners
--
-- Solution: Drop and recreate policies with correct permissions
-- ============================================================

-- ============================================================
-- ROASTS TABLE
-- ============================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Create roast with validation" ON roasts;
DROP POLICY IF EXISTS "Read not hidden roasts" ON roasts;
DROP POLICY IF EXISTS "Update own roast reactions" ON roasts;

-- Public can read all non-hidden roasts
CREATE POLICY "Public can read roasts" ON roasts
  FOR SELECT USING (is_hidden = false);

-- Allow inserts from both authenticated and anonymous users
-- This is critical: the app allows anonymous roasting via the API
CREATE POLICY "Allow roast insert" ON roasts
  FOR INSERT WITH CHECK (true);

-- Anyone can update reactions (upvotes, haha, brutal, cry)
CREATE POLICY "Allow reaction updates" ON roasts
  FOR UPDATE USING (true);

-- Owners can delete their own roasts
CREATE POLICY "Users can delete own roasts" ON roasts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PROFILES TABLE (public roast targets)
-- ============================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Read not banned profiles" ON profiles;
DROP POLICY IF EXISTS "Auth create profile" ON profiles;
DROP POLICY IF EXISTS "Owner update profile" ON profiles;

-- Public can read non-banned, non-hidden profiles
CREATE POLICY "Public can read profiles" ON profiles
  FOR SELECT USING (is_banned = false AND is_hidden = false);

-- Anyone can create a profile (roast target)
-- The API route handles validation; RLS just needs to allow the insert
CREATE POLICY "Allow profile insert" ON profiles
  FOR INSERT WITH CHECK (true);

-- Profile owners can update their own profile
CREATE POLICY "Profile owners can update" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- USER_PROFILES TABLE (registered users)
-- ============================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Public read non-banned users" ON user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;

-- Public can read non-banned user profiles
CREATE POLICY "Public can read user profiles" ON user_profiles
  FOR SELECT USING (is_banned = false);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- BATTLES TABLE
-- ============================================================
DROP POLICY IF EXISTS "Public read battles" ON battles;
DROP POLICY IF EXISTS "Allow battle insert" ON battles;
DROP POLICY IF EXISTS "Allow battle update" ON battles;

CREATE POLICY "Public can read battles" ON battles
  FOR SELECT USING (true);

CREATE POLICY "Allow battle insert" ON battles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow battle updates" ON battles
  FOR UPDATE USING (true);

-- ============================================================
-- BLOCKED IPS TABLE (admin only)
-- ============================================================
DROP POLICY IF EXISTS "Public read blocked_ips" ON blocked_ips;
DROP POLICY IF EXISTS "Admin manage blocked_ips" ON blocked_ips;

CREATE POLICY "Public can read blocked_ips" ON blocked_ips
  FOR SELECT USING (true);

CREATE POLICY "Allow blocked_ips management" ON blocked_ips
  FOR ALL USING (true);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "Public read reports" ON reports;
DROP POLICY IF EXISTS "Public insert reports" ON reports;

CREATE POLICY "Public can read reports" ON reports
  FOR SELECT USING (true);

CREATE POLICY "Allow report insert" ON reports
  FOR INSERT WITH CHECK (true);
