/**
 * BURN BOARD — Guardrail Metrics API
 * 
 * Reports guardrail metrics for active experiments.
 * Ensures experiments don't improve one metric while damaging the product.
 * 
 * GET /api/growth/guardrails                    - Get all guardrail metrics
 * GET /api/growth/guardrails?experiment=key     - Get guardrails for specific experiment
 */

import { NextResponse } from 'next/server';
import { getGuardrailMetrics } from '@/lib/experimentService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const experimentKey = searchParams.get('experiment');

    if (experimentKey) {
      const result = await getGuardrailMetrics(experimentKey);

      if (!result.data) {
        return NextResponse.json(
          { error: 'Experiment not found or no data' },
          { status: 404 }
        );
      }

      return NextResponse.json(result.data);
    }

    // Return summary of all guardrails for active experiments
    return NextResponse.json({
      message: 'Provide experiment=key query parameter for specific experiment guardrails',
      supportedMetrics: [
        'error_rate',
        'failed_submission_rate',
        'moderation_rejection_rate',
        'page_performance',
        'bounce_rate',
        'dismiss_rate',
        'notification_opt_out_rate',
      ],
      thresholds: {
        error_rate: { max: 5, unit: '%' },
        failed_submission_rate: { max: 3, unit: '%' },
        moderation_rejection_rate: { max: 10, unit: '%' },
        page_performance: { max: 3000, unit: 'ms' },
        bounce_rate: { max: 80, unit: '%' },
        dismiss_rate: { max: 50, unit: '%' },
        notification_opt_out_rate: { max: 5, unit: '%' },
      },
    });

  } catch (error) {
    console.error('[Guardrails API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
