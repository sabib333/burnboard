export interface Profile {
  id: string;
  username: string;
  platform: 'X' | 'LinkedIn' | 'GitHub' | 'Instagram' | 'Indie Hacker' | 'TikTok' | 'Reddit' | string;
  bio: string;
  avatar_letter: string;
  avatar_color?: string;
  tagline?: string;
  featured?: boolean;
  roast_count: number;
  total_upvotes: number;
  reaction_brutal?: number;
  reaction_haha?: number;
  reaction_cry?: number;
  is_banned?: boolean;
  is_hidden?: boolean;
  url?: string;
  user_id?: string;
  ip_hash?: string;
  created_at: string;
  updated_at?: string;
  // Phase 2: Hot Seat
  hot_seat_token?: string;
  hot_seat_expires_at?: string;
  hot_seat_share_count?: number;
}

export interface Roast {
  id: string;
  profile_id: string;
  roast_text: string;
  upvotes: number;
  reaction_haha: number;
  reaction_brutal: number;
  reaction_cry: number;
  anon_id: string;
  user_id?: string;
  is_hidden?: boolean;
  is_clean?: boolean;
  ip_hash?: string;
  savage_level?: 'mild' | 'savage' | 'toxic' | 'bangla';
  created_at: string;
  userUpvoted?: boolean;
  userReactions?: {
    haha?: boolean;
    brutal?: boolean;
    cry?: boolean;
  };
  // Phase 3: Enhanced reactions
  reaction_savage?: number;
  reaction_king?: number;
  reaction_perfect?: number;
}

export interface Battle {
  id: string;
  profile1_id: string;
  profile2_id: string;
  votes1: number;
  votes2: number;
  is_active?: boolean;
  created_at: string;
}

export interface ReportItem {
  id: string;
  roast_id: string;
  reason: string;
  created_at: string;
  roast_text?: string;
  profile_username?: string;
}

export interface BlockedIP {
  ip_hash: string;
  reason: string;
  created_at: string;
}

export interface EmailSubscriber {
  id: string;
  profile_id: string;
  email: string;
  created_at: string;
}

export interface DailyWinner {
  id: string;
  profile_id: string;
  roast_id: string;
  date: string;
  roast_text?: string;
  username?: string;
  upvotes?: number;
}

export type KarmaLevel = 'Newbie' | 'Roaster' | 'Brutal' | 'Savage';

export interface UserKarma {
  anon_id: string;
  total_upvotes_received: number;
  total_roasts_given: number;
  level: KarmaLevel;
  badge: string;
  streak: number;
  last_active_date?: string;
  // Phase 4: Burn Score
  burn_score?: number;
  total_reactions_received?: number;
  total_battles_won?: number;
  total_challenges_completed?: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  reward: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  type: 'roast' | 'vote' | 'share';
}

export interface BattleHistoryItem {
  id: string;
  profile1_name: string;
  profile2_name: string;
  profile1_platform: string;
  profile2_platform: string;
  votes1: number;
  votes2: number;
  winner_name: string;
  completed_at: string;
}

export interface CountryRoastStat {
  code: string;
  name: string;
  flag: string;
  percentage: number;
  totalBurns: number;
  topPlatform: string;
  brutalityRating: number;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export type ViewMode = 'feed' | 'top' | 'battle' | 'profile' | 'submit' | 'platformSeo' | 'admin' | 'world' | 'privacy' | 'terms' | '404' | 'auth' | 'settings' | 'userProfile' | 'dm' | 'notifications' | 'explore' | 'adminFeed'
  // Phase 2
  | 'hotSeat'
  // Phase 5
  | 'burnReport'
  // Phase 6
  | 'challenges'
  // Phase 8
  | 'trending';

export interface Story {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  profile_id: string | null;
  text: string;
  background_color: string;
  view_count: number;
  is_hidden: boolean;
  created_at: string;
  expires_at: string;
}

export interface StoryWithMeta extends Story {
  is_viewed?: boolean;
  is_own?: boolean;
}

export interface RoastRemix {
  id: string;
  original_roast_id: string;
  original_profile_id: string | null;
  user_id: string | null;
  anon_id: string | null;
  remix_text: string;
  upvotes: number;
  created_at: string;
}

export interface RemixWithOriginal extends RoastRemix {
  original_roast_text?: string;
  original_anon_id?: string;
  profile_username?: string;
  profile_platform?: string;
}

// ============================================================
// PHASE 2: HOT SEAT
// ============================================================
export interface HotSeatSession {
  profile_id: string;
  token: string;
  expires_at: string;
  share_count: number;
  roast_count: number;
}

// ============================================================
// PHASE 3: ENHANCED REACTIONS
// ============================================================
export type ReactionType = 'haha' | 'brutal' | 'cry' | 'savage' | 'king' | 'perfect';

export interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
}

