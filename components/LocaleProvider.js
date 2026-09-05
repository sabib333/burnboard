'use client';

import React, { useEffect } from 'react';
import { getLanguage, getDirection } from '@/lib/lang';

/**
 * LocaleProvider — Sets html lang attribute and dir based on user preference.
 * Wraps the app to ensure locale is applied on every page.
 */
export default function LocaleProvider({ children }) {
  useEffect(() => {
    const updateLocale = () => {
      const lang = getLanguage();
      const dir = getDirection();
      
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    };

    updateLocale();

    // Listen for language changes
    window.addEventListener('burnboard_lang_changed', updateLocale);
    return () => window.removeEventListener('burnboard_lang_changed', updateLocale);
  }, []);

  return <>{children}</>;
}
