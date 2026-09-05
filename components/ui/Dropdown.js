'use client';

import React, { useState, useRef, useEffect } from 'react';

/**
 * Dropdown — Menu and option selection.
 * 
 * Usage:
 *   <Dropdown
 *     trigger={<Button>Options</Button>}
 *     items={[
 *       { key: 'edit', label: 'Edit', icon: Pencil },
 *       { key: 'delete', label: 'Delete', icon: Trash2, danger: true },
 *     ]}
 *     onSelect={handleSelect}
 *   />
 */
export default function Dropdown({
  trigger,
  items = [],
  onSelect,
  align = 'right',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (item) => {
    onSelect?.(item);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div onClick={() => setOpen(!open)}>
        {trigger}
      </div>

      {open && (
        <div className={`absolute top-full mt-2 w-48 bg-[#111] border border-[#222] rounded-xl shadow-2xl overflow-hidden z-50 animate-scale-in ${
          align === 'left' ? 'left-0' : 'right-0'
        }`}>
          <div className="p-1">
            {items.map(item => (
              <button
                key={item.key}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                  item.danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-zinc-300 hover:bg-[#1a1a1a] hover:text-white'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-auto text-zinc-600 text-[10px]">{item.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
