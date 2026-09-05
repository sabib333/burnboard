/**
 * BURN BOARD — Experimentation Service
 * 
 * Provides A/B testing foundation for growth experiments.
 * 
 * Features:
 * - Stable variant assignment (deterministic hash-based)
 * - Exposure tracking
 * - Conversion measurement
 * - Guardrail metrics
 * - Experiment lifecycle management
 * 
 * Privacy:
 * - No fingerprinting
 * - Uses existing identity (auth or session)
 * - Aggregate reporting only
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { track } from '@/lib/analytics';

// ── Experiment Status ────────────────────────────────────────
export const EXPERIMENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

// ── Default Experiments (configuration-based) ────────────────
// Experiments are defined here for now. In production, these would come from DB.
const EXPERIMENTS = {
  // Homepage CTA experiment
  homepage_cta: {
    id: 'homepage_cta',
    name: 'Homepage Primary CTA',
    status: EXPERIMENT_STATUS.DRAFT,
    variants: ['control', 'variant_a', 'variant_b'],
    primaryMetric: 'hot_seat_creation_started',
    guardrailMetrics: ['error_rate', 'bounce_rate'],
    startAt: null,
    endAt: null,
    description: 'Testing different CTA copy for homepage',
  },
  
  // Onboarding flow experiment
  onboarding_flow: {
    id: 'onboarding_flow',
    name: 'Onboarding Sequence',
    status: EXPERIMENT_STATUS.DRAFT,
    variants: ['explore_first', 'create_first'],
    primaryMetric: 'activation_completed',
    guardrailMetrics: ['dismiss_rate'],
    startAt: null,
    endAt: null,
    description: 'Testing discovery vs creation first onboarding',
  },
  
  // Share prompt experiment
  share_prompt: {
    id: 'share_prompt',
    name: 'Share CTA Copy',
    status: EXPERIMENT_STATUS.DRAFT,
    variants: ['control', 'variant_a', 'variant_b'],
    primaryMetric: 'share_initiated',
    guardrailMetrics: [],
    startAt: null,
    endAt: null,
    description: 'Testing different share prompt messaging',
  },
};

// ── Stable Variant Assignment ────────────────────────────────
// Uses deterministic hash for consistent assignment

function generateAssignmentKey(experimentId, userId) {
  // Combine experiment ID with user identifier for stable hash
  const identifier = userId || getAnonymousId();
  return `${experimentId}:${identifier}`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function getAnonymousId() {
  if (typeof window === 'undefined') return 'server';
  
  const STORAGE_KEY = 'burnboard_experiment_anon_id';
  let anonId = localStorage.getItem(STORAGE_KEY);
  
  if (!anonId) {
    anonId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(STORAGE_KEY, anonId);
  }
  
  return anonId;
}

/**
 * Get variant assignment for a user in an experiment.
 * Returns null if experiment is not active or user is not eligible.
 */
export function getVariant(experimentId, userId = null) {
  const experiment = EXPERIMENTS[experimentId];
  
  // Check experiment exists and is active
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE) {
    return null;
  }
  
  // Check if experiment has ended
  if (experiment.endAt && new Date(experiment.endAt) < new Date()) {
    return null;
  }
  
  // Check if experiment hasn't started
  if (experiment.startAt && new Date(experiment.startAt) > new Date()) {
    return null;
  }
  
  // Generate stable assignment
  const assignmentKey = generateAssignmentKey(experimentId, userId);
  const hash = hashString(assignmentKey);
  const variantIndex = hash % experiment.variants.length;
  
  return experiment.variants[variantIndex];
}

/**
 * Check if user is eligible for an experiment
 */
export function isEligible(experimentId, userId = null) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment) return false;
  if (experiment.status !== EXPERIMENT_STATUS.ACTIVE) return false;
  
  // Could add additional eligibility rules here
  // e.g., exclude certain user segments, geo, etc.
  
  return true;
}

// ── Exposure Tracking ────────────────────────────────────────

const STORAGE_KEY = 'burnboard_experiment_exposures';

function getExposures() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExposures(exposures) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exposures.slice(0, 100)));
  } catch {
    // Silent fail
  }
}

function getExposureKey(experimentId, variant, userId) {
  return `${experimentId}:${variant}:${userId || getAnonymousId()}`;
}

/**
 * Record that a user was exposed to an experiment variant.
 * Only records once per user per experiment.
 */
