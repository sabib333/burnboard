import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Search, Plus, Flame, Circle, Loader2, X, ChevronUp } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  DmThread,
  DmMessage,
  getDmThreads,
  getDmMessages,
  sendDmMessage,
  getOrCreateDmThread,
  searchUsers,
} from '../lib/notify';
import { timeAgo } from '../lib/badWords';

interface DmViewProps {
  onBack: () => void;
  onShowToast: (text: string, subtext?: string) => void;
  initialThreadId?: string;
}

export const DmView: React.FC<DmViewProps> = ({ onBack, onShowToast, initialThreadId }) => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<DmThread | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; display_name: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load threads — SWR polling every 10s for 1M scale (no realtime on threads)
  const { data: threadsData, isLoading: threadsLoading } = useSWR(
    user ? `dm-threads:${user.id}` : null,
    async () => {
      if (!user) return { threads: [], nextCursor: null };
      return getDmThreads(user.id, 20);
    },
    {
      refreshInterval: 10000, // Poll every 10 seconds (not realtime — realtime dies at 1M)
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  useEffect(() => {
    if (threadsData) {
      setThreads(threadsData.threads);
    }
  }, [threadsData]);

  // Load messages when thread selected — SWR polling every 5s
  const { data: messagesData } = useSWR(
    selectedThread ? `dm-messages:${selectedThread.id}` : null,
    async () => {
      if (!selectedThread) return { messages: [], nextCursor: null };
      return getDmMessages(selectedThread.id, 30);
    },
    {
      refreshInterval: 5000, // Poll every 5 seconds (not realtime)
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData.messages);
    }
  }, [messagesData]);

  // Load older messages (cursor pagination)
  const handleLoadOlder = async () => {
    if (!selectedThread || messages.length === 0) return;
    const oldestMsg = messages[0];
    const result = await getDmMessages(selectedThread.id, 30, oldestMsg.created_at);
    if (result.messages.length > 0) {
      setMessages(prev => [...result.messages, ...prev]);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle thread selection
  const handleSelectThread = (thread: DmThread) => {
    setSelectedThread(thread);
    setShowNewDm(false);
  };

  // Handle send message
  const handleSend = async () => {
    if (!user || !selectedThread || !newMessage.trim() || sending) return;

    setSending(true);
    const msg = await sendDmMessage(selectedThread.id, user.id, newMessage.trim());
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setThreads(prev =>
        prev.map(t =>
          t.id === selectedThread.id
            ? { ...t, last_message: newMessage.trim().slice(0, 100), updated_at: new Date().toISOString() }
            : t
        )
      );
    }
    setNewMessage('');
    setSending(false);
    inputRef.current?.focus();
  };

  // Handle search for new DM
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchUsers(query, user?.id);
    setSearchResults(results);
    setSearching(false);
  };

  // Create new DM thread
  const handleStartDm = async (targetUserId: string) => {
    if (!user) return;
    const threadId = await getOrCreateDmThread(user.id, targetUserId);
    if (threadId) {
      // Reload threads from Supabase
      const result = await getDmThreads(user.id, 20);
      setThreads(result.threads);
      const found = result.threads.find(t => t.id === threadId);
      if (found) setSelectedThread(found);
      setShowNewDm(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Handle key press in send box
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-open thread if initialThreadId provided
  useEffect(() => {
    if (initialThreadId && threads.length > 0) {
      const thread = threads.find(t => t.id === initialThreadId);
      if (thread) setSelectedThread(thread);
    }
  }, [initialThreadId, threads]);

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
      {/* Left Sidebar - Thread List */}
      <div className={`${selectedThread ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-[#222]`}>
        {/* Header */}
        <div className="p-3 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1a1a1a]">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {user.userProfile?.username || 'Messages'}
            </h2>
          </div>
          <button
            onClick={() => setShowNewDm(!showNewDm)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            {showNewDm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* New DM Search */}
        {showNewDm && (
          <div className="p-3 border-b border-[#222]">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search users to DM..."
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00]"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleStartDm(u.id)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-xs flex items-center justify-center">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">@{u.username}</div>
                      {u.display_name && (
                        <div className="text-[10px] text-zinc-500">{u.display_name}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center">
              <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-mono">No messages yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">Start a roast battle with someone!</p>
            </div>
          ) : (
            threads.map(thread => {
              const other = thread.other_user;
              if (!other) return null;
              const isActive = selectedThread?.id === thread.id;

              return (
                <button
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                    isActive ? 'bg-[#1a1a1a]' : 'hover:bg-[#151515]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-sm flex items-center justify-center">
                      {other.username.charAt(0).toUpperCase()}
                    </div>
                    {/* Online indicator */}
                    {other.last_active && (
                      new Date(other.last_active).getTime() > Date.now() - 5 * 60 * 1000
                    ) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#111]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">
                        @{other.username}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                        {thread.updated_at ? timeAgo(thread.updated_at) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {thread.last_message || 'Start a conversation...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className={`${selectedThread ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-[#222] flex items-center gap-3">
              <button
                onClick={() => setSelectedThread(null)}
                className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1a1a1a]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-xs flex items-center justify-center">
                {selectedThread.other_user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  @{selectedThread.other_user?.username}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {selectedThread.other_user?.last_active &&
                  new Date(selectedThread.other_user.last_active).getTime() > Date.now() - 5 * 60 * 1000
                    ? <span className="text-emerald-400">Active now</span>
                    : 'Offline'
                  }
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesData?.nextCursor && (
                <button
                  onClick={handleLoadOlder}
                  className="flex items-center justify-center gap-1.5 w-full py-2 text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                  Load older messages
                </button>
              )}
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">Start roasting! Your messages are private.</p>
                </div>
              )}
              {messages.map(msg => {
                const isMine = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-white text-black rounded-br-md'
                          : 'bg-[#222] text-zinc-100 rounded-bl-md'
                      }`}
                    >
                      <p>{msg.message}</p>
                      <div className={`text-[9px] mt-1 ${isMine ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {timeAgo(msg.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Box */}
            <div className="p-3 border-t border-[#222]">
              <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] rounded-xl p-1.5 focus-within:border-[#ff4d00]/50">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Roast them privately..."
                  maxLength={280}
                  className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="p-2 bg-[#ff4d00] hover:bg-[#ff6622] text-black rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Flame className="w-12 h-12 text-zinc-700 mx-auto" />
              <h3 className="text-lg font-bold text-zinc-400">Your Messages</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                Send private roast messages to other users. Select a conversation or start a new one.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
