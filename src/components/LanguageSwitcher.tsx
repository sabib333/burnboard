import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { getLanguage, setLanguage, LanguageCode } from '../lib/lang';

const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
];

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>('en');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setCurrentLang(getLanguage());
    const handler = (e: CustomEvent) => {
      setCurrentLang(e.detail as LanguageCode);
    };
    window.addEventListener('burnboard_lang_changed' as any, handler);
    return () => window.removeEventListener('burnboard_lang_changed' as any, handler);
  }, []);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setCurrentLang(code);
    setIsOpen(false);
    // Force re-render of all t() calls
    window.location.reload();
  };

  const current = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className={`relative ${className}`}>
      <button
        id="lang-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] rounded-xl text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        title="Switch Language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.flag}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono transition-colors ${
                  currentLang === lang.code
                    ? 'bg-[#ff4d00]/15 text-[#ff4d00] font-bold'
                    : 'text-zinc-300 hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {currentLang === lang.code && (
                  <span className="ml-auto text-[#ff4d00]">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
