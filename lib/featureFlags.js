/**
 * BurnBoard Feature Flags
 * 
 * Simple environment-based feature flag system for safe, incremental rollout
 * of new social platform features. No complex infrastructure needed.
 * 
 * Usage:
 *   import { isFeatureEnabled } from '@/lib/featureFlags';
 *   if (isFeatureEnabled('social_feed')) { ... }
 * 
 * To enable a feature:
 *   1. Add NEXT_PUBLIC_FEATURE_* env var in .env.local
 *   2. Or enable it in the defaults below for development
 */

const FLAGS = {
  // Social platform foundation flags
  social_feed: true,
  social_profiles: true,
  social_follow: false,
  social_reactions_v2: true,
  social_comments: true,
  social_communities: false,
  social_challenges_v2: false,
  social_discover_v2: false,
  social_search: false,
  social_stories: false,
  social_reputation: false,

  // Navigation flags
  new_nav_shell: false,
  mobile_bottom_nav: true,

  // Content type flags
  content_polls: true,
  content_opinions: true,
  content_photos: true,
  content_hot_takes: true,
  content_questions: true,
};

/**
 * Check if a feature flag is enabled.
 * Priority: env var > defaults
 */
export function isFeatureEnabled(flag) {
  if (typeof window !== 'undefined') {
    // Client-side: check env var, then defaults
    const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal !== undefined) {
      return envVal === 'true' || envVal === '1';
    }
  }
  return FLAGS[flag] ?? false;
}

/**
 * Get all enabled features (useful for debugging)
 */
export function getEnabledFeatures() {
  return Object.keys(FLAGS).filter(key => isFeatureEnabled(key));
}

/**
 * Check if any social feature is enabled
 */
export function hasSocialFeatures() {
  return isFeatureEnabled('social_feed') || 
         isFeatureEnabled('social_profiles') || 
         isFeatureEnabled('social_follow');
}
