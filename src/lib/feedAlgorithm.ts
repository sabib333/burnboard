/**
 * BURNBOARD Feed Algorithm — Instagram-Grade Personalization
 *
 * 7 scoring pillars inspired by Instagram's algorithm:
 * 1. Relationship (35%) — Following, DMs, roasts, views
 * 2. Interest (25%) — Platform preference from real interactions
 * 3. Timeliness (20%) — Exponential decay, fresh content boost
 * 4. Engagement (10%) — Log-scaled virality (roasts + upvotes + reactions)
 * 5. Velocity (7%) — Trending speed (roasts/upvotes in last 3h)
 * 6. Karma Boost — High-karma users get verified-like boost
 * 7. Diversity Penalty — Never show same person too many times
 */

import { Profile, Roast } from '../types';

// ── Types ────────────────────────────────────────────────────

export interface UserSignals {
  followingIds: Set<string>;
  viewedIds: Set<string>;
  upvotedIds: Set<string>;
  roastedIds: Set<string>;
  dmIds: Set<string>;
  reactionIds: Set<string>;
  favoritePlatform: string | null;
  platformUpvotes: Record<string, number>;
  platformRoasts: Record<string, number>;
  recentFeedUserIds: string[];
}

export interface FeedCandidate extends Profile {
  roasts?: Roast[];
  user_karma?: number;
  is_following_you?: boolean;
  reaction_brutal?: number;
  reaction_haha?: number;
  reaction_cry?: number;
  recent_roasts_3h?: number;
  recent_upvotes_3h?: number;
}

export interface ScoreBreakdown {
  relationship: number;
  interest: number;
  timeliness: number;
  engagement: number;
  velocity: number;
  karmaBoost: number;
  diversityPenalty: number;
  total: number;
}

export interface FeedWeights {
  relationship: number;
  interest: number;
  timeliness: number;
  engagement: number;
  velocity: number;
}

// Default weights (Instagram-tuned)
const DEFAULT_WEIGHTS: FeedWeights = {
  relationship: 0.35,
  interest: 0.25,
  timeliness: 0.20,
  engagement: 0.10,
  velocity: 0.07,
};

// ── Core Scoring ─────────────────────────────────────────────

/**
 * Calculate Instagram-grade relevance score for a profile.
 * Returns { score, breakdown } where breakdown shows each pillar.
 */
