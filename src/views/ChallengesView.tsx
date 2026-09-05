import React, { useState, useEffect } from 'react';
import { Swords, Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Trophy, Flame } from 'lucide-react';
import { UserChallenge, ChallengeStatus } from '../types';
import { getUserChallenges, getChallengeTypeLabel, getChallengeStatusColor, respondToChallenge } from '../lib/challenges';
import { useAuth } from '../lib/auth';

interface ChallengesViewProps {
  onBack: () => void;
  onShowToast: (text: string, sub?: string) => void;
}

export function ChallengesView({ onBack, onShowToast }: ChallengesViewProps) {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'completed'>('active');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const data = await getUserChallenges(user.id);
      setChallenges(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleAccept = async (challengeId: string) => {
    const ok = await respondToChallenge(challengeId, user!.id, true);
    if (ok) {
      onShowToast('⚔️ Challenge Accepted!', 'The battle begins now.');
      setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, status: 'active' as ChallengeStatus } : c));
    }
  };

  const handleDecline = async (challengeId: string) => {
    const ok = await respondToChallenge(challengeId, user!.id, false);
    if (ok) {
      onShowToast('Challenge declined.', 'Maybe next time.');
      setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, status: 'declined' as ChallengeStatus } : c));
    }
  };

  const filteredChallenges = challenges.filter(c => {
    if (activeTab === 'active') return c.status === 'active';
    if (activeTab === 'pending') return c.status === 'pending';
    return c.status === 'completed' || c.status === 'expired';
  });

  const tabs: Array<{ value: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { value: 'active', label: 'Active', icon: <Swords className="w-3.5 h-3.5" /> },
    { value: 'pending', label: 'Pending', icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'completed', label: 'Done', icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="text-lg font-black text-white uppercase font-mono">CHALLENGES</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === tab.value
                ? 'bg-[#ff4d00] text-black'
                : 'bg-[#141414] text-zinc-400 border border-[#262626] hover:border-[#3a3a3a]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Challenges List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 animate-pulse">
              <div className="h-3 bg-[#222] rounded w-40 mb-2" />
              <div className="h-2 bg-[#222] rounded w-60" />
            </div>
          ))}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-dashed border-[#222] rounded-2xl">
          <Swords className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">
            {activeTab === 'pending' ? 'No pending challenges.' :
             activeTab === 'active' ? 'No active challenges.' :
             'No completed challenges yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChallenges.map(challenge => (
            <div
              key={challenge.id}
              className="bg-[#111] border border-[#222] rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getChallengeStatusColor(challenge.status) }}
                  />
                  <span className="text-xs font-mono font-bold text-zinc-300">
                    {getChallengeTypeLabel(challenge.challenge_type)}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {new Date(challenge.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Challenger</div>
                  <div className="text-sm font-bold text-white">@{challenge.challenger_username}</div>
                  <div className="text-lg font-black text-[#ff4d00] font-mono">{challenge.challenger_score}</div>
                </div>

                <div className="text-xs font-mono text-zinc-500 px-3">VS</div>

                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Challenged</div>
                  <div className="text-sm font-bold text-white">@{challenge.challenged_username}</div>
                  <div className="text-lg font-black text-blue-400 font-mono">{challenge.challenged_score}</div>
                </div>
              </div>

              {challenge.description && (
                <p className="text-xs text-zinc-400 mb-3">{challenge.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Expires: {new Date(challenge.expires_at).toLocaleDateString()}</span>
                </div>
                {challenge.winner_id && (
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Trophy className="w-3 h-3" />
                    <span>
                      Winner: {challenge.winner_id === challenge.challenger_id
                        ? `@${challenge.challenger_username}`
                        : `@${challenge.challenged_username}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons (Pending) */}
              {challenge.status === 'pending' && challenge.challenged_id === user?.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(challenge.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(challenge.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
