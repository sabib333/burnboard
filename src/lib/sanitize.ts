/**
 * BURNBOARD XSS Sanitization
 *
 * All user-generated content MUST pass through sanitize() before rendering.
 * Prevents: XSS, HTML injection, event handler injection.
 */

// ── Strip HTML tags ──────────────────────────────────────────
export function stripHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')           // Strip all HTML tags
    .replace(/&lt;/g, '<')             // Decode common entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// ── Sanitize for safe rendering ──────────────────────────────
export function sanitize(text: string): string {
  if (!text) return '';
  return stripHtml(text)
    .replace(/javascript:/gi, '')       // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')         // Remove event handlers
    .replace(/data:text\/html/gi, '')    // Remove data URIs
    .replace(/vbscript:/gi, '');         // Remove vbscript
}

// ── Sanitize for display (preserves safe formatting) ─────────
export function sanitizeForDisplay(text: string): string {
  if (!text) return '';
  const cleaned = sanitize(text);
  // Limit length for display
  if (cleaned.length > 500) {
    return cleaned.substring(0, 500) + '…';
  }
  return cleaned;
}

// ── Escape special characters for safe HTML context ──────────
export function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

// ── Detect potential XSS attempts ────────────────────────────
export function detectXssAttempt(text: string): boolean {
  if (!text) return false;
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /document\.(cookie|domain)/i,
    /window\.(location|open)/i,
    /eval\s*\(/i,
    /alert\s*\(/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

// ── Sanitize username (no special chars) ─────────────────────
export function sanitizeUsername(username: string): string {
  if (!username) return '';
  return username
    .replace(/[^a-zA-Z0-9_]/g, '')  // Only allow alphanumeric + underscore
    .substring(0, 30)                 // Max length
    .toLowerCase();
}

// ── Sanitize URL (prevent javascript: protocol) ──────────────
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  const cleaned = url.trim();
  // Block dangerous protocols
  if (cleaned.match(/^(javascript|vbscript|data):/i)) {
    return '';
  }
  // Ensure proper protocol
  if (cleaned && !cleaned.match(/^https?:\/\//i)) {
    return 'https://' + cleaned;
  }
  return cleaned;
}

// ── Content Security Policy nonce for inline styles ──────────
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
