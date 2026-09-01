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
  created_at: string;
  userUpvoted?: boolean;
  userReactions?: {
    haha?: boolean;
    brutal?: boolean;
    cry?: boolean;
  };
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

export type ViewMode = 'feed' | 'top' | 'battle' | 'profile' | 'submit' | 'platformSeo' | 'admin' | 'world' | 'privacy' | 'terms' | '404' | 'auth' | 'settings' | 'userProfile' | 'dm' | 'notifications' | 'explore' | 'adminFeed';

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

