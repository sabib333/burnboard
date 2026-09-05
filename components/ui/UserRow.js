'use client';

import React from 'react';
import Avatar from './Avatar';
import Badge from './Badge';

/**
 * UserRow — User identity row for lists, feeds, and leaderboards.
 * 
 * Usage:
 *   <UserRow username="johndoe" displayName="John Doe" subtitle="5 roasts" />
 *   <UserRow username="jane" badge="🔥" action={<Button>Follow</Button>} />
 */
export default function UserRow({
  username,
  displayName,
  subtitle,
  avatarSrc,
  avatarColor,
  badge,
  badgeVariant = 'neutral',
  action,
  onClick,
  className = '',
}) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${onClick ? 'hover:bg-[#1a1a1a] cursor-pointer active:scale-[0.99]' : ''} ${className}`}
      onClick={onClick}
    >
      <Avatar
        src={avatarSrc}
        username={username}
        color={avatarColor}
        size="md"
      />

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-white truncate">
            {displayName || username}
          </span>
          {badge && (
            <Badge variant={badgeVariant} size="xs">{badge}</Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {action && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      )}
    </Component>
  );
}
