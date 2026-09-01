import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Flame, UserPlus, ArrowBigUp, Swords, Sparkles, MessageCircle, CheckCheck, Loader2, Calendar, Filter, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { NotificationItem, NotificationType, getNotificationsPaginated, getNotificationCounts, markAsRead, markAllAsRead, type NotificationFilters } from '../lib/notify';
import { timeAgo } from '../lib/badWords';

interface NotificationsViewProps {
  onBack: () => void;
  onShowToast: (text: string, subtext?: string) => void;
}

type FilterType = 'all' | NotificationType;

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onBack, onShowToast }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Date range state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Type counts
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  // Build filters object
  const buildFilters = useCallback((): NotificationFilters => {
    const f: NotificationFilters = {};
    if (filter !== 'all') f.type = filter as NotificationType;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    return f;
  }, [filter, dateFrom, dateTo]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await getNotificationsPaginated(user.id, 30, undefined, buildFilters());
    setNotifications(result.notifications);
    setCursor(result.nextCursor);
    setLoading(false);
  }, [user, buildFilters]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch type counts on mount
  useEffect(() => {
    if (!user) return;
    getNotificationCounts(user.id).then(setTypeCounts);
  }, [user]);

  // Refetch when filters change
  useEffect(() => {
    fetchNotifications();
  }, [filter, dateFrom, dateTo, fetchNotifications]);

  // Load more with cursor pagination
  const handleLoadMore = async () => {
    if (!user || !cursor || loadingMore) return;
    setLoadingMore(true);
    const result = await getNotificationsPaginated(user.id, 30, cursor, buildFilters());
    setNotifications(prev => [...prev, ...result.notifications]);
    setCursor(result.nextCursor);
    setLoadingMore(false);
  };

  const handleClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      );
    }
    if (notif.link) {
      window.location.hash = notif.link.startsWith('#') ? notif.link : `#${notif.link}`;
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    onShowToast('All caught up! ✅', 'All notifications marked as read.');
  };

  const handleClearDateRange = () => {
    setDateFrom('');
    setDateTo('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'roast': return <Flame className="w-5 h-5 text-[#ff4d00]" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-blue-400" />;
      case 'upvote': return <ArrowBigUp className="w-5 h-5 text-amber-400" />;
      case 'battle': return <Swords className="w-5 h-5 text-red-400" />;
      case 'levelup': return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'dm': return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      default: return <Bell className="w-5 h-5 text-zinc-400" />;
    }
  };

  const filters: { id: FilterType; label: string; icon?: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'roast', label: '🔥 Roasts' },
    { id: 'follow', label: '👤 Follows' },
    { id: 'upvote', label: '⬆️ Upvotes' },
    { id: 'dm', label: '💬 Messages' },
    { id: 'levelup', label: '🎉 Levels' },
  ];

  const activeFilterCount = [dateFrom, dateTo].filter(Boolean).length + (filter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Feed</span>
      </button>

      {/* Header */}
      <div className="bg-gradient-to-b from-[#141414] to-[#111] border border-[#262626] rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">Notifications</h1>
            <p className="text-xs text-zinc-400 font-mono">
              {notifications.filter(n => !n.is_read).length} unread • {notifications.length} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date filter toggle */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-bold transition-colors ${
              showDatePicker
                ? 'bg-[#ff4d00] text-black border-[#ff4d00]'
                : 'bg-[#1a1a1a] text-zinc-300 hover:text-white border-[#262626] hover:bg-[#222]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#ff4d00] text-black text-[9px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Range Picker (collapsible) */}
      {showDatePicker && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">Date Range</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:border-[#ff4d00] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:border-[#ff4d00] focus:outline-none"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={handleClearDateRange}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          {/* Quick presets */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { label: 'Today', from: new Date().toISOString().split('T')[0], to: '' },
              { label: 'Last 7 days', from: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })(), to: '' },
              { label: 'Last 30 days', from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })(), to: '' },
              { label: 'This month', from: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; })(), to: '' },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => { setDateFrom(preset.from); setDateTo(preset.to || ''); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-colors ${
                  dateFrom === preset.from && (preset.to ? dateTo === preset.to : dateTo === '')
                    ? 'bg-[#ff4d00] text-black'
                    : 'bg-[#1a1a1a] text-zinc-400 hover:text-white hover:bg-[#222]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#111] border border-[#222] rounded-xl p-1 overflow-x-auto">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === f.id
                ? 'bg-[#ff4d00] text-black'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {f.label}
            {f.id !== 'all' && typeCounts[f.id] !== undefined && (
              <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                filter === f.id ? 'bg-black/20 text-black' : 'bg-[#222] text-zinc-500'
              }`}>
                {typeCounts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#ff4d00] animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center">
          <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">No notifications found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
            {activeFilterCount > 0
              ? "No notifications match your filters. Try adjusting the date range or type filter."
              : "When someone roasts you, follows you, or sends a message, it'll show up here."}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilter('all'); handleClearDateRange(); }}
              className="mt-4 px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Results summary */}
          {(dateFrom || dateTo || filter !== 'all') && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 px-1">
              <Filter className="w-3 h-3" />
              <span>
                Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {filter !== 'all' && ` of type "${filter}"`}
                {dateFrom && ` from ${dateFrom}`}
                {dateTo && ` to ${dateTo}`}
              </span>
            </div>
          )}

          <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
            {notifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left p-4 flex items-start gap-3 hover:bg-[#1a1a1a] transition-colors ${
                  !notif.is_read ? 'bg-[#0d0d0d]' : ''
                }`}
              >
                <div className="mt-0.5 shrink-0 w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {timeAgo(notif.created_at)}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-mono uppercase">
                      {notif.type}
                    </span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#ff4d00]" />
                    )}
                  </div>
                </div>
              </button>
            ))}
            {cursor && (
              <div className="p-3 border-t border-[#1a1a1a]">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  {loadingMore ? 'Loading...' : 'Load older notifications'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
