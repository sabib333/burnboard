/**
 * Scope catalog — the ONLY scopes that exist on the BurnBoard platform.
 * Shared between server (gateway, consent RPC callers) and client surfaces
 * (settings/connected-apps page). No node built-ins here — client-safe.
 *
 * New scopes are added deliberately in this one place, then approved
 * per-app by the platform. There is no FULL_ACCESS scope, and no scope can
 * read another user's private data.
 */

export const SCOPES = {
  'profile.read': {
    label: 'Read your public profile',
    description: 'View your username, display name, bio, and avatar.',
  },
  'content.publish': {
    label: 'Publish content on your behalf',
    description: 'Create posts on BurnBoard as you. You can revoke this at any time.',
  },
  'content.read': {
    label: 'Read your public posts',
    description: 'List the posts you have published publicly.',
  },
};

export const SCOPE_KEYS = Object.keys(SCOPES);

export function scopeIsValid(scope) {
  return Object.prototype.hasOwnProperty.call(SCOPES, scope);
}

export function scopeLabel(scope) {
  return SCOPES[scope]?.label || scope;
}

export function scopeDescription(scope) {
  return SCOPES[scope]?.description || '';
}

export function filterValidScopes(requested) {
  if (!Array.isArray(requested)) return [];
  return [...new Set(requested.filter(scopeIsValid))];
}