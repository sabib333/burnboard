'use client';

import React from 'react';

/**
 * Tabs — Content switching control.
 * 
 * Usage:
 *   <Tabs
 *     tabs={[
 *       { key: 'fresh', label: 'Fresh', icon: Clock },
 *       { key: 'trending', label: 'Trending', icon: TrendingUp },
 *     ]}
 *     active="fresh"
 *     onChange={setActive}
 *   />
 */
export default function Tabs({
  tabs = [],
  active,
  onChange,
  variant = 'pills',
  size = 'sm',
  className = '',
}) {
  const variants = {
    pills: 'bg-[#111] p-1 rounded-xl border border-[#262626]',
    underline: 'border-b border-[#222]',
    segmented: 'bg-[#0a0a0a] p-0.5 rounded-lg border border-[#262626]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2 text-xs',
  };

  return (
    <div className={`flex items-center gap-1 overflow-x-auto ${variants[variant] || variants.pills} ${className}`}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap font-mono font-bold transition-all rounded-lg ${sizes[size] || sizes.sm} ${
              isActive
                ? variant === 'underline'
                  ? 'text-white border-b-2 border-[#ff4d00]'
                  : 'bg-[#ff4d00] text-black'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.icon && !Icon && <span>{tab.icon}</span>}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count != null && (
              <span className={`text-[9px] ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
