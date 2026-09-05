'use client';

/**
 * BURNBOARD — useAdminAuth hook (Master Prompt 26)
 *
 * Client-side admin gate for admin dashboards. Security properties:
 *   - No secret is ever embedded in the client bundle.
 *   - The typed password is verified server-side (POST /api/admin/verify).
 *   - On success the secret lives only in React state (memory) for the
 *     duration of the page — it is never persisted to localStorage or
 *     sessionStorage and never auto-unlocked from storage.
 *   - When ADMIN_PASSWORD is not configured server-side, the hook reports
 *     `configured: false` and the page shows an explicit configuration state
 *     instead of accepting a default password.
 */

import { useState, useCallback, useRef } from 'react';

const initialState = { status: 'locked' };

export function useAdminAuth() {
  const [state, setState] = useState(initialState);
  const busyRef = useRef(false);

  const unlock = useCallback(async (password) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ status: 'busy' });
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password || '',
        },
        cache: 'no-store',
      });

      if (res.status === 503) {
        // Fail closed on the server — never accept a default locally.
        setState({
          status: 'unconfigured',
          error: 'Admin access is not configured on this deployment. Set ADMIN_PASSWORD in the environment to enable the dashboard.',
        });
        return;
      }
      if (!res.ok) {
        setState({
          status: 'denied',
          error: res.status === 429
            ? 'Too many attempts — try again in a few minutes.'
            : 'Invalid admin password.',
        });
        return;
      }
      // Secret kept in memory only, for admin API headers on this page.
      setState({ status: 'unlocked', secret: password });
    } catch (err) {
      setState({ status: 'denied', error: 'Could not reach the verification endpoint. Try again.' });
    } finally {
      busyRef.current = false;
    }
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  return {
    authenticated: state.status === 'unlocked',
    secret: state.status === 'unlocked' ? state.secret : null,
    busy: state.status === 'busy',
    denied: state.status === 'denied',
    configured: state.status !== 'unconfigured',
    error: state.error || null,
    unlock,
    reset,
  };
}
