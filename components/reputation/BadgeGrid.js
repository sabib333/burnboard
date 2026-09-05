'use client';

import { useState, useEffect } from 'react';

export default function BadgeGrid({ userId, isOwnProfile = false }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, [userId]);

  async function fetchBadges() {
    try {
      const res = await fetch(`/api/reputation?type=badges&user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch (err) {
      console.error('Failed to fetch badges:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            width: '80px',
            height: '80px',
            borderRadius: '12px',
            background: 'var(--surface)',
          }} className="animate-pulse" />
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '14px',
      }}>
        {isOwnProfile
          ? 'No badges yet. Start creating and engaging to earn your first badge!'
          : 'No badges earned yet.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {badges.map((badge) => (
        <div
          key={badge.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            padding: '12px',
            background: 'var(--surface)',
            borderRadius: '12px',
            width: '100px',
            textAlign: 'center',
            border: '1px solid var(--border)',
          }}
          title={badge.description}
        >
          <span style={{ fontSize: '28px' }}>{badge.icon}</span>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: '1.2',
          }}>
            {badge.name}
          </span>
          {badge.unlocked_at && (
            <span style={{
              fontSize: '10px',
              color: 'var(--text-secondary)',
            }}>
              {new Date(badge.unlocked_at).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