export function recordExposure(experimentId, variant, userId = null) {
  if (!variant) return;
  
  const exposures = getExposures();
  const exposureKey = getExposureKey(experimentId, variant, userId);
  
  // Check if already exposed
  const alreadyExposed = exposures.some(e => e.key === exposureKey);
  if (alreadyExposed) return;
  
  const exposure = {
    key: exposureKey,
    experimentId,
    variant,
    userId: userId || getAnonymousId(),
    timestamp: new Date().toISOString(),
  };
  
  exposures.unshift(exposure);
  saveExposures(exposures);
  
  // Track in analytics
  track('experiment_exposure', {
    experiment_id: experimentId,
    variant,
    timestamp: exposure.timestamp,
  });
}

/**
 * Check if user has been exposed to an experiment
 */
export function hasBeenExposed(experimentId, userId = null) {
  const exposures = getExposures();
  const anonId = userId || getAnonymousId();
  
  return exposures.some(e => 
    e.experimentId === experimentId && 
    (e.userId === anonId || e.userId === userId)
  );
}

// ── Conversion Tracking ──────────────────────────────────────

const CONVERSION_KEY = 'burnboard_experiment_conversions';

function getConversions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CONVERSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversions(conversions) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONVERSION_KEY, JSON.stringify(conversions.slice(0, 200)));
  } catch {
    // Silent fail
  }
}

/**
 * Record a conversion event for an experiment.
 * Only counts if user was previously exposed.
 */
export function recordConversion(experimentId, conversionEvent, userId = null, data = {}) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment) return false;
  
  // Verify exposure first
  if (!hasBeenExposed(experimentId, userId)) {
    return false;
  }
  
  const conversions = getConversions();
  const variant = getVariant(experimentId, userId);
  
  if (!variant) return false;
  
  // Check for duplicate conversion (same event, same user, same experiment)
  const conversionKey = `${experimentId}:${conversionEvent}:${userId || getAnonymousId()}`;
  const alreadyConverted = conversions.some(c => c.key === conversionKey);
  if (alreadyConverted) return false;
  
  const conversion = {
    key: conversionKey,
    experimentId,
    variant,
    event: conversionEvent,
    userId: userId || getAnonymousId(),
    timestamp: new Date().toISOString(),
    data,
  };
  
  conversions.unshift(conversion);
  saveConversions(conversions);
  
  // Track in analytics
  track('experiment_conversion', {
    experiment_id: experimentId,
    variant,
    event: conversionEvent,
    timestamp: conversion.timestamp,
  });
  
  return true;
}

// ── Experiment Lifecycle ─────────────────────────────────────

/**
 * Get experiment configuration
 */
export function getExperiment(experimentId) {
  return EXPERIMENTS[experimentId] || null;
}

/**
 * Get all experiments (for admin use)
 */
export function getAllExperiments() {
  return Object.values(EXPERIMENTS);
}

/**
 * Update experiment status (admin only - would need auth check in production)
 */
export function updateExperimentStatus(experimentId, newStatus) {
  if (!EXPERIMENTS[experimentId]) return false;
  
  // Validate status transition
  const validTransitions = {
    [EXPERIMENT_STATUS.DRAFT]: [EXPERIMENT_STATUS.ACTIVE],
    [EXPERIMENT_STATUS.ACTIVE]: [EXPERIMENT_STATUS.PAUSED, EXPERIMENT_STATUS.COMPLETED],
    [EXPERIMENT_STATUS.PAUSED]: [EXPERIMENT_STATUS.ACTIVE, EXPERIMENT_STATUS.COMPLETED],
    [EXPERIMENT_STATUS.COMPLETED]: [EXPERIMENT_STATUS.ARCHIVED],
  };
  
  const currentStatus = EXPERIMENTS[experimentId].status;
  const allowed = validTransitions[currentStatus] || [];
  
  if (!allowed.includes(newStatus)) {
    return false;
  }
  
  EXPERIMENTS[experimentId].status = newStatus;
  
  // Set timestamps
  if (newStatus === EXPERIMENT_STATUS.ACTIVE && !EXPERIMENTS[experimentId].startAt) {
    EXPERIMENTS[experimentId].startAt = new Date().toISOString();
  }
  if (newStatus === EXPERIMENT_STATUS.COMPLETED) {
    EXPERIMENTS[experimentId].endAt = new Date().toISOString();
  }
  
  return true;
}

// ── Reporting ────────────────────────────────────────────────

/**
 * Get experiment report (aggregate, no user-level data)
 */
