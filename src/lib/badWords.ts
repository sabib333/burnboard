// Filter list for keeping roasts brutal but clean
const BANNED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
  'cock',
  'fag',
  'faggot',
  'nigger',
  'nigga',
  'slut',
  'whore',
  'twat'
];

export function checkBadWords(text: string): { hasBadWords: boolean; foundWords: string[] } {
  if (!text) return { hasBadWords: false, foundWords: [] };
  
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/);
  
  const foundWords = BANNED_WORDS.filter(banned => {
    // Check whole word or substring inside words
    return words.some(w => w === banned || w.startsWith(banned) || w.endsWith(banned));
  });

  return {
    hasBadWords: foundWords.length > 0,
    foundWords
  };
}

export function generateAnonId(): string {
  // Use persistent anon_id from localStorage if available
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem('burnboard_anon_id');
    if (existing) return existing;
  }
  // Fallback: generate and save
  const num = Math.floor(100 + Math.random() * 900);
  const id = `Anonymous #${num}`;
  if (typeof window !== 'undefined') {
    localStorage.setItem('burnboard_anon_id', id);
  }
  return id;
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
}
