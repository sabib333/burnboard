/**
 * BURNBOARD Honeypot Anti-Bot Field
 *
 * Invisible field that bots automatically fill in.
 * Humans never see or interact with it.
 * If filled → it's a bot → block the submission.
 */

import React from 'react';

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
}

export const HoneypotField: React.FC<HoneypotFieldProps> = ({
  value,
  onChange,
  name = 'website',
}) => {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        tabIndex: -1,
      }}
    >
      <label htmlFor={`hp-${name}`}>Leave this empty</label>
      <input
        id={`hp-${name}`}
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
};

/**
 * Check if honeypot was filled (bot detected).
 */
export function isBotDetected(honeypotValue: string): boolean {
  return honeypotValue !== '' && honeypotValue !== undefined && honeypotValue !== null;
}
