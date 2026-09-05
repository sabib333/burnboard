'use client';

import React, { useState } from 'react';
import { Loader2, Flag, X } from 'lucide-react';

/**
 * ReportModal — self-contained content report flow.
 *
 * Opens a bottom-sheet on mobile / centered modal on desktop. Posts a real
 * report record to /api/safety/report (server-validated, rate-limited,
 * duplicate-safe). Reporter identity never leaves the server.
 *
 * Props:
 *   - targetType: 'roast' | 'social_post' | 'comment' | 'user' | ...
 *   - targetId: string
 *   - onClose: fn
 */

const REASONS = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hateful or abusive content' },
  { id: 'threat', label: 'Threats of violence' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'non_consensual', label: 'Targeting without consent' },
  { id: 'privacy_violation', label: 'Private info shared' },
  { id: 'sexual_content', label: 'Sexually explicit content' },
  { id: 'self_harm', label: 'Self-harm concern' },
  { id: 'illegal', label: 'Illegal content' },
  { id: 'other', label: 'Something else' },
];

export default function ReportModal({ targetType, targetId, onClose }) {
  const [category, setCategory] = useState(null);
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!category || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/safety/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          category,
          context: context.trim() ? context.trim().slice(0, 500) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit report. Try again later.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Network error — try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Report content"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111] border-t sm:border border-[#222] sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[#222] sticky top-0 bg-[#111]">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            Report
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-zinc-400 hover:text-white"
            aria-label="Close report dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-3">
            <div className="text-3xl">✅</div>
            <p className="text-sm font-bold text-white">Report submitted</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Thanks — our safety team reviews every report. You will not see
              further updates here.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-[#ff4d00] text-black text-xs font-mono font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              What is the reason for reporting? Context is reviewed carefully —
              playful roasts are not automatically violations.
            </p>

            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setCategory(r.id)}
                  className={`text-left px-3 py-2.5 rounded-xl text-xs font-mono border transition-all ${
                    category === r.id
                      ? 'bg-red-500/10 border-red-500/50 text-red-300'
                      : 'bg-[#0a0a0a] border-[#262626] text-zinc-300 hover:border-[#3a3a3a]'
                  }`}
                  aria-pressed={category === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional context (helps reviewers)"
              rows={2}
              maxLength={500}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]/60 resize-none"
              aria-label="Optional context"
            />

            {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={!category || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-xl transition-all"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                Submit report
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-[#1a1a1a] border border-[#333] text-zinc-300 text-xs font-mono font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