export function getExperimentReport(experimentId) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment) return null;
  
  const exposures = getExposures().filter(e => e.experimentId === experimentId);
  const conversions = getConversions().filter(c => c.experimentId === experimentId);
  
  // Aggregate by variant
  const variantStats = {};
  
  for (const variant of experiment.variants) {
    const variantExposures = exposures.filter(e => e.variant === variant);
    const variantConversions = conversions.filter(c => c.variant === variant);
    
    variantStats[variant] = {
      exposures: variantExposures.length,
      conversions: variantConversions.length,
      conversionRate: variantExposures.length > 0 
        ? (variantConversions.length / variantExposures.length * 100).toFixed(2) + '%'
        : '0%',
    };
  }
  
  return {
    experimentId,
    name: experiment.name,
    status: experiment.status,
    description: experiment.description,
    variants: variantStats,
    primaryMetric: experiment.primaryMetric,
    guardrailMetrics: experiment.guardrailMetrics,
    startedAt: experiment.startAt,
    endedAt: experiment.endAt,
  };
}

/**
 * Get aggregate funnel metrics
 */
export function getFunnelMetrics() {
  const exposures = getExposures();
  const conversions = getConversions();
  
  return {
    totalExposures: exposures.length,
    totalConversions: conversions.length,
    conversionRate: exposures.length > 0 
      ? (conversions.length / exposures.length * 100).toFixed(2) + '%'
      : '0%',
  };
}

// ── Guardrail Checks ────────────────────────────────────────

/**
 * Check if a variation has triggered any guardrail metrics
 * Returns true if guardrails are violated (should stop experiment)
 */
export function checkGuardrails(experimentId, metricsData) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment || !experiment.guardrailMetrics) return false;
  
  // Simple guardrail checks
  // In production, this would compare against thresholds
  
  for (const metric of experiment.guardrailMetrics) {
    // Example: error_rate > 5% triggers guardrail
    if (metric === 'error_rate' && metricsData.errorRate > 5) {
      return true;
    }
    // Example: bounce_rate > 80% triggers guardrail
    if (metric === 'bounce_rate' && metricsData.bounceRate > 80) {
      return true;
    }
    // Example: dismiss_rate > 50% triggers guardrail
    if (metric === 'dismiss_rate' && metricsData.dismissRate > 50) {
      return true;
    }
  }
  
  return false;
}

// ── Server-Side Assignment (Async) ─────────────────────────

/**
 * Get variant assignment from server-side (DB-backed).
 * Falls back to local assignment if server is unavailable.
 * 
 * Usage:
 *   const variant = await getServerVariant('homepage_cta', userId);
 */
export async function getServerVariant(experimentKey, userId = null) {
  const subjectId = userId || getAnonymousId();
  
  try {
    const response = await fetch(`/api/experiments?experiment=${experimentKey}&userId=${encodeURIComponent(subjectId)}`);
    const data = await response.json();
    
    if (data.eligible && data.variant) {
      // Record server-side exposure
      if (!data.exposed) {
        await fetch('/api/experiments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experimentId: experimentKey,
            variant: data.variant,
            userId: subjectId,
          }),
        });
      }
      return data.variant;
    }
  } catch (err) {
    // Server unavailable, fall through to local assignment
    console.warn('[Experiments] Server assignment unavailable, using local:', err.message);
  }
  
  // Fallback to local deterministic assignment
  return getVariant(experimentKey, userId);
}

/**
 * Record server-side exposure.
 */
export async function recordServerExposure(experimentKey, variant, userId = null) {
  const subjectId = userId || getAnonymousId();
  
  // Also record locally
  recordExposure(experimentKey, variant, userId);
  
  try {
    await fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId: experimentKey,
        variant,
        userId: subjectId,
      }),
    });
  } catch {
    // Silent fail — local exposure already recorded
  }
}

/**
 * Record server-side conversion.
 */
export async function recordServerConversion(experimentKey, conversionEvent, userId = null, data = {}) {
  const subjectId = userId || getAnonymousId();
  
  // Also record locally
  recordConversion(experimentKey, conversionEvent, userId, data);
  
  // Server-side recording would go through a dedicated API endpoint
  // For now, local recording is the primary source
}

// ── Growth Event Tracking ────────────────────────────────────

/**
 * Record a growth funnel event (client-side).
 * Also sends to server for aggregate reporting.
 */
export async function trackGrowthEvent(eventType, metadata = {}) {
  // Track locally via existing analytics
  track(`growth_${eventType}`, metadata);
  
  // Send to server for aggregate reporting
  try {
    const subjectId = getAnonymousId();
    await fetch('/api/growth/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        subjectId,
        metadata,
      }),
    });
  } catch {
    // Silent fail — local tracking already happened
  }
}

// ── Utility ──────────────────────────────────────────────────

/**
 * Clear experiment data (for testing)
 */
export function clearExperimentData() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CONVERSION_KEY);
    localStorage.removeItem('burnboard_experiment_anon_id');
  } catch {
    // Silent fail
  }
}

/**
 * Get experiment data for debugging
 */
export function getExperimentData() {
  return {
    exposures: getExposures(),
    conversions: getConversions(),
    experiments: EXPERIMENTS,
  };
}
