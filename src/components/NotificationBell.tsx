import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellRing, Check, CheckCheck, Flame, UserPlus, ArrowBigUp, Swords, Sparkles, MessageCircle, X } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NotificationItem, getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../lib/notify';
import { showBrowserNotification, isWebPushSupported } from '../lib/pushNotifications';
import { timeAgo } from '../lib/badWords';

interface NotificationBellProps {
  onNavigate?: (view: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);

  // SWR polling for notifications — fallback at 1M where realtime may be limited
  const { data: notifData, mutate: mutateNotifs } = useSWR(
    user ? `notif-bell:${user.id}` : null,
    async () => {
      if (!user) return { notifs: [], count: 0 };
      const [notifs, count] = await Promise.all([
        getNotifications(user.id, 15),
        getUnreadCount(user.id),
      ]);
      return { notifs, count };
    },
    {
      refreshInterval: 15000, // Poll every 15 seconds as fallback
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  useEffect(() => {
    if (notifData) {
      setNotifications(notifData.notifs);
      setUnreadCount(notifData.count);
    }
  }, [notifData]);

  // Supabase Realtime channel — LIVE push when app is open
  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;

    // Subscribe to INSERT events on notifications table for this user
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;

          // Update bell count
          setUnreadCount((prev) => prev + 1);

          // Prepend to notifications list
          setNotifications((prev) => [newNotif, ...prev].slice(0, 15));

          // Show browser notification if permission granted
          if (isWebPushSupported()) {
            showBrowserNotification(
              newNotif.title,
              newNotif.message,
              newNotif.link || undefined,
              newNotif.type,
              user.id
            );
          }

          // Haptic feedback
          try { navigator.vibrate?.(50); } catch {}
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Refetch when notifications are updated (mark read, etc.)
          mutateNotifs();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, isSupabaseConfigured, supabase, mutateNotifs]);

  const handleClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      );
    }
    setIsOpen(false);
    if (notif.link && onNavigate) {
      if (notif.link.startsWith('#u/')) {
        onNavigate(notif.link);
      } else if (notif.link.startsWith('#post/')) {
        onNavigate(notif.link);
      } else if (notif.link === '#dm') {
        onNavigate('dm');
      } else if (notif.link === '#top') {
        onNavigate('top');
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'roast': return <Flame className="w-4 h-4 text-[#ff4d00]" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'upvote': return <ArrowBigUp className="w-4 h-4 text-amber-400" />;
      case 'battle': return <Swords className="w-4 h-4 text-red-400" />;
      case 'levelup': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'dm': return <MessageCircle className="w-4 h-4 text-emerald-400" />;
      default: return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) mutateNotifs(); }}
        className="relative p-2 text-zinc-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl border border-[#222] transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4 text-[#ff4d00] animate-pulse" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff4d00] text-black text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden w-80 max-h-[480px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#222]">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-mono text-[#ff4d00] hover:text-[#ff6622] px-2 py-1 rounded hover:bg-[#1a1a1a]"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1 text-zinc-500 hover:text-white rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-mono">No notifications yet</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">Get roasted to get notified 🔥</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left p-3 flex items-start gap-3 hover:bg-[#1a1a1a] transition-colors border-b border-[#1a1a1a] ${
                      !notif.is_read ? 'bg-[#0d0d0d]' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500 font-mono">{timeAgo(notif.created_at)}</span>
                        {!notif.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-[#222]">
                <button
                  onClick={() => { setIsOpen(false); onNavigate?.('notifications'); }}
                  className="w-full py-2 text-[11px] font-mono text-zinc-400 hover:text-white text-center rounded hover:bg-[#1a1a1a] transition-colors"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
