import { track } from './analytics';

export interface ShareOptions {
  title?: string;
  text: string;
  url?: string;
  onSuccess?: (type: 'native' | 'clipboard') => void;
  onError?: (err: any) => void;
}

/**
 * Unified Share Function:
 * Uses Web Share API if supported (mobile/desktop browsers),
 * falls back to clipboard copy with instant feedback.
 */
export async function shareBurn(options: ShareOptions): Promise<'native' | 'clipboard'> {
  const shareUrl = options.url || (typeof window !== 'undefined' ? window.location.href : 'https://burnboard.app');
  const shareTitle = options.title || 'BURNBOARD 🔥 Savage Human Roast';
  const shareText = options.text;

  track('share_clicked', { text: shareText.substring(0, 30), url: shareUrl });

  // 1. Try Native Web Share API
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ title: shareTitle, text: shareText, url: shareUrl })) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      options.onSuccess?.('native');
      return 'native';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return 'native';
      }
      console.warn('Native share failed, falling back to clipboard:', err);
    }
  }

  // 2. Fallback to Clipboard Copy
  try {
    const fullText = `${shareText}\n\n${shareUrl}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(fullText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    options.onSuccess?.('clipboard');
    return 'clipboard';
  } catch (err) {
    options.onError?.(err);
    throw err;
  }
}
