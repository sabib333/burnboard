/**
 * BURN BOARD — Experiments API
 * 
 * Handles experiment variant assignment and exposure tracking.
 * 
 * GET /api/experiments - Get variant for a user
 * POST /api/experiments - Record exposure
 */

import { NextResponse } from 'next/server';
import { getVariant, isEligible, recordExposure, hasBeenExposed } from '@/lib/experiments';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experiment');
    const userId = searchParams.get('userId');
    
    if (!experimentId) {
      return NextResponse.json(
        { error: 'Experiment ID required' },
        { status: 400 }
      );
    }
    
    // Check eligibility
    if (!isEligible(experimentId, userId)) {
      return NextResponse.json(
        { 
          experimentId,
          eligible: false,
          variant: null,
        },
        { status: 200 }
      );
    }
    
    // Get variant
    const variant = getVariant(experimentId, userId);
    const exposed = hasBeenExposed(experimentId, userId);
    
    return NextResponse.json({
      experimentId,
      eligible: true,
      variant,
      exposed,
    });
    
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { experimentId, variant, userId } = body;
    
    if (!experimentId || !variant) {
      return NextResponse.json(
        { error: 'Experiment ID and variant required' },
        { status: 400 }
      );
    }
    
    // Record exposure
    recordExposure(experimentId, variant, userId);
    
    return NextResponse.json({
      success: true,
      experimentId,
      variant,
    });
    
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
