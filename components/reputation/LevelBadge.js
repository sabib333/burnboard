'use client';

import { useState, useEffect } from 'react';

const LEVELS = [
  { level: 1, name: 'Spark', min_rep: 0, color: '#94a3b8', icon: '✨' },
  { level: 2, name: 'Ember', min_rep: 50, color: '#fb923c', icon: '🕯️' },
  { level: 3, name: 'Flame', min_rep: 200, color: '#f97316', icon: '🔥' },
  { level: 4, name: 'Blaze', min_rep: 500, color: '#ef4444', icon: '🔥' },
  { level: 5, name: 'Inferno', min_rep: 1000, color: '#dc2626', icon: '🌋' },
  { level: 6, name: 'Phoenix', min_rep: 2500, color: '#7c3aed', icon: '🐦‍🔥' },
  { level: 7, name: 'Legend', min_rep: 5000, color: '#eab308', icon: '👑' },
];

export function getLevelInfo(reputation) {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (reputation >= level.min_rep) {
      currentLevel = level;
    }
  }

  const currentIndex = LEVELS.indexOf(currentLevel);
  const nextLevel = currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;

  const progress = nextLevel
    ? (reputation - currentLevel.min_rep) / (nextLevel.min_rep - currentLevel.min_rep)
    : 1;

  return {
    current: currentLevel,
    next: nextLevel,
    progress: Math.min(progress, 1),
    toNext: nextLevel ? nextLevel.min_rep - reputation : 0,
  };
}

export default function LevelBadge({ reputation, compact = false }) {
  const levelInfo = getLevelInfo(reputation);

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '12px',
          background: `${levelInfo.current.color}20`,
          color: levelInfo.current.color,
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        {levelInfo.current.icon} {levelInfo.current.name}
      </span>
    );
  }

  return (
    <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '32px' }}>{levelInfo.current.icon}</span>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: levelInfo.current.color }}>
            {levelInfo.current.name}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Level {levelInfo.current.level}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {reputation.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Burn Rep</div>
        </div>
      </div>

      {levelInfo.next && (
        <div>
          <div style={{
            height: '8px',
            background: 'var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '6px',
          }}>
            <div style={{
              height: '100%',
              width: `${levelInfo.progress * 100}%`,
              background: `linear-gradient(90deg, ${levelInfo.current.color}, ${levelInfo.next.color})`,
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {levelInfo.toNext.toLocaleString()} rep to {levelInfo.next.icon} {levelInfo.next.name}
          </div>
        </div>
      )}

      {!levelInfo.next && (
        <div style={{ fontSize: '13px', color: levelInfo.current.color, fontWeight: 600 }}>
          You&apos;ve reached the highest level! 👑
        </div>
      )}
    </div>
  );
}
