/**
 * BURNBOARD — Creator Growth Engine (Master Prompt 13)
 *
 * Centralized configuration: milestone definitions, content-type labels,
 * and time ranges used by the Creator Dashboard + milestone service.
 *
 * Everything here is metadata/labels — the actual thresholds live in the
 * SECURITY DEFINER function `ensure_creator_milestones` (SQL) so they can
 * never be bypassed or forged from the client. Keep the keys in sync with
 * the SQL function.
 */

export const CREATOR_MILESTONES = [
  { key: 'first_post',         icon: '✍️',  label: 'First post',        description: 'You shared your first post with BurnBoard.',               notify: '🎉 You made your first post on BurnBoard.' },
  { key: 'posts_10',           icon: '📝',  label: '10 posts',          description: 'Ten posts — you are finding your voice.',                  notify: '🔥 You have published 10 posts on BurnBoard.' },
  { key: 'posts_50',           icon: '⚡',  label: '50 posts',          description: 'Fifty posts. Consistent creators build audiences.',         notify: '⚡ 50 posts published — keep the momentum going.' },
  { key: 'posts_100',          icon: '🚀',  label: '100 posts',         description: 'A hundred posts. You are a real creator now.',              notify: '🚀 100 posts published on BurnBoard.' },
  { key: 'first_roast',        icon: '🔥',  label: 'First roast',       description: 'You delivered your first roast.',                          notify: '🔥 You delivered your first roast.' },
  { key: 'first_reaction',     icon: '⭐',  label: 'First reaction',    description: 'Someone reacted to your content for the first time.',      notify: '⭐ Someone reacted to your content for the first time.' },
  { key: 'reactions_100',      icon: '🎉',  label: '100 reactions',     description: 'Your content collected 100 reactions in total.',           notify: '🎉 Your content has earned 100 reactions.' },
  { key: 'first_comment',      icon: '💬',  label: 'First comment',     description: 'Someone started a conversation on your content.',          notify: '💬 You received your first comment.' },
  { key: 'first_follower',     icon: '🤝',  label: 'First follower',    description: 'Someone chose to follow you — an audience is forming.',     notify: '🤝 You gained your first follower.' },
  { key: 'followers_10',       icon: '🌟',  label: '10 followers',      description: 'Ten followers — people want more of what you make.',        notify: '🌟 You reached 10 followers.' },
  { key: 'followers_100',      icon: '📢',  label: '100 followers',     description: 'A hundred followers. You are building a real audience.',    notify: '📢 You reached 100 followers.' },
  { key: 'followers_1000',     icon: '👑',  label: '1,000 followers',   description: 'One thousand followers. Remarkable.',                       notify: '👑 You reached 1,000 followers.' },
];

export function getMilestoneDef(key) {
  return CREATOR_MILESTONES.find((m) => m.key === key) || null;
}

// Up to 3 honest, low-pressure "next" steps shown after the achieved list.
export const NEXT_MILESTONE_HINTS = [
  { key: 'first_post',     metric: 'posts',     target: 1,   hint: 'Make your first post' },
  { key: 'posts_10',       metric: 'posts',     target: 10,  hint: 'Reach 10 posts' },
  { key: 'posts_50',       metric: 'posts',     target: 50,  hint: 'Reach 50 posts' },
  { key: 'first_follower', metric: 'followers', target: 1,   hint: 'Earn your first follower' },
  { key: 'followers_10',   metric: 'followers', target: 10,  hint: 'Reach 10 followers' },
  { key: 'followers_100',  metric: 'followers', target: 100, hint: 'Reach 100 followers' },
  { key: 'first_reaction', metric: 'reactions', target: 1,   hint: 'Earn your first reaction' },
  { key: 'reactions_100',  metric: 'reactions', target: 100, hint: 'Reach 100 reactions' },
  { key: 'first_comment',  metric: 'comments',  target: 1,   hint: 'Earn your first comment' },
];

// Content-type labels used in the dashboard (neutral, descriptive).
export const CONTENT_TYPE_LABELS = {
  roast: 'Roast',
  hot_take: 'Hot Take',
  opinion: 'Opinion',
  question: 'Question',
  poll: 'Poll',
  photo: 'Photo',
  story: 'Story',
  debate: 'Debate',
};

export function getContentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || (type || 'Post');
}

// Time ranges offered by the dashboard (avoid expensive all-history scans).
export const ANALYTICS_RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: 'all', label: 'All time', days: 0 },
];

// Creator topics cap — controlled tagging, no unlimited noise.
export const MAX_CREATOR_TOPICS = 8;
