/**
 * BURN BOARD — Experiments Report API
 * 
 * Internal reporting endpoint for experiment analytics.
 * 
 * GET /api/experiments/report - Get experiment report
 * GET /api/experiments/report?experiment=id - Get specific experiment
 * GET /api/experiments/report?funnel=true - Get funnel metrics
 */

import { NextResponse } from 'next/server';
import { 
  getExperimentReport, 
  getAllExperiments, 
  getFunnelMetrics 
} from '@/lib/experiments';

// Note: In production, this endpoint should be protected by admin auth
// For now, it's open for internal use during development

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experiment');
    const funnelOnly = searchParams.get('funnel') === 'true';
    
    // Return funnel metrics only
    if (funnelOnly) {
      const funnel = getFunnelMetrics();
      return NextResponse.json({
        type: 'funnel',
        metrics: funnel,
      });
    }
    
    // Return specific experiment report
    if (experimentId) {
      const report = getExperimentReport(experimentId);
      
      if (!report) {
        return NextResponse.json(
          { error: 'Experiment not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        type: 'experiment',
        report,
      });
    }
    
    // Return all experiments summary
    const experiments = getAllExperiments();
    const reports = experiments.map(exp => ({
      id: exp.id,
      name: exp.name,
      status: exp.status,
      variants: exp.variants,
    }));
    
    return NextResponse.json({
      type: 'list',
      experiments: reports,
    });
    
  } catch (error) {
    console.error('[Experiments Report API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
