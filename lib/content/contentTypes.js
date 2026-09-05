/**
 * BurnBoard Content Type Registry
 * 
 * Centralized configuration for all content types.
 * Each type defines its metadata, validation rules, interactions, and rendering hints.
 * 
 * New content types can be added by extending this registry
 * without rewriting the entire feed system.
 */

export const CONTENT_TYPES = {
  ROAST: 'roast',
  OPINION: 'opinion',
  QUESTION: 'question',
  POLL: 'poll',
  PHOTO: 'photo',
  HOT_TAKE: 'hot_take',
};

/**
 * Content type definitions.
 * Each type specifies:
 *   - label: Display name
 *   - icon: Emoji or icon identifier
 *   - description: Help text for creation
 *   - maxLength: Maximum content length
 *   - minLength: Minimum content length
 *   - supportsMedia: Whether image upload is supported
 *   - supportsContext: Whether additional context field is shown
 *   - interactions: Which interactions are supported
 *   - placeholder: Placeholder text for the content field
 *   - color: Theme color for the content type
 */
export const CONTENT_TYPE_CONFIG = {
  [CONTENT_TYPES.ROAST]: {
    label: 'Get Roasted',
    shortLabel: 'Roast',
    icon: '🔥',
    description: 'Put yourself or someone on the Hot Seat',
    maxLength: 280,
    minLength: 1,
    supportsMedia: false,
    supportsContext: false,
    interactions: { reactions: true, comments: true, share: true, upvote: true },
    placeholder: 'What do you want roasted?',
    color: '#ff4d00',
    // Roast uses its own creation flow — redirect to /hot-seat
    creationMode: 'redirect',
    creationPath: '/hot-seat',
  },

  [CONTENT_TYPES.OPINION]: {
    label: 'Share an Opinion',
    shortLabel: 'Opinion',
    icon: '💬',
    description: 'Share your thoughts with the community',
    maxLength: 500,
    minLength: 10,
    supportsMedia: true,
    supportsContext: true,
    interactions: { reactions: true, comments: true, share: true, upvote: true },
    placeholder: 'What\'s your opinion?',
    color: '#3b82f6',
    creationMode: 'inline',
  },

  [CONTENT_TYPES.QUESTION]: {
    label: 'Ask a Question',
    shortLabel: 'Question',
    icon: '❓',
    description: 'Get real opinions from real humans',
    maxLength: 500,
    minLength: 10,
    supportsMedia: true,
    supportsContext: true,
    interactions: { reactions: true, comments: true, share: true, upvote: true },
    placeholder: 'What\'s your question?',
    color: '#a855f7',
    creationMode: 'inline',
  },

  [CONTENT_TYPES.POLL]: {
    label: 'Create a Poll',
    shortLabel: 'Poll',
    icon: '🗳',
    description: 'Let the community decide',
    maxLength: 300,
    minLength: 5,
    supportsMedia: false,
    supportsContext: false,
    interactions: { vote: true, comments: true, share: true, upvote: true },
    placeholder: 'What do you want to ask?',
    color: '#f59e0b',
    creationMode: 'inline',
    minOptions: 2,
    maxOptions: 6,
  },

  [CONTENT_TYPES.PHOTO]: {
    label: 'Share a Photo',
    shortLabel: 'Photo',
    icon: '📸',
    description: 'Share an image with the community',
    maxLength: 500,
    minLength: 0,
    supportsMedia: true,
    supportsContext: false,
    interactions: { reactions: true, comments: true, share: true, upvote: true },
    placeholder: 'Add a caption...',
    color: '#ec4899',
    creationMode: 'inline',
    requiredMedia: true,
  },

  [CONTENT_TYPES.HOT_TAKE]: {
    label: 'Hot Take',
    shortLabel: 'Hot Take',
    icon: '🌶',
    description: 'A bold take designed to start a debate',
    maxLength: 280,
    minLength: 10,
    supportsMedia: false,
    supportsContext: false,
    interactions: { reactions: true, comments: true, share: true, upvote: true },
    placeholder: 'Drop your hottest take...',
    color: '#ef4444',
    creationMode: 'inline',
  },
};

/**
 * Get configuration for a content type
 */
export function getContentTypeConfig(type) {
  return CONTENT_TYPE_CONFIG[type] || null;
}

/**
 * Get all enabled content types for the create flow
 */
export function getCreatableContentTypes() {
  return Object.entries(CONTENT_TYPE_CONFIG)
    .filter(([key, config]) => config.creationMode !== 'disabled')
    .map(([key, config]) => ({
      type: key,
      ...config,
    }));
}

/**
 * Validate content for a given type
 */
export function validateContent(type, data) {
  const config = CONTENT_TYPE_CONFIG[type];
  if (!config) return { valid: false, error: 'Invalid content type' };

  // Check required text
  if (config.minLength > 0) {
    const text = data.text || data.content_text || '';
    if (text.trim().length < config.minLength) {
      return { valid: false, error: `Content must be at least ${config.minLength} characters` };
    }
    if (text.length > config.maxLength) {
      return { valid: false, error: `Content must be at most ${config.maxLength} characters` };
    }
  }

  // Check poll-specific validation
  if (type === CONTENT_TYPES.POLL) {
    const options = data.options || [];
    if (options.length < (config.minOptions || 2)) {
      return { valid: false, error: `Poll needs at least ${config.minOptions || 2} options` };
    }
    if (options.length > (config.maxOptions || 6)) {
      return { valid: false, error: `Poll can have at most ${config.maxOptions || 6} options` };
    }
    for (const opt of options) {
      if (!opt || !opt.trim()) {
        return { valid: false, error: 'All poll options must have text' };
      }
      if (opt.length > 100) {
        return { valid: false, error: 'Poll options must be under 100 characters' };
      }
    }
  }

  // Check photo-specific validation
  if (type === CONTENT_TYPES.PHOTO && config.requiredMedia) {
    if (!data.media_url && !data.mediaFile) {
      return { valid: false, error: 'Photo post requires an image' };
    }
  }

  return { valid: true };
}

/**
 * Get detail route for a content item
 */
export function getDetailRoute(item) {
  if (item.type === 'roast') {
    return `/r/${item.id}`;
  }
  return `/post/${item.id}`;
}
