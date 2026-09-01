// BURNBOARD Content Moderation Filter
// Keeps roasts brutal, hilarious, and sharp while strictly preventing hate speech and slurs.

export const badWords = [
  'n-word',
  'nigger',
  'nigga',
  'k-word',
  'kike',
  'fag',
  'faggot',
  'chink',
  'spic',
  'gook',
  'tranny',
  'retard',
  'cunt',
  'kys',
  'kill yourself',
  'gas the'
];

/**
 * Checks if roast text is clean from hate speech and prohibited slurs.
 * @param text The input string to inspect
 * @returns boolean: true if clean, false if contains banned slurs
 */
export function isClean(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);

  for (const banned of badWords) {
    const cleanBanned = banned.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (cleanBanned.includes(' ')) {
      if (normalized.includes(cleanBanned)) return false;
    } else {
      if (words.some(w => w === cleanBanned || (cleanBanned.length >= 4 && (w.startsWith(cleanBanned) || w.endsWith(cleanBanned))))) {
        return false;
      }
    }
  }

  return true;
}

export default { badWords, isClean };
