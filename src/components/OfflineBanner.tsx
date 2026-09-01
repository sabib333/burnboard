import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * OfflineBanner - Shows a full-screen offline page when network is unavailable.
 * Uses Capacitor Network plugin on native, navigator.onLine on web.
 */
export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check via Capacitor Network if available
    let networkListener: any = null;
    const setupCapacitorNetwork = async () => {
      try {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setIsOffline(!status.connected);

        networkListener = await Network.addListener('networkStatusChange', (status) => {
          setIsOffline(!status.connected);
        });
      } catch {
        // Not on native, fallback to browser events
      }
    };

    setupCapacitorNetwork();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkListener) networkListener.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="text-center space-y-6 max-w-xs">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-[#111] border border-[#222] flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-zinc-500" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white font-mono uppercase">
            You're Offline
          </h2>
          <p className="text-sm text-zinc-400 font-mono">
            No internet connection. The roast chamber requires fire (and bandwidth).
          </p>
        </div>

        {/* Fun message */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
          <p className="text-lg">🌿</p>
          <p className="text-xs text-zinc-500 font-mono italic mt-1">
            Go touch grass while you wait.
          </p>
        </div>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-sm uppercase rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>

        <p className="text-[10px] text-zinc-600 font-mono">
          BURNBOARD v1.0.0
        </p>
      </div>
    </div>
  );
};
