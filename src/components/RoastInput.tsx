import React, { useState } from 'react';
import { Send, Flame, AlertCircle, Sparkles, Wand2, Lightbulb } from 'lucide-react';
import { isClean } from '../lib/filter';
import { getOrCreateAnonId } from './AnonIdentity';
import { canRoast, recordRoastSuccess } from '../lib/rateLimit';
import { getRandomRoastTemplate } from '../lib/roastGenerator';
import { t } from '../lib/lang';
import { useAuth } from '../lib/auth';
import { HoneypotField, isBotDetected } from './HoneypotField';
import { validateInput, roastSchema } from '../lib/validation';
import { sanitize, detectXssAttempt } from '../lib/sanitize';
import { checkRateLimitClient, checkDuplicate, setCooldown } from '../lib/rateLimitAdvanced';

type SavageLevel = 'mild' | 'savage' | 'toxic' | 'bangla';

const SAVAGE_LEVELS: { id: SavageLevel; label: string; emoji: string; color: string }[] = [
  { id: 'mild', label: 'Mild', emoji: '😏', color: 'text-zinc-400 border-zinc-600 hover:border-zinc-400' },
  { id: 'savage', label: 'Savage', emoji: '🔥', color: 'text-[#ff4d00] border-[#ff4d00]/50 hover:border-[#ff4d00]' },
  { id: 'toxic', label: 'Toxic', emoji: '☠️', color: 'text-red-400 border-red-500/50 hover:border-red-400' },
  { id: 'bangla', label: 'Bangla', emoji: '🇧🇩', color: 'text-green-400 border-green-500/50 hover:border-green-400' },
];

interface RoastInputProps {
  profileId: string;
  targetUsername: string;
  targetPlatform: string;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string, savageLevel?: SavageLevel) => Promise<void>;
  onTriggerWarning: (message: string, subtext?: string) => void;
}

