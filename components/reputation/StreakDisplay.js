'use client';

import { useState, useEffect } from 'react';

export default function StreakDisplay({ userId, compact = false }) {
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreak();
  }, [userId]);

  async function fetchStreak() {
    try {
      const res = await fetch(`/api/reputation?type=streak&user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak);
      }
    } catch (err) {
      console.error('Failed to fetch streak:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        width: compact ? '60px' : '120px',
        height: compact ? '24px' : '40px',
        background: 'var(--surface)',
        borderRadius: '8px',
      }} className="animate-pulse" />
    );
  }

  if (!streak || streak.current_streak === 0) {
    return compact ? null : (
      <div style={{
        padding: '12px',
        background: 'var(--surface)',
        borderRadius: '12px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '13px',
      }}>
        Start your streak today!
      </div>
    );
  }

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        background: streak.is_active_today ? '#f9731620' : '#94a3b820',
        color: streak.is_active_today ? '#f97316' : '#94a3b8',
        fontSize: '12px',
        fontWeight: 600,
      }}>
        🔥 {streak.current_streak}d
      </span>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: streak.is_active_today
        ? 'linear-gradient(135deg, #f9731610, #ef444410)'
        : 'var(--surface)',
      borderRadius: '12px',
      border: streak.is_active_today ? '1px solid #f9731630' : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px' }}>
          {streak.is_active_today ? '🔥' : '💤'}
        </span>
        <div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: streak.is_active_today ? '#f97316' : 'var(--text-primary)',
          }}>
            {streak.current_streak} Day{streak.current_streak !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {streak.is_active_today ? 'Active today!' : 'Come back to keep your streak!'}
          </div>
        </div>
      </div>
      {streak.longest_streak > streak.current_streak && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          Best streak: {streak.longest_streak} days
        </div>
      )}
    </div>
  );
}
