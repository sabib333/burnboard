'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

const PERIODS = [
  { id: 'all_time', label: 'All Time' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
];

export default function LeaderboardsPage() {
  const [period, setPeriod] = useState('all_time');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation?type=leaderboard&period=${period}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        track('leaderboard_viewed', { period });
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 800,
        color: 'var(--text-primary)',
        margin: '0 0 24px 0',
      }}>
        🔥 Burn Leaderboard
      </h1>

      {/* Period Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        padding: '4px',
        background: 'var(--surface)',
        borderRadius: '12px',
      }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: period === p.id ? 'var(--primary)' : 'transparent',
              color: period === p.id ? 'white' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              padding: '16px',
              background: 'var(--surface)',
              borderRadius: '12px',
              height: '64px',
            }} className="animate-pulse" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🏆</span>
          <p style={{ fontSize: '16px', margin: '0 0 8px 0' }}>No rankings yet</p>
          <p style={{ fontSize: '14px', margin: 0 }}>Start creating and engaging to climb the leaderboard!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leaderboard.map((entry, index) => (
            <Link
              key={entry.user_id}
              href={`/u/${entry.username}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: index < 3
                  ? `linear-gradient(135deg, ${index === 0 ? '#fbbf2410' : index === 1 ? '#94a3b810' : '#cd7f3210'}, transparent)`
                  : 'var(--surface)',
                borderRadius: '12px',
                textDecoration: 'none',
                border: index < 3 ? `1px solid ${index === 0 ? '#fbbf2430' : index === 1 ? '#94a3b830' : '#cd7f3230'}` : '1px solid var(--border)',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : 'var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: index < 3 ? 'white' : 'var(--text-secondary)',
              }}>
                {entry.rank}
              </div>

              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--border)',
                overflow: 'hidden',
              }}>
                {entry.avatar_url && (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.display_name || entry.username}
                </div>
                {entry.display_name && (
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                  }}>
                    @{entry.username}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#f97316',
                }}>
                  {entry.reputation.toLocaleString()}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}>
                  Burn Rep
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
