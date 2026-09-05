'use client';

/**
 * BURN BOARD — Error Boundary
 * 
 * Catches JavaScript errors in child components.
 * Shows a user-friendly fallback instead of white screen.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */

import React from 'react';
import { Flame, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for observability (non-sensitive)
    console.error('[ErrorBoundary] Component error:', {
      message: error.message,
      componentStack: errorInfo?.componentStack?.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback
      return (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center space-y-3">
          <Flame className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">
            {this.props.title || 'Something went wrong'}
          </h3>
          <p className="text-xs text-zinc-400">
            {this.props.message || 'This section hit an error. The rest of the page still works.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded-xl text-[11px] font-mono font-bold text-zinc-300 hover:text-white transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
