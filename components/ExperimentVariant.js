'use client';

/**
 * BURN BOARD — Experiment Variant Component
 * 
 * Renders different UI variants based on experiment assignment.
 * Handles exposure tracking automatically.
 * 
 * Usage:
 * <ExperimentVariant experiment="homepage_cta" userId={userId}>
 *   <ExperimentVariant.Variant name="control">
 *     <button>Control CTA</button>
 *   </ExperimentVariant.Variant>
 *   <ExperimentVariant.Variant name="variant_a">
 *     <button>Variant A CTA</button>
 *   </ExperimentVariant.Variant>
 * </ExperimentVariant>
 */

import { useState, useEffect, Children, cloneElement, isValidElement } from 'react';
import { getVariant, isEligible, recordExposure, hasBeenExposed } from '@/lib/experiments';

function ExperimentVariant({ experiment, userId, children, fallback = null }) {
  const [variant, setVariant] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check eligibility
    const isUserEligible = isEligible(experiment, userId);
    setEligible(isUserEligible);
    
    if (isUserEligible) {
      // Get variant assignment
      const assignedVariant = getVariant(experiment, userId);
      setVariant(assignedVariant);
      
      // Record exposure if not already exposed
      if (assignedVariant && !hasBeenExposed(experiment, userId)) {
        recordExposure(experiment, assignedVariant, userId);
      }
    }
  }, [experiment, userId]);

  // Don't render until mounted (prevent hydration mismatch)
  if (!mounted) {
    return fallback;
  }

  // Not eligible or no variant - show fallback
  if (!eligible || !variant) {
    return fallback;
  }

  // Find matching variant child
  let matchedChild = null;
  
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === Variant && child.props.name === variant) {
      matchedChild = child;
    }
  });

  // If no matching variant found, show first variant as fallback
  if (!matchedChild) {
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === Variant && !matchedChild) {
        matchedChild = child;
      }
    });
  }

  return matchedChild || fallback;
}

// Variant sub-component
function Variant({ name, children }) {
  return children;
}

// Attach Variant to ExperimentVariant
ExperimentVariant.Variant = Variant;

export default ExperimentVariant;

// ── Simple Variant Hook ──────────────────────────────────────

/**
 * Hook to get experiment variant in any component.
 * 
 * Usage:
 * const variant = useExperiment('homepage_cta', userId);
 * 
 * return variant === 'variant_a' ? <ComponentA /> : <ComponentB />;
 */
export function useExperiment(experimentId, userId = null) {
  const [variant, setVariant] = useState(null);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const isUserEligible = isEligible(experimentId, userId);
    setEligible(isUserEligible);
    
    if (isUserEligible) {
      const assignedVariant = getVariant(experimentId, userId);
      setVariant(assignedVariant);
      
      // Record exposure
      if (assignedVariant && !hasBeenExposed(experimentId, userId)) {
        recordExposure(experimentId, assignedVariant, userId);
      }
    }
  }, [experimentId, userId]);

  return { variant, eligible };
}
