/**
 * BurnBoard Social — Type Definitions (JSDoc)
 * 
 * These are conceptual type definitions for the social platform entities.
 * BurnBoard uses JavaScript, so these serve as documentation and validation helpers.
 */

/**
 * @typedef {Object} SocialProfile
 * @property {string} id - User UUID (references auth.users)
 * @property {string} username - Unique username
 * @property {string} display_name - Display name
 * @property {string} avatar_url - Profile image URL
 * @property {string} bio - Short bio text
 * @property {string} visibility - 'public' | 'private'
 * @property {number} karma - Reputation score
 * @property {string} level - User level/rank
 * @property {number} follower_count - Number of followers
 * @property {number} following_count - Number of users following
 * @property {number} post_count - Total posts/content
 * @property {string} created_at - Account creation timestamp
 */

/**
 * @typedef {Object} SocialPost
 * @property {string} id - Post UUID
 * @property {string} user_id - Author UUID
 * @property {string} content_type - 'roast' | 'photo' | 'opinion' | 'poll' | 'question' | 'battle' | 'challenge'
 * @property {string} content_text - Post text content
 * @property {string} media_url - Optional media attachment
 * @property {Object} metadata - Content-type-specific data
 * @property {number} reaction_count - Total reactions
 * @property {number} comment_count - Total comments
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} Reaction
 * @property {string} id - Reaction UUID
 * @property {string} user_id - Reactor UUID
 * @property {string} target_type - 'post' | 'comment' | 'roast'
 * @property {string} target_id - Target entity UUID
 * @property {string} reaction_type - 'funny' | 'savage' | 'fatal' | 'fire' | 'love' | 'laugh' | 'mind_blown'
 * @property {string} created_at - Reaction timestamp
 */

/**
 * @typedef {Object} Comment
 * @property {string} id - Comment UUID
 * @property {string} user_id - Author UUID
 * @property {string} target_type - 'post' | 'roast'
 * @property {string} target_id - Target entity UUID
 * @property {string} text - Comment text
 * @property {string} parent_id - Parent comment UUID (for threading)
 * @property {number} upvotes - Upvote count
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} Follow
 * @property {string} id - Follow UUID
 * @property {string} follower_id - Follower UUID
 * @property {string} following_id - Followed user UUID
 * @property {string} created_at - Follow timestamp
 */

/**
 * @typedef {Object} ReputationEvent
 * @property {string} id - Event UUID
 * @property {string} user_id - User UUID
 * @property {string} event_type - 'roast_received' | 'roast_written' | 'upvote_given' | 'reaction_received' | 'follow_received' | 'battle_won' | 'challenge_completed'
 * @property {number} points - Points earned/deducted
 * @property {string} reference_id - Related entity UUID
 * @property {string} created_at - Event timestamp
 */

// ── Content Type Constants ──────────────────────────────────

export const CONTENT_TYPES = {
  ROAST: 'roast',
  PHOTO: 'photo',
  OPINION: 'opinion',
  POLL: 'poll',
  QUESTION: 'question',
  BATTLE: 'battle',
  CHALLENGE: 'challenge',
};

export const REACTION_TYPES = {
  FUNNY: 'funny',
  SAVAGE: 'savage',
  FATAL: 'fatal',
  FIRE: 'fire',
  LOVE: 'love',
  LAUGH: 'laugh',
  MIND_BLOWN: 'mind_blown',
};

export const PROFILE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

// ── Validation Helpers ──────────────────────────────────────

export function isValidContentType(type) {
  return Object.values(CONTENT_TYPES).includes(type);
}

export function isValidReactionType(type) {
  return Object.values(REACTION_TYPES).includes(type);
}

export function isValidVisibility(visibility) {
  return Object.values(PROFILE_VISIBILITY).includes(visibility);
}