export function calculateScore(
  profile: FeedCandidate,
  userSignals: UserSignals,
  weights: FeedWeights = DEFAULT_WEIGHTS
): { score: number; breakdown: ScoreBreakdown } {
  const now = Date.now();
  const ageHours = (now - new Date(profile.created_at).getTime()) / (1000 * 60 * 60);

  // 1. RELATIONSHIP SCORE (Instagram's #1 signal) — 0 to 100
  let relationship = 0;
  if (userSignals.followingIds.has(profile.user_id || '')) relationship += 100;
  if (userSignals.dmIds.has(profile.user_id || '')) relationship += 80;
  if (userSignals.roastedIds.has(profile.id)) relationship += 60;
  if (userSignals.viewedIds.has(profile.id)) relationship += 10;
  if (profile.is_following_you) relationship += 40;
  relationship = Math.min(relationship, 100);

  // 2. INTEREST SCORE (Instagram's #2 — platform affinity) — 0 to 100
  let interest = 0;
  const favPlatform = userSignals.favoritePlatform;
  if (favPlatform && profile.platform?.toLowerCase() === favPlatform.toLowerCase()) {
    interest += 50;
  }
  // Boost for platform the user has upvoted roasts on
  const platformUpvotes = userSignals.platformUpvotes[profile.platform] || 0;
  interest += Math.min(platformUpvotes * 5, 40);
  // Boost for platform the user has roasted on
  const platformRoasts = userSignals.platformRoasts[profile.platform] || 0;
  interest += Math.min(platformRoasts * 10, 50);
  interest = Math.min(interest, 100);

  // 3. TIMELINESS SCORE — Exponential decay (Instagram-style)
  // 100 at 0h, ~37 at 24h, ~14 at 48h, ~5 at 72h
  const timeliness = Math.exp(-ageHours / 24) * 100;

  // 4. ENGAGEMENT SCORE — Log-scaled virality
  // Prevents 1000 upvotes from being 100x more than 10
  const engagementRaw =
    (profile.roast_count || 0) * 2 +
    (profile.total_upvotes || 0) +
    ((profile.reaction_brutal || 0) * 1.5) +
    (profile.reaction_haha || 0) +
    (profile.reaction_cry || 0) * 0.5;
  const engagement = Math.log10(engagementRaw + 1) * 50;

  // 5. VELOCITY SCORE — Instagram Reels trending logic
  // How fast is this profile gaining roasts/upvotes in last 3 hours?
  const velocity =
    ((profile.recent_roasts_3h || 0) * 30) +
    ((profile.recent_upvotes_3h || 0) * 20);

  // 6. KARMA BOOST — Instagram verified-like boost
  const karmaBoost = profile.user_karma
    ? Math.min(profile.user_karma / 10, 30)
    : 0;

  // 7. DIVERSITY PENALTY — Never show same person 5 times in a row
  let diversityPenalty = 0;
  const recentIds = userSignals.recentFeedUserIds;
  const last3 = recentIds.slice(-3);
  const last5 = recentIds.slice(-5);

  if (last3.includes(profile.user_id || '')) diversityPenalty -= 50;
  const duplicateCount = last5.filter(id => id === (profile.user_id || '')).length;
  if (duplicateCount >= 2) diversityPenalty -= 100;

  // FINAL WEIGHTED SCORE
  const total =
    relationship * weights.relationship +
    interest * weights.interest +
    timeliness * weights.timeliness +
    engagement * weights.engagement +
    velocity * weights.velocity +
    karmaBoost +
    diversityPenalty +
    Math.random() * 5; // Small random jitter to avoid deterministic feed

  return {
    score: total,
    breakdown: {
      relationship,
      interest,
      timeliness,
      engagement,
      velocity,
      karmaBoost,
      diversityPenalty,
      total,
    },
  };
}

/**
 * Get user's favorite platform from interactions.
 */
export function getFavoritePlatform(
  interactions: Array<{ action: string; platform?: string }>
): string | null {
  const counts: Record<string, number> = {};
  interactions
    .filter(i => i.action === 'roast' && i.platform)
    .forEach(i => {
      counts[i.platform!] = (counts[i.platform!] || 0) + 1;
    });

  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
}

/**
 * Build user signals from raw interactions and follows.
 */
export function buildUserSignals(
  interactions: any[],
  followingIds: string[],
  recentFeedUserIds: string[] = []
): UserSignals {
  const viewedIds = new Set<string>();
  const upvotedIds = new Set<string>();
  const roastedIds = new Set<string>();
  const dmIds = new Set<string>();
  const reactionIds = new Set<string>();
  const platformUpvotes: Record<string, number> = {};
  const platformRoasts: Record<string, number> = {};

  for (const inter of interactions) {
    switch (inter.action) {
      case 'view':
        if (inter.target_profile_id) viewedIds.add(inter.target_profile_id);
        break;
      case 'upvote':
        if (inter.target_profile_id) upvotedIds.add(inter.target_profile_id);
        if (inter.platform) platformUpvotes[inter.platform] = (platformUpvotes[inter.platform] || 0) + 1;
        break;
      case 'roast':
        if (inter.target_profile_id) roastedIds.add(inter.target_profile_id);
        if (inter.platform) platformRoasts[inter.platform] = (platformRoasts[inter.platform] || 0) + 1;
        break;
      case 'dm':
        if (inter.target_user_id) dmIds.add(inter.target_user_id);
        break;
      case 'reaction':
        if (inter.target_profile_id) reactionIds.add(inter.target_profile_id);
        break;
    }
  }

  return {
    followingIds: new Set(followingIds),
    viewedIds,
    upvotedIds,
    roastedIds,
    dmIds,
    reactionIds,
    favoritePlatform: getFavoritePlatform(interactions),
    platformUpvotes,
    platformRoasts,
    recentFeedUserIds,
  };
}

