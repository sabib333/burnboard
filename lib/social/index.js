/**
 * BurnBoard Social Platform — Foundation Layer
 * 
 * This module provides the core abstractions for the future social platform.
 * It is designed to work alongside existing BurnBoard functionality.
 * 
 * Architecture:
 *   social/
 *     types.js      — Social entity type definitions (JSDoc)
 *     profile.js    — User profile service helpers
 *     content.js    — Content abstraction (roasts, posts, polls, etc.)
 *     reactions.js  — Generic reaction system
 *     follows.js    — Follow/unfollow system
 *     feed.js       — Feed generation helpers
 *     reputation.js — Reputation scoring
 * 
 * Each module is independent and can be used without pulling in the entire social layer.
 */

export * from './types';
export * from './profile';
export * from './content';
export * from './reactions';
export * from './follows';
export * from './feed';
export * from './reputation';
