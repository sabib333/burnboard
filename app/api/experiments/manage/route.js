/**
 * BURN BOARD — Experiment Management API
 * 
 * CRUD operations and lifecycle management for experiments.
 * All experiments are OFF by default. Must be explicitly activated.
 * 
 * GET    /api/experiments/manage         - List all experiments
 * POST   /api/experiments/manage         - Create new experiment
 * PATCH  /api/experiments/manage         - Update experiment status/config
 * DELETE /api/experiments/manage         - Archive experiment
 */

import { NextResponse } from 'next/server';
import {
  createExperiment,
  getAllExperiments,
  updateExperimentStatus,
  updateExperiment,
  seedDefaultExperiments,
} from '@/lib/experimentService';
import { checkAdminAccess, adminAccessResponse } from '@/lib/adminGate';
import { recordSecurityEvent } from '@/lib/securityEvents';

/**
 * Admin-only management surface (MP26 hardening). Experiments gate new
 * features behind an off-by-default status, so lifecycle control (activating
 * / pausing an experiment) is a privileged action — previously this route
 * was reachable without any authorization. Every handler now passes the
 * centralized admin gate; state changes are audited as security events.
 */

async function ensureAdmin(request) {
  const access = checkAdminAccess(request);
  if (!access.ok) return adminAccessResponse(access);
  return null;
}

export async function GET(request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  try {
    const result = await getAllExperiments();

    return NextResponse.json({
      experiments: result.data || [],
      count: (result.data || []).length,
    });

  } catch (error) {
    console.error('[Experiment Manage API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { action } = body;

    // Special action: seed default experiments
    if (action === 'seed') {
      const results = await seedDefaultExperiments();
      return NextResponse.json({
        success: true,
        results,
      });
    }

    // Create new experiment
    const { key, name, description, variants, primaryMetric, guardrailMetrics, startAt, endAt } = body;

    if (!key || !name) {
      return NextResponse.json(
        { error: 'key and name are required' },
        { status: 400 }
      );
    }

    if (!variants || variants.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 variants are required' },
        { status: 400 }
      );
    }

    const result = await createExperiment({
      key,
      name,
      description,
      variants,
      primaryMetric,
      guardrailMetrics,
      startAt,
      endAt,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      experiment: result.data,
    });

  } catch (error) {
    console.error('[Experiment Manage API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Experiment ID is required' },
        { status: 400 }
      );
    }

    // Audit lifecycle + config changes (best-effort, no sensitive data).
    recordSecurityEvent({
      action: 'admin_action',
      metadata: {
        surface: 'experiments',
        id: String(id || '').slice(0, 8),
        ...(status ? { change: 'status', to: String(status).slice(0, 24) } : { change: 'config' }),
      },
    });

    // Status change
    if (status) {
      const result = await updateExperimentStatus(id, status);
      
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        experiment: result.data,
      });
    }

    // Configuration update
    if (Object.keys(updates).length > 0) {
      const result = await updateExperiment(id, updates);
      
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        experiment: result.data,
      });
    }

    return NextResponse.json(
      { error: 'No status or updates provided' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Experiment Manage API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Experiment ID is required' },
        { status: 400 }
      );
    }

    // Archive instead of delete (preserve history)
    const result = await updateExperimentStatus(id, 'archived');
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Experiment archived',
      experiment: result.data,
    });

  } catch (error) {
    console.error('[Experiment Manage API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
