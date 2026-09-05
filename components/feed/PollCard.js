'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Check } from 'lucide-react';

/**
 * PollCard — Interactive poll component.
 * 
 * Shows poll options, allows voting, and displays results.
 * Uses server-side validation via /api/polls/vote.
 */

function getParticipantId() {
  if (typeof window === 'undefined') return 'server';
  const STORAGE_KEY = 'burnboard_participant_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export default function PollCard({ poll, compact = false }) {
  const [results, setResults] = useState(null);
  const [participantVote, setParticipantVote] = useState(null);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch poll results on mount
  useEffect(() => {
    if (!poll?.id) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        const participantId = getParticipantId();
        const res = await fetch(`/api/polls/${poll.id}?participant_id=${encodeURIComponent(participantId)}`);
        const data = await res.json();

        if (res.ok) {
          setResults(data.results);
          setParticipantVote(data.participant_vote);
        }
      } catch (err) {
        // Use poll data directly if API fails
        if (poll.options) {
          setResults(poll.options.map((opt, i) => ({
            index: i,
            text: opt.text,
            votes: 0,
            percentage: 0,
          })));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [poll?.id, poll?.options]);

  const handleVote = useCallback(async (optionIndex) => {
    if (voting || participantVote !== null) return;

    setVoting(true);

    // Optimistic update
    setParticipantVote(optionIndex);
    setResults(prev => {
      if (!prev) return prev;
      return prev.map((r, i) => ({
        ...r,
        votes: i === optionIndex ? r.votes + 1 : r.votes,
        percentage: i === optionIndex
          ? Math.round(((r.votes + 1) / (prev.reduce((s, p) => s + p.votes, 0) + 1)) * 100)
          : Math.round((r.votes / (prev.reduce((s, p) => s + p.votes, 0) + 1)) * 100),
      }));
    });

    try {
      const participantId = getParticipantId();
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: poll.id,
          option_index: optionIndex,
          participant_id: participantId,
        }),
      });

      const data = await res.json();

      if (data.success && data.results) {
        setResults(data.results);
        setParticipantVote(data.action === 'already_voted' ? data.option_index : optionIndex);
      }
    } catch (err) {
      // Rollback on error
      setParticipantVote(null);
    } finally {
      setVoting(false);
    }
  }, [poll?.id, participantVote, voting]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-[#0a0a0a] border border-[#222] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!results) return null;

  const hasVoted = participantVote !== null;

  return (
    <div className="space-y-2">
      {results.map((option) => {
        const isSelected = participantVote === option.index;
        const showResults = hasVoted;

        return (
          <button
            key={option.index}
            onClick={() => !hasVoted && handleVote(option.index)}
            disabled={hasVoted || voting}
            className={`w-full text-left rounded-xl border transition-all relative overflow-hidden ${
              showResults
                ? isSelected
                  ? 'border-[#ff4d00]/60 bg-[#ff4d00]/10'
                  : 'border-[#262626] bg-[#0a0a0a]'
                : 'border-[#262626] bg-[#0a0a0a] hover:border-[#3a3a3a] hover:bg-[#111] cursor-pointer active:scale-[0.98]'
            } ${voting && isSelected ? 'opacity-70' : ''}`}
          >
            {/* Progress bar background */}
            {showResults && (
              <div
                className="absolute inset-0 transition-all duration-500"
                style={{
                  width: `${option.percentage}%`,
                  backgroundColor: isSelected ? 'rgba(255, 77, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                }}
              />
            )}

            <div className="relative flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[#ff4d00] shrink-0" />
                )}
                <span className={`text-sm truncate ${isSelected ? 'font-bold text-white' : 'text-zinc-300'}`}>
                  {option.text}
                </span>
              </div>

              {showResults && (
                <span className={`text-xs font-mono font-bold shrink-0 ml-2 ${
                  isSelected ? 'text-[#ff4d00]' : 'text-zinc-500'
                }`}>
                  {option.percentage}%
                </span>
              )}
            </div>
          </button>
        );
      })}

      {/* Vote count */}
      {hasVoted && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 pt-1">
          <BarChart3 className="w-3 h-3" />
          <span>{results.reduce((s, r) => s + r.votes, 0)} votes</span>
        </div>
      )}
    </div>
  );
}
