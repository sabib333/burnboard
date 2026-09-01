export async function shareBurn(options) {
  const shareUrl = options.url || (typeof window !== 'undefined' ? window.location.href : 'https://burnboard.app');
  const shareTitle = options.title || 'BURNBOARD 🔥 Savage Human Roast';
  const shareText = options.text;

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ title: shareTitle, text: shareText, url: shareUrl })) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      options.onSuccess?.('native');
      return 'native';
    } catch (err) {
      if (err.name === 'AbortError') return 'native';
    }
  }

  try {
    const fullText = `${shareText}\n\n${shareUrl}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(fullText);
    }
    options.onSuccess?.('clipboard');
    return 'clipboard';
  } catch (err) {
    options.onError?.(err);
    throw err;
  }
}