/**
 * Calculate recent velocity (last 3 hours) from roasts.
 */
export function calculateVelocity(
  roasts: Roast[],
  profileId: string
): { recent_roasts_3h: number; recent_upvotes_3h: number } {
  const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
  const recentRoasts = roasts.filter(
    r => r.profile_id === profileId && new Date(r.created_at).getTime() > threeHoursAgo
  );

  return {
    recent_roasts_3h: recentRoasts.length,
    recent_upvotes_3h: recentRoasts.reduce((sum, r) => sum + (r.upvotes || 0), 0),
  };
}

/**
 * Instagram-style re-ranking for diversity.
 * If same user appears twice within 5 slots, push second occurrence down.
 * If same platform appears 4 times in a row, inject different platform.
 */
export function rerankFeed(
  feed: Array<{ score: number; profile: FeedCandidate; breakdown: ScoreBreakdown }>
): Array<{ score: number; profile: FeedCandidate; breakdown: ScoreBreakdown }> {
  const result = [...feed];
  const userIdPositions: Record<string, number[]> = {};

  // Pass 1: Push duplicate users down
  for (let i = 0; i < result.length; i++) {
    const userId = result[i].profile.user_id || result[i].profile.id;
    if (!userIdPositions[userId]) userIdPositions[userId] = [];
    userIdPositions[userId].push(i);
  }

  // For users appearing multiple times, push duplicates down
  for (const userId of Object.keys(userIdPositions)) {
    const positions = userIdPositions[userId];
    if (positions.length < 2) continue;

    // Check if duplicates are within 5 slots of each other
    for (let j = 1; j < positions.length; j++) {
      const gap = positions[j] - positions[j - 1];
      if (gap <= 5) {
        // Push this card down 3 slots
        const card = result.splice(positions[j], 1)[0];
        const insertAt = Math.min(positions[j] + 3, result.length);
        result.splice(insertAt, 0, card);
      }
    }
  }

  // Pass 2: Break platform streaks (no 4 same platform in a row)
  for (let i = 3; i < result.length; i++) {
    const platforms = [
      result[i - 3].profile.platform,
      result[i - 2].profile.platform,
      result[i - 1].profile.platform,
      result[i].profile.platform,
    ];

    const allSame = platforms.every(p => p === platforms[0]);
    if (allSame) {
      // Find a different platform card further down and swap
      for (let j = i + 1; j < result.length; j++) {
        if (result[j].profile.platform !== platforms[0]) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Generate a "Why this?" tooltip explanation from the breakdown.
 */
export function getScoreExplanation(
  breakdown: ScoreBreakdown,
  profile: FeedCandidate,
  userSignals: UserSignals
): string {
  const reasons: string[] = [];

  if (breakdown.relationship > 60) {
    if (userSignals.followingIds.has(profile.user_id || '')) {
      reasons.push('You follow them');
    } else if (userSignals.roastedIds.has(profile.id)) {
      reasons.push('You roasted this target');
    }
  }

  if (breakdown.interest > 40) {
    if (profile.platform === userSignals.favoritePlatform) {
      reasons.push(`You love roasting ${profile.platform} profiles`);
    }
    const upvotes = userSignals.platformUpvotes[profile.platform] || 0;
    if (upvotes >= 3) {
      reasons.push(`You upvoted ${upvotes} ${profile.platform} roasts`);
    }
  }

  if (breakdown.velocity > 30) {
    reasons.push('Trending right now 🔥');
  }

  if (breakdown.engagement > 40) {
    reasons.push('Highly roasted target');
  }

  if (breakdown.karmaBoost > 15) {
    reasons.push('High-karma roaster');
  }

  if (reasons.length === 0) {
    reasons.push('Popular on BURNBOARD');
  }

  return reasons.slice(0, 2).join(' • ');
}
