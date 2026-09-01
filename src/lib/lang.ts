export const translations = {
  en: {
    roast: "Roast",
    roast_action: "Roast This Target",
    roast_plural: "Roasts",
    battles: "Roast Battles",
    leaderboard: "Leaderboard",
    world: "World Map",
    stats: "Live Stats",
    inspiration: "Need inspiration?",
    upvote: "Upvote",
    brutal: "Brutal",
    submit_target: "Submit Target",
    karma: "Karma",
    savage: "Savage",
    streak: "Day Streak",
    hot_seat: "Hot Seat",
    daily_winner: "Roast of the Day",
    anti_ai: "No AI. Just Humans Roasting Humans.",
    share_burn: "Share Burn",
    challenge: "Daily Challenge",
    offline_msg: "You're offline. Go touch grass, then come back to get roasted."
  },
  bn: {
    roast: "পচানি",
    roast_action: "পচানি দাও",
    roast_plural: "পচানি সমূহ",
    battles: "পচানি যুদ্ধ",
    leaderboard: "সেরা তালিকা",
    world: "বিশ্ব মানচিত্র",
    stats: "লাইভ পরিসংখ্যান",
    inspiration: "পচানোর আইডিয়া চান?",
    upvote: "আগুন দাও",
    brutal: "মারাত্মক",
    submit_target: "টার্গেট যোগ করুন",
    karma: "কার্মা",
    savage: "স্যাভেজ",
    streak: "দিনের ধারাবাহিকতা",
    hot_seat: "হট সিট",
    daily_winner: "আজকের সেরা পচানি",
    anti_ai: "কোনো AI নয়। মানুষই পচাবে মানুষকে।",
    share_burn: "শেয়ার করুন",
    challenge: "দৈনিক চ্যালেঞ্জ",
    offline_msg: "ইন্টারনেট নেই! একটু বাইরে গিয়ে ঘুরে আসুন, তারপর পচানি দেখতে আসুন।"
  },
  hi: {
    roast: "भूनना",
    roast_action: "इसे भूने",
    roast_plural: "रोस्ट्स",
    battles: "रोस्ट युद्ध",
    leaderboard: "लीडरबोर्ड",
    world: "विश्व मानचित्र",
    stats: "लाइव आँकड़े",
    inspiration: "रोस्ट का आइडिया चाहिए?",
    upvote: "आग लगाओ",
    brutal: "खतरनाक",
    submit_target: "नया टारगेट जोड़ें",
    karma: "कर्मा",
    savage: "सैवेज",
    streak: "लगातार दिन",
    hot_seat: "हॉट सीट",
    daily_winner: "आज का सर्वश्रेष्ठ रोस्ट",
    anti_ai: "कोई AI नहीं। केवल इंसान इंसान को रोस्ट करेंगे।",
    share_burn: "शेयर करें",
    challenge: "दैनिक चुनौती",
    offline_msg: "आप ऑफलाइन हैं। बाहर जाकर हवा खाइए, फिर रोस्ट करने आइए।"
  }
};

export type LanguageCode = 'en' | 'bn' | 'hi';

export function getLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('burnboard_lang') as LanguageCode;
    if (saved && (saved === 'en' || saved === 'bn' || saved === 'hi')) return saved;
  } catch {}
  return 'en';
}

export function setLanguage(lang: LanguageCode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('burnboard_lang', lang);
    window.dispatchEvent(new CustomEvent('burnboard_lang_changed', { detail: lang }));
  } catch {}
}

export function t(key: keyof typeof translations['en'], lang?: LanguageCode): string {
  const currentLang = lang || getLanguage();
  return translations[currentLang]?.[key] || translations.en[key] || key;
}