export const REACTION_CONFIGS: ReactionConfig[] = [
  { type: 'haha', emoji: '😂', label: 'Funny', color: '#eab308' },
  { type: 'brutal', emoji: '💀', label: 'Brutal', color: '#ef4444' },
  { type: 'cry', emoji: '😭', label: 'Cry', color: '#3b82f6' },
  { type: 'savage', emoji: '🔥', label: 'Savage', color: '#ff4d00' },
  { type: 'king', emoji: '👑', label: 'King', color: '#a855f7' },
  { type: 'perfect', emoji: '💯', label: 'Perfect', color: '#22c55e' },
];

// ============================================================
// PHASE 4: BURN SCORE
// ============================================================
export interface BurnScoreData {
  user_id: string;
  username: string;
  burn_score: number;
  level: KarmaLevel;
  total_roasts: number;
  total_upvotes: number;
  total_reactions: number;
  streak: number;
  rank?: number;
}

export interface BurnScoreBreakdown {
  roasts_score: number;
  upvotes_score: number;
  reactions_score: number;
  streak_bonus: number;
  battles_bonus: number;
  challenges_bonus: number;
  total: number;
}

// ============================================================
// PHASE 5: BURN REPORT
// ============================================================
export interface BurnReport {
  user_id: string;
  username: string;
  period: 'week' | 'month' | 'alltime';
  total_roasts_given: number;
  total_upvotes_received: number;
  total_reactions_received: number;
  top_roast: { text: string; upvotes: number } | null;
  burn_score: number;
  level: KarmaLevel;
  rank: number;
  generated_at: string;
}

// ============================================================
// PHASE 6: FRIEND CHALLENGES
// ============================================================
export type ChallengeType = 'roast_battle' | 'most_roasts' | 'most_upvotes' | 'karma_race';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'expired' | 'declined';

export interface UserChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_score: number;
  challenged_score: number;
  status: ChallengeStatus;
  challenge_type: ChallengeType;
  description: string | null;
  expires_at: string;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  challenger_username?: string;
  challenged_username?: string;
}

// ============================================================
// PHASE 7: ENHANCED BATTLES
// ============================================================
export interface BattleRound {
  id: string;
  battle_id: string;
  round_number: number;
  profile1_roast_id: string | null;
  profile2_roast_id: string | null;
  votes1: number;
  votes2: number;
  winner: 1 | 2 | null;
  created_at: string;
}

export interface BattleHistory {
  id: string;
  battle_id: string;
  profile1_id: string;
  profile2_id: string;
  winner_profile_id: string | null;
  total_votes1: number;
  total_votes2: number;
  round_count: number;
  completed_at: string;
}

// ============================================================
// PHASE 8: TRENDING
// ============================================================
export interface TrendingItem {
  type: 'profile' | 'roast' | 'battle';
  id: string;
  score: number;
  velocity: number;
  title: string;
  subtitle: string;
  platform?: string;
  created_at: string;
}

export interface TrendingFilters {
  timeWindow: '1h' | '6h' | '24h' | '7d';
  category: 'all' | 'profiles' | 'roasts' | 'battles';
  platform?: string;
}

// ============================================================
// PHASE 9: LEADERBOARDS
// ============================================================
export type LeaderboardCategory = 'alltime' | 'weekly' | 'daily' | 'monthly';
export type LeaderboardType = 'burn_score' | 'most_roasted' | 'funniest' | 'streak';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name?: string;
  burn_score: number;
  total_upvotes: number;
  total_roasts: number;
  level: KarmaLevel;
  streak: number;
  avatar_url?: string;
  trend?: 'up' | 'down' | 'same';
}

export interface LeaderboardSnapshot {
  id: string;
  user_id: string;
  username: string;
  burn_score: number;
  total_upvotes: number;
  total_roasts: number;
  level: string;
  category: LeaderboardCategory;
  snapshot_date: string;
}

// ============================================================
// PHASE 10: MODERATION
// ============================================================
export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
}

export interface ModerationRule {
  id: string;
  rule_type: 'word_filter' | 'rate_limit_escalation' | 'auto_hide' | 'shadowban';
  pattern: string;
  action: string;
  severity: number;
  enabled: boolean;
}

export type ModerationAction = 'flag' | 'hide' | 'ban_user' | 'ban_ip' | 'shadowban';