export const RoastInput: React.FC<RoastInputProps> = ({
  profileId,
  targetUsername,
  targetPlatform,
  onSubmitRoast,
  onTriggerWarning
}) => {
  const [text, setText] = useState('');
  const [savageLevel, setSavageLevel] = useState<SavageLevel>('savage');
  const [honeypot, setHoneypot] = useState('');
  const { user, userProfile } = useAuth();
  const [anonId, setAnonId] = useState(() => getOrCreateAnonId());
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const MAX_CHARS = 280;
  const remaining = MAX_CHARS - text.length;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setText(val);
      if (warning) setWarning(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 0. Honeypot check — bot detected
    if (isBotDetected(honeypot)) {
      // Silently reject — don't reveal anti-bot
      setText('');
      return;
    }

    // 1. XSS detection — block obvious attacks
    if (detectXssAttempt(trimmed)) {
      const msg = 'Nice try — XSS blocked 🔒';
      setWarning(msg);
      onTriggerWarning(msg, 'Script injection is not tolerated.');
      return;
    }

    // 2. ZOD validation — schema-level checks
    const validation = validateInput(roastSchema, {
      roast_text: trimmed,
      profile_id: profileId,
    });
    if (validation.success === false) {
      setWarning(validation.error);
      onTriggerWarning(validation.error, 'Input validation failed.');
      return;
    }

    // 3. Advanced rate limiting (5 roasts per 10 min)
    const rl = checkRateLimitClient('roast');
    if (!rl.allowed) {
      const msg = rl.reason || 'Rate limit exceeded';
      setWarning(msg);
      onTriggerWarning(msg, 'Anti-DDoS protection active.');
      return;
    }

    // 4. Cooldown check (30s between roasts)
    const cooldown = checkDuplicate(trimmed, profileId) ? { onCooldown: true, remainingMs: 0 } : { onCooldown: false, remainingMs: 0 };
    const legacyCheck = canRoast(profileId, trimmed);
    if (!legacyCheck.allowed) {
      const msg = legacyCheck.reason || 'Whoa, sharpen your knife first - wait 30s';
      setWarning(msg);
      onTriggerWarning(msg, 'Anti-spam defense active.');
      return;
    }

    // 5. Bad word filter — hate speech blocks
    if (!isClean(trimmed)) {
      const msg = 'Keep it brutal but clean - no hate speech';
      const sub = 'Slurs and hate speech are strictly prohibited.';
      setWarning(msg);
      onTriggerWarning(msg, sub);
      return;
    }

    // 6. Sanitize content — strip any remaining HTML
    const cleanText = sanitize(trimmed);

    setSubmitting(true);
    try {
      const currentAnon = getOrCreateAnonId();
      await onSubmitRoast(profileId, cleanText, currentAnon, savageLevel);
      recordRoastSuccess(profileId, cleanText);
      checkDuplicate(cleanText, profileId); // Record for duplicate check
      setCooldown('roast', 30000); // 30s cooldown
      setText('');
      setWarning(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspiration = () => {
    const template = getRandomRoastTemplate(targetUsername);
    setText(template);
  };

  return (
    <div className="mt-3">
      {/* Inspiration Button */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleInspiration}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-amber-500/15 text-zinc-400 hover:text-amber-400 border border-[#262626] hover:border-amber-500/30 rounded-xl text-[11px] font-mono font-bold transition-all"
          title="Get a random roast template to edit"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>{t('inspiration')}</span>
        </button>

        {/* Savage Level Selector */}
        <div className="flex items-center gap-1 ml-auto">
          {SAVAGE_LEVELS.map(level => (
            <button
              key={level.id}
              onClick={() => setSavageLevel(level.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                savageLevel === level.id
                  ? `${level.color} bg-current/10`
                  : 'text-zinc-600 border-transparent hover:text-zinc-400'
              }`}
              title={`Set savage level: ${level.label}`}
            >
              <span>{level.emoji}</span>
              <span className="hidden md:inline">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#1e1e1e] p-1.5 sm:p-2 rounded-xl border border-[#333] focus-within:border-[#ff4d00]/80 focus-within:ring-1 focus-within:ring-[#ff4d00]/30 transition-all">
        {/* Anon Badge */}
        <span
          title={user ? `Logged in as @${userProfile?.username}` : 'Your anonymous burner persona'}
          className="hidden sm:inline-block text-[10px] font-mono font-bold bg-[#262626] text-[#ff4d00] px-2 py-1 rounded-md shrink-0 select-none"
        >
          {user ? `@${userProfile?.username || user.email?.split('@')[0]}` : anonId}
        </span>

        <HoneypotField value={honeypot} onChange={setHoneypot} />
        <input
          type="text"
          id={`input-roast-${profileId}`}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_CHARS}
          placeholder={`Drop a brutal roast for @${targetUsername}...`}
          className="flex-1 bg-transparent border-none text-sm text-white placeholder-zinc-500 focus:outline-none px-2 min-w-0"
        />

        {/* Char count */}
        <span
          className={`text-[10px] font-mono px-1 select-none shrink-0 ${
            remaining < 20 ? 'text-red-400 font-bold' : 'text-zinc-500'
          }`}
        >
          {remaining}
        </span>

        {/* Submit button */}
        <button
          id={`btn-submit-roast-${profileId}`}
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className={`p-2 bg-[#ff4d00] hover:bg-[#ff6a26] text-black font-bold rounded-lg transition-all shrink-0 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            text.trim() ? 'shadow-[0_0_12px_rgba(255,77,0,0.4)]' : ''
          }`}
          title="Submit brutal roast"
        >
          <Send className="w-4 h-4 text-black stroke-[2.5]" />
        </button>
      </div>

      {/* Warning hint */}
      {warning && (
        <div className="flex items-center gap-1.5 mt-1.5 px-2 text-[11px] text-amber-400 font-mono">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>Keep it brutal but clean. Hate speech blocked.</span>
        </div>
      )}
    </div>
  );
};

